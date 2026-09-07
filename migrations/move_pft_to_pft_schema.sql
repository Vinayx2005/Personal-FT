-- Move every PFT-owned table from `public` to a dedicated `pft` schema.
--
-- Matches the "schema per app-domain" convention already used by
-- `blog` (root + pft blog posts) and `dilse` (dilse.stories). After this
-- runs, `public` holds only cross-app helpers (`content_set_updated_at`)
-- and Supabase's own bootstrap objects.
--
-- Zero data loss. `alter table … set schema` is a metadata-only rename;
-- rows, indexes, constraints, triggers, RLS policies, and owned
-- sequences all travel with the table. Foreign keys are identified by
-- OID so cross-table FKs stay valid.
--
-- Reversible with the mirror script (`alter table pft.X set schema public;`)
-- if anything goes wrong.
--
-- ONE-TIME dashboard step AFTER running this: Supabase → API Settings →
-- Exposed schemas → add `pft` alongside `public`, `blog`, `dilse`. Without
-- it the anon REST endpoint 404s.
--
-- Safe to re-run: every ALTER uses `if exists`, every function uses
-- `create or replace`.

-- ─── 1. Schema + grants ────────────────────────────────────────────────
create schema if not exists pft;
grant usage on schema pft to anon, authenticated;

-- ─── 2. Move tables ────────────────────────────────────────────────────
-- Order matters only for readability; SET SCHEMA doesn't touch data.
alter table if exists public.users                set schema pft;
alter table if exists public.banks                set schema pft;
alter table if exists public.categories           set schema pft;
alter table if exists public.transactions         set schema pft;
alter table if exists public.budgets              set schema pft;
alter table if exists public.loans                set schema pft;
alter table if exists public.receivables          set schema pft;
alter table if exists public.investments          set schema pft;
alter table if exists public.sips                 set schema pft;
alter table if exists public.bank_balance_history set schema pft;
alter table if exists public.audit_log            set schema pft;
alter table if exists public.receipts             set schema pft;
alter table if exists public.subscriptions        set schema pft;
-- Legacy tables — may or may not exist depending on migration history.
alter table if exists public.monthly_balances     set schema pft;
alter table if exists public.bank_reconciliation  set schema pft;

