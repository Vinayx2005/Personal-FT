-- Diagnostic (READ ONLY — no writes) for the "my data is gone" bug.
--
-- Symptom: user signs in, sees an empty dashboard, but their rows are
-- still in the DB. Almost always caused by TWO auth.users rows for the
-- same email (email/password signup vs. Google OAuth signup — Supabase
-- gives each a different uid, so RLS filtering by auth.uid() returns
-- nothing).
--
-- To run: paste ALL of this into the Supabase SQL editor and click Run.
-- Three result blocks come back stacked in the Results panel.

-- ============================================================================
-- QUERY 1 — every auth.users row for this email
-- ============================================================================
select
  id                                     as uid,
  email,
  created_at,
  last_sign_in_at,
  raw_app_meta_data->>'provider'         as primary_provider,
  raw_app_meta_data->'providers'         as all_providers,
  (email_confirmed_at is not null)       as email_confirmed
from auth.users
where lower(email) = lower('vinayteja23@gmail.com')
order by created_at;

-- ============================================================================
-- QUERY 2 — row counts per uid across every user-owned table
-- (any uid appearing here that ISN'T in Query 1's results = orphaned data)
-- ============================================================================
with target_uids as (
  select id from auth.users
  where lower(email) = lower('vinayteja23@gmail.com')
)
select 'users'                as tbl, id            as owner_uid, 1::bigint as row_count
  from public.users             where id            in (select id from target_uids)
union all
select 'banks',                 user_id,       count(*) from public.banks               where user_id       in (select id from target_uids) group by user_id
union all
select 'categories',            user_id,       count(*) from public.categories          where user_id       in (select id from target_uids) group by user_id
union all
select 'monthly_balances',      user_id,       count(*) from public.monthly_balances    where user_id       in (select id from target_uids) group by user_id
union all
select 'transactions',          created_by,    count(*) from public.transactions        where created_by    in (select id from target_uids) group by created_by
union all
select 'investments',           created_by,    count(*) from public.investments         where created_by    in (select id from target_uids) group by created_by
union all
select 'budgets',               user_id,       count(*) from public.budgets             where user_id       in (select id from target_uids) group by user_id
union all
select 'bank_balance_history',  changed_by,    count(*) from public.bank_balance_history where changed_by   in (select id from target_uids) group by changed_by
union all
select 'bank_reconciliation',   reconciled_by, count(*) from public.bank_reconciliation where reconciled_by in (select id from target_uids) group by reconciled_by
union all
select 'audit_log',             user_id,       count(*) from public.audit_log           where user_id       in (select id from target_uids) group by user_id
union all
select 'subscriptions',         user_id,       count(*) from public.subscriptions       where user_id       in (select id from target_uids) group by user_id
order by owner_uid, tbl;

-- ============================================================================
-- QUERY 3 — which uid will the merge keep? (rank 1 = keeper)
-- ============================================================================
select
  row_number() over (order by coalesce(last_sign_in_at, created_at) desc) as rank,
  id                as uid,
  last_sign_in_at,
  created_at,
  case when row_number() over (order by coalesce(last_sign_in_at, created_at) desc) = 1
       then 'KEEPER' else 'loser' end as role
from auth.users
where lower(email) = lower('vinayteja23@gmail.com')
order by rank;
