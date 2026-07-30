-- Diagnostic (READ ONLY — no writes) for the "my data is gone" bug.
--
-- Symptom: user signs in, sees an empty dashboard, but their rows are
-- still in the DB. Almost always caused by TWO auth.users rows for the
-- same email (email/password signup vs. Google OAuth signup — Supabase
-- gives each a different uid, so RLS filtering by auth.uid() returns
-- nothing).
--
-- To run: paste into Supabase SQL editor. Change the target_email at
-- the top if diagnosing a different user.

do $$
declare
  target_email text := 'vinayteja23@gmail.com';
  rec record;
begin
  raise notice '';
  raise notice '===== auth.users rows for % =====', target_email;
  for rec in
    select id, email, created_at, last_sign_in_at,
           raw_app_meta_data->>'provider'  as primary_provider,
           raw_app_meta_data->'providers'  as all_providers,
           email_confirmed_at is not null  as email_confirmed
    from auth.users
    where lower(email) = lower(target_email)
    order by created_at
  loop
    raise notice 'uid=%  created=%  last_sign_in=%  primary=%  providers=%  confirmed=%',
      rec.id, rec.created_at, rec.last_sign_in_at,
      rec.primary_provider, rec.all_providers, rec.email_confirmed;
  end loop;

  raise notice '';
  raise notice '===== row counts per uid across every user-owned table =====';
  for rec in
    with target_uids as (
      select id from auth.users where lower(email) = lower(target_email)
    ),
    counts as (
      select 'users'                as tbl, id       as owner_uid, 1 as n from public.users             where id       in (select id from target_uids)
      union all select 'banks',                 user_id,       count(*)::int from public.banks               where user_id       in (select id from target_uids) group by user_id
      union all select 'categories',            user_id,       count(*)::int from public.categories          where user_id       in (select id from target_uids) group by user_id
      union all select 'monthly_balances',      user_id,       count(*)::int from public.monthly_balances    where user_id       in (select id from target_uids) group by user_id
      union all select 'transactions',          created_by,    count(*)::int from public.transactions        where created_by    in (select id from target_uids) group by created_by
      union all select 'investments',           created_by,    count(*)::int from public.investments         where created_by    in (select id from target_uids) group by created_by
      union all select 'budgets',               user_id,       count(*)::int from public.budgets             where user_id       in (select id from target_uids) group by user_id
      union all select 'bank_balance_history',  changed_by,    count(*)::int from public.bank_balance_history where changed_by   in (select id from target_uids) group by changed_by
      union all select 'bank_reconciliation',   reconciled_by, count(*)::int from public.bank_reconciliation where reconciled_by in (select id from target_uids) group by reconciled_by
      union all select 'audit_log',             user_id,       count(*)::int from public.audit_log           where user_id       in (select id from target_uids) group by user_id
      union all select 'subscriptions',         user_id,       count(*)::int from public.subscriptions       where user_id       in (select id from target_uids) group by user_id
    )
    select tbl, owner_uid, n from counts order by owner_uid, tbl
  loop
    raise notice '  %  |  uid=%  |  rows=%', rpad(rec.tbl, 22), rec.owner_uid, rec.n;
  end loop;

  raise notice '';
  raise notice '===== which uid will the merge keep? =====';
  for rec in
    select id, last_sign_in_at, created_at,
           row_number() over (order by coalesce(last_sign_in_at, created_at) desc) as rank
    from auth.users
    where lower(email) = lower(target_email)
  loop
    raise notice '  rank=%  uid=%  last_sign_in=%  (rank 1 = keeper)',
      rec.rank, rec.id, rec.last_sign_in_at;
  end loop;
end $$;