-- ─── 3. Table-level privileges (roles don't inherit across schemas) ────
grant select, insert, update, delete on all tables    in schema pft to authenticated;
grant usage,  select                on all sequences in schema pft to authenticated;

-- ─── 4. Rewrite the 5 functions that had hardcoded public.<table> ─────
-- All of these live in `public` (they're either trigger handlers on
-- auth.users or RPCs exposed to the client), but their bodies now
-- reference pft.<table>. Function OIDs stay the same, so existing
-- triggers on auth.users keep firing without needing to be recreated.

-- 4a. Bootstrap trigger — creates app-user row + default categories.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pft, public
as $$
begin
  begin
    insert into pft.users (id, email, full_name)
    values (
      new.id,
      new.email,
      coalesce(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
      )
    )
    on conflict (id) do nothing;
  exception when others then
    raise warning 'handle_new_user users-insert failed for %: %', new.id, sqlerrm;
  end;

  begin
    insert into pft.categories (type, name, user_id, is_default) values
      ('expense', 'Food & Groceries', new.id, true),
      ('expense', 'Rent',             new.id, true),
      ('expense', 'Transport',        new.id, true),
      ('expense', 'Utilities',        new.id, true),
      ('expense', 'Entertainment',    new.id, true),
      ('expense', 'Shopping',         new.id, true),
      ('expense', 'Health',           new.id, true),
      ('expense', 'Others',           new.id, true),
      ('income',  'Salary',           new.id, true),
      ('income',  'Freelance',        new.id, true),
      ('income',  'Others',           new.id, true)
    on conflict do nothing;
  exception when others then
    raise warning 'handle_new_user categories-seed failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

-- 4b. Bootstrap trigger — seeds a subscription row.
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = pft, public
as $$
begin
  begin
    insert into pft.subscriptions (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  exception when others then
    raise warning 'handle_new_user_subscription failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- 4c. RPC — user deletes their own account and every row they own.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = pft, public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  begin delete from pft.transactions          where created_by = uid; exception when others then null; end;
  begin delete from pft.transactions          where user_id    = uid; exception when others then null; end;
  begin delete from pft.investments           where created_by = uid; exception when others then null; end;
  begin delete from pft.investments           where user_id    = uid; exception when others then null; end;
  begin delete from pft.budgets               where user_id    = uid; exception when others then null; end;
  begin delete from pft.bank_balance_history  where changed_by = uid; exception when others then null; end;
  begin delete from pft.banks                 where user_id    = uid; exception when others then null; end;
  begin delete from pft.categories            where user_id    = uid; exception when others then null; end;
  begin delete from pft.audit_log             where user_id    = uid; exception when others then null; end;
  begin delete from pft.loans                 where user_id    = uid; exception when others then null; end;
  begin delete from pft.receivables           where user_id    = uid; exception when others then null; end;
  begin delete from pft.sips                  where user_id    = uid; exception when others then null; end;
  begin delete from pft.receipts              where user_id    = uid; exception when others then null; end;
  begin delete from pft.subscriptions         where user_id    = uid; exception when others then null; end;
  begin delete from pft.users                 where id         = uid; exception when others then null; end;

  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_own_account() to authenticated;

-- 4d. Merge-duplicate-email account RPC (used by admin + signup trigger).
create or replace function public.merge_duplicate_email_accounts(target_email text)
returns table (keeper_uid uuid, losers_removed int, rows_reassigned int)
language plpgsql
security definer
set search_path = pft, public, auth
as $$
declare
  _keeper uuid;
  _losers uuid[];
  _n_reassigned int := 0;
  _n_rows int;
begin
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

  insert into pft.users (id, email, full_name)
  select _keeper, target_email, coalesce(
    (select full_name from pft.users
      where id = any(_losers) and full_name is not null and full_name <> ''
      order by created_at asc limit 1),
    split_part(target_email, '@', 1)
  )
  on conflict (id) do update
    set full_name = coalesce(nullif(excluded.full_name, ''), pft.users.full_name);

  update pft.banks set user_id = _keeper where user_id = any(_losers);
  get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;

  with dupes as (
    select l.id as loser_cat_id, k.id as keeper_cat_id
    from pft.categories l
    join pft.categories k
      on k.user_id = _keeper
     and k.type    = l.type
     and lower(k.name) = lower(l.name)
    where l.user_id = any(_losers)
  ),
  repoint as (
    update pft.transactions t
    set category_id = d.keeper_cat_id
    from dupes d
    where t.category_id = d.loser_cat_id
    returning 1
  )
  delete from pft.categories
    where id in (select loser_cat_id from dupes);
  update pft.categories set user_id = _keeper where user_id = any(_losers);
  get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;

  -- monthly_balances / bank_reconciliation are legacy; skip silently if absent.
  begin
    update pft.monthly_balances set user_id = _keeper where user_id = any(_losers);
    get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;
  exception when undefined_table then null; end;

  update pft.transactions set created_by = _keeper where created_by = any(_losers);
  get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;

  update pft.investments set created_by = _keeper where created_by = any(_losers);
  get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;

  delete from pft.budgets b
   where b.user_id = any(_losers)
     and exists (
       select 1 from pft.budgets k
       where k.user_id = _keeper
         and k.category_id = b.category_id
         and k.month = b.month
     );
  update pft.budgets set user_id = _keeper where user_id = any(_losers);
  get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;

  update pft.bank_balance_history set changed_by = _keeper where changed_by = any(_losers);
  get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;

  begin
    update pft.bank_reconciliation set reconciled_by = _keeper where reconciled_by = any(_losers);
    get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;
  exception when undefined_table then null; end;

  update pft.audit_log set user_id = _keeper where user_id = any(_losers);
  get diagnostics _n_rows = row_count; _n_reassigned := _n_reassigned + _n_rows;

  update pft.subscriptions k
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
    select * from pft.subscriptions
    where user_id = any(_losers)
    order by is_paid desc, created_at asc
    limit 1
  ) best
  where k.user_id = _keeper;

  insert into pft.subscriptions (
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
  from pft.subscriptions
  where user_id = any(_losers)
  order by is_paid desc, created_at asc
  limit 1
  on conflict (user_id) do nothing;

  delete from pft.subscriptions where user_id = any(_losers);
  delete from pft.users         where id      = any(_losers);
  delete from auth.users        where id      = any(_losers);

  return query select _keeper, coalesce(array_length(_losers, 1), 0), _n_reassigned;
end;
$$;

-- 4e. Auto-merge trigger on new signups.
create or replace function public.merge_duplicate_email_on_signup()
returns trigger
language plpgsql
security definer
set search_path = pft, public, auth
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

-- ─── 5. Sanity check ───────────────────────────────────────────────────
-- After this migration, `public` should contain no PFT tables. Run to verify:
--   select table_schema, table_name
--   from information_schema.tables
--   where table_schema in ('public','pft')
--   order by 1, 2;
