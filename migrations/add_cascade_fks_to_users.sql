-- Root-cause fix for the "my data is gone" bug.
--
-- Before this migration:
--   * public.users.id has NO FK to auth.users
--   * child tables (banks/categories/transactions/investments/monthly_balances)
--     reference public.users(id) with NO ON DELETE clause
--   * some columns had DUPLICATE FKs on the same column from historical
--     migrations (e.g. investments.created_by had two FKs)
-- Consequence: deleting a row from auth.users (via Supabase Dashboard, a
-- Postgres client, or anywhere else) leaves public.users AND every child
-- row silently orphaned. RLS then hides the data from the user forever.
--
-- After this migration:
--   * public.users.id has FK → auth.users(id) ON DELETE CASCADE
--   * every ownership FK on child tables is ON DELETE CASCADE
--   * nullable audit-y columns (bank_balance_history.changed_by,
--     bank_reconciliation.reconciled_by, audit_log.user_id) are ON DELETE
--     SET NULL so system events survive the user
--   * duplicate NO ACTION FKs are dropped
--
-- Safe to re-run. Everything is wrapped in one transaction — nothing
-- changes if any step fails.
--
-- To run: paste into Supabase SQL editor and execute.

begin;

-- =============================================================================
-- STEP 0 — cascade-delete orphaned profiles (public.users rows whose auth is gone)
-- Their children must go first because the FKs still have NO ACTION here.
-- CTEs are repeated per statement because Postgres CTEs are scoped to one query.
-- =============================================================================
with orphans as (select id from public.users where id not in (select id from auth.users))
delete from public.transactions        where created_by    in (select id from orphans);
with orphans as (select id from public.users where id not in (select id from auth.users))
delete from public.investments         where created_by    in (select id from orphans);
with orphans as (select id from public.users where id not in (select id from auth.users))
delete from public.banks               where user_id       in (select id from orphans);
with orphans as (select id from public.users where id not in (select id from auth.users))
delete from public.categories          where user_id       in (select id from orphans);
with orphans as (select id from public.users where id not in (select id from auth.users))
delete from public.monthly_balances    where user_id       in (select id from orphans);
with orphans as (select id from public.users where id not in (select id from auth.users))
delete from public.budgets             where user_id       in (select id from orphans);
with orphans as (select id from public.users where id not in (select id from auth.users))
update public.bank_balance_history set changed_by    = null where changed_by    in (select id from orphans);
with orphans as (select id from public.users where id not in (select id from auth.users))
update public.bank_reconciliation  set reconciled_by = null where reconciled_by in (select id from orphans);
with orphans as (select id from public.users where id not in (select id from auth.users))
update public.audit_log            set user_id       = null where user_id       in (select id from orphans);

delete from public.users where id not in (select id from auth.users);

-- =============================================================================
-- STEP 1 — public.users.id → auth.users(id) ON DELETE CASCADE
-- =============================================================================
alter table public.users drop constraint if exists users_id_fkey;
alter table public.users
  add constraint users_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- =============================================================================
-- STEP 2 — the "known" child FKs get the right rule
-- =============================================================================
alter table public.banks drop constraint if exists banks_user_id_fkey;
alter table public.banks add constraint banks_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

alter table public.categories drop constraint if exists categories_user_id_fkey;
alter table public.categories add constraint categories_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

alter table public.monthly_balances drop constraint if exists monthly_balances_user_id_fkey;
alter table public.monthly_balances add constraint monthly_balances_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

alter table public.transactions drop constraint if exists transactions_created_by_fkey;
alter table public.transactions add constraint transactions_created_by_fkey
  foreign key (created_by) references public.users(id) on delete cascade;

alter table public.investments drop constraint if exists investments_created_by_fkey;
alter table public.investments add constraint investments_created_by_fkey
  foreign key (created_by) references public.users(id) on delete cascade;

alter table public.bank_balance_history drop constraint if exists bank_balance_history_changed_by_fkey;
alter table public.bank_balance_history add constraint bank_balance_history_changed_by_fkey
  foreign key (changed_by) references public.users(id) on delete set null;

alter table public.bank_reconciliation drop constraint if exists bank_reconciliation_reconciled_by_fkey;
alter table public.bank_reconciliation add constraint bank_reconciliation_reconciled_by_fkey
  foreign key (reconciled_by) references public.users(id) on delete set null;

alter table public.audit_log drop constraint if exists audit_log_user_id_fkey;
alter table public.audit_log add constraint audit_log_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;

-- =============================================================================
-- STEP 3 — sweep any REMAINING NO ACTION FKs to public.users
-- (Historical migrations left duplicate FKs on some columns under non-default
-- constraint names; the ALTER…IF EXISTS above only catches the default name.)
-- =============================================================================
do $$
declare
  r record;
  has_cascade boolean;
begin
  for r in
    select tc.constraint_name, tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
    join information_schema.referential_constraints rc
      on rc.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema    = 'public'
      and ccu.table_schema   = 'public'
      and ccu.table_name     = 'users'
      and rc.delete_rule     = 'NO ACTION'
  loop
    -- Is there already a non-NO-ACTION FK on this same (table, column)?
    select exists (
      select 1
      from information_schema.table_constraints tc2
      join information_schema.key_column_usage kcu2
        on tc2.constraint_name = kcu2.constraint_name
      join information_schema.referential_constraints rc2
        on rc2.constraint_name = tc2.constraint_name
      where tc2.constraint_type = 'FOREIGN KEY'
        and tc2.table_schema    = 'public'
        and tc2.table_name      = r.table_name
        and kcu2.column_name    = r.column_name
        and rc2.delete_rule    <> 'NO ACTION'
    ) into has_cascade;

    if has_cascade then
      -- Just drop the redundant NO ACTION duplicate.
      execute format('alter table public.%I drop constraint %I',
                     r.table_name, r.constraint_name);
    else
      -- Replace it with the right rule for that column.
      execute format('alter table public.%I drop constraint %I',
                     r.table_name, r.constraint_name);
      if (r.table_name, r.column_name) in (
        ('bank_balance_history','changed_by'),
        ('bank_reconciliation','reconciled_by'),
        ('audit_log','user_id')
      ) then
        execute format(
          'alter table public.%I add constraint %I foreign key (%I) references public.users(id) on delete set null',
          r.table_name, r.constraint_name, r.column_name);
      else
        execute format(
          'alter table public.%I add constraint %I foreign key (%I) references public.users(id) on delete cascade',
          r.table_name, r.constraint_name, r.column_name);
      end if;
    end if;
  end loop;
end $$;

commit;

-- =============================================================================
-- Verify — every ownership FK should be CASCADE (or SET NULL for the nullable
-- audit-y columns). Any row still showing NO ACTION means the sweep missed
-- something — inspect and fix manually.
-- =============================================================================
select
  tc.table_name,
  kcu.column_name,
  ccu.table_schema || '.' || ccu.table_name as references_table,
  tc.constraint_name,
  rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and ccu.table_schema in ('public','auth')
  and ccu.table_name  = 'users'
order by tc.table_name, kcu.column_name;
