-- Merge duplicate auth.users rows that share an email into ONE account,
-- and install a trigger so future duplicate-email signups auto-merge
-- (Supabase does NOT link email/password + Google OAuth for the same email
-- by default — it creates two separate accounts, which orphans the user's
-- data behind an RLS boundary).
--
-- What this file does:
--   1. Defines public.merge_duplicate_email_accounts(target_email) — merges
--      every auth.users row for that email into the most recently signed-in
--      one ("keeper"), reassigning all user-owned rows to the keeper and
--      deleting the losers (and their auth identities via ON DELETE CASCADE).
--   2. Runs it once for vinayteja23@gmail.com to recover their data.
--   3. Installs an AFTER-INSERT trigger on auth.users so that any future
--      new signup with an email that already exists is auto-merged into
--      the older account (i.e. new uid inherits all old data, old auth
--      row is deleted).
--
-- Safe to re-run. All mutations happen inside SECURITY DEFINER functions
-- so RLS never blocks the migration.
--
-- To run: paste into Supabase SQL editor and execute.

-- ============================================================================
-- 1. The merge function
-- ============================================================================
create or replace function public.merge_duplicate_email_accounts(target_email text)
returns table (keeper_uid uuid, losers_removed int, rows_reassigned int)
language plpgsql
security definer
set search_path = public
as $$
declare
  _keeper uuid;
  _losers uuid[];
  _n_reassigned int := 0;
  _n_rows int;
begin
  -- Pick the most-recently-active auth.users row as the keeper.
  select id into _keeper
  from auth.users
  where lower(email) = lower(target_email)
  order by coalesce(last_sign_in_at, created_at) desc
  limit 1;

  if _keeper is null then
    return query select null::uuid, 0, 0;
    return;
  end if;

  select array_agg(id) into _losers
  from auth.users
  where lower(email) = lower(target_email)
    and id <> _keeper;

  if _losers is null or array_length(_losers, 1) = 0 then
    return query select _keeper, 0, 0;
    return;
  end if;

  raise notice 'merge % → keeper=%  losers=%', target_email, _keeper, _losers;

  -- Ensure the keeper has a public.users row (Google-only signups fail their
  -- trigger silently in the hardened version, so this may not exist yet).
  insert into public.users (id, email, full_name)
  select _keeper, target_email, coalesce(
    (select full_name from public.users
      where id = any(_losers) and full_name is not null and full_name <> ''
      order by created_at asc limit 1),
    split_part(target_email, '@', 1)
  )
  on conflict (id) do update
    set full_name = coalesce(nullif(excluded.full_name, ''), public.users.full_name);

  -- --------------- BANKS (has UNIQUE (user_id, name)? no — safe to bulk update) ---
  update public.banks set user_id = _keeper where user_id = any(_losers);
  get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;

  -- --------------- CATEGORIES (UNIQUE (user_id, type, name) — dedupe first) ------
  -- If the keeper already has the same (type,name), delete the loser's copy;
  -- also re-point any transactions that referenced the loser category to the
  -- keeper's equivalent category so we don't lose classification.
  with dupes as (
    select l.id as loser_cat_id, k.id as keeper_cat_id
    from public.categories l
    join public.categories k
      on k.user_id = _keeper
     and k.type    = l.type
     and lower(k.name) = lower(l.name)
    where l.user_id = any(_losers)
  ),
  repoint as (
    update public.transactions t
    set category_id = d.keeper_cat_id
    from dupes d
    where t.category_id = d.loser_cat_id
    returning 1
  )
  delete from public.categories
    where id in (select loser_cat_id from dupes);
  update public.categories set user_id = _keeper where user_id = any(_losers);
  get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;

  -- --------------- MONTHLY BALANCES ---------------------------------------------
  update public.monthly_balances set user_id = _keeper where user_id = any(_losers);
  get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;

  -- --------------- TRANSACTIONS -------------------------------------------------
  update public.transactions set created_by = _keeper where created_by = any(_losers);
  get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;

  -- --------------- INVESTMENTS --------------------------------------------------
  update public.investments set created_by = _keeper where created_by = any(_losers);
  get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;

  -- --------------- BUDGETS (UNIQUE (user_id, category_id, month)) ---------------
  -- Delete loser budgets that would collide with an already-existing keeper budget
  -- for the same (category, month); reassign the rest.
  delete from public.budgets b
   where b.user_id = any(_losers)
     and exists (
       select 1 from public.budgets k
       where k.user_id = _keeper
         and k.category_id = b.category_id
         and k.month = b.month
     );
  update public.budgets set user_id = _keeper where user_id = any(_losers);
  get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;

  -- --------------- BANK BALANCE HISTORY / RECONCILIATION / AUDIT ----------------
  update public.bank_balance_history set changed_by    = _keeper where changed_by    = any(_losers);
  get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;

  update public.bank_reconciliation set reconciled_by  = _keeper where reconciled_by = any(_losers);
  get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;

  update public.audit_log set user_id = _keeper where user_id = any(_losers);
  get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;

  -- --------------- SUBSCRIPTIONS (PK on user_id — merge, don't drop) ------------
  -- Pull the "best" subscription (paid > earliest trial) from the losers into
  -- the keeper. This preserves the user's original trial start and any paid
  -- status they'd earned.
  update public.subscriptions k
  set
    trial_ends_at       = least(k.trial_ends_at, best.trial_ends_at),
    is_paid             = k.is_paid or best.is_paid,
    paid_at             = coalesce(k.paid_at, best.paid_at),
    amount              = coalesce(k.amount, best.amount),
    razorpay_order_id   = coalesce(k.razorpay_order_id, best.razorpay_order_id),
    razorpay_payment_id = coalesce(k.razorpay_payment_id, best.razorpay_payment_id),
    welcome_sent_at     = coalesce(k.welcome_sent_at, best.welcome_sent_at),
    reminder_3d_sent_at = coalesce(k.reminder_3d_sent_at, best.reminder_3d_sent_at),
    reminder_2d_sent_at = coalesce(k.reminder_2d_sent_at, best.reminder_2d_sent_at),
    reminder_1d_sent_at = coalesce(k.reminder_1d_sent_at, best.reminder_1d_sent_at),
    updated_at          = now()
  from (
    select * from public.subscriptions
    where user_id = any(_losers)
    order by is_paid desc, created_at asc
    limit 1
  ) best
  where k.user_id = _keeper;

  -- If the keeper had no subscription row (shouldn't happen — trigger always
  -- seeds one — but be defensive), promote the best loser row to keeper.
  insert into public.subscriptions (
    user_id, trial_ends_at, is_paid, paid_at, amount,
    razorpay_order_id, razorpay_payment_id,
    welcome_sent_at, reminder_3d_sent_at, reminder_2d_sent_at, reminder_1d_sent_at,
    created_at, updated_at
  )
  select
    _keeper, trial_ends_at, is_paid, paid_at, amount,
    razorpay_order_id, razorpay_payment_id,
    welcome_sent_at, reminder_3d_sent_at, reminder_2d_sent_at, reminder_1d_sent_at,
    created_at, now()
  from public.subscriptions
  where user_id = any(_losers)
  order by is_paid desc, created_at asc
  limit 1
  on conflict (user_id) do nothing;

  delete from public.subscriptions where user_id = any(_losers);

  -- --------------- DROP THE LOSER public.users ROWS -----------------------------
  delete from public.users where id = any(_losers);

  -- --------------- DELETE THE LOSER auth.users ROWS -----------------------------
  -- ON DELETE CASCADE on auth.identities takes care of the login-method rows.
  delete from auth.users where id = any(_losers);

  return query select _keeper, coalesce(array_length(_losers, 1), 0), _n_reassigned;
end;
$$;

-- ============================================================================
-- 2. Run the merge for the affected user
-- ============================================================================
select * from public.merge_duplicate_email_accounts('vinayteja23@gmail.com');

-- ============================================================================
-- 3. Prevention: auto-merge trigger on future signups
-- ============================================================================
-- Fires AFTER the seed triggers (handle_new_user, handle_new_user_subscription)
-- because Postgres runs same-timing triggers in alphabetical order and
-- 'zzz_' > 'on_'.
-- Wrapped in EXCEPTION so a merge failure never blocks an auth signup.
create or replace function public.merge_duplicate_email_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.merge_duplicate_email_accounts(new.email);
  exception when others then
    raise warning 'merge_duplicate_email_on_signup failed for % (%): %',
      new.email, new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists zzz_on_auth_user_merge_duplicate_email on auth.users;
create trigger zzz_on_auth_user_merge_duplicate_email
  after insert on auth.users
  for each row execute function public.merge_duplicate_email_on_signup();
