-- One-shot recovery: vinayteja23@gmail.com's data is orphaned under a
-- deleted auth.users uid (d080143b-...) while the account they can log in
-- as today is a fresh Google OAuth uid (fc64f096-...). This moves every
-- row owned by the old uid onto the new one, then drops the orphaned
-- public.users row.
--
-- Diagnostic confirmed:
--   public.users row for d080143b has email=you@example.com, full_name=Teja
--   (the placeholder email is a leftover from the original single-user seed).
--   No auth.users row with id d080143b exists.
--
-- Safe to re-run; UPDATEs against zero rows are no-ops.
--
-- To run: paste into Supabase SQL editor and execute.

do $$
declare
  keeper uuid := 'fc64f096-ec5d-417e-b585-fb72828754e3';
  loser  uuid := 'd080143b-7022-489f-82d3-f7b934a179ef';
  n int;
begin
  -- ----- CATEGORIES ---------------------------------------------------------
  -- The keeper already has ~11 default categories seeded by the signup
  -- trigger. Repoint any transactions from a duplicate loser category to
  -- the keeper's equivalent BEFORE we delete the losing dupes.
  update public.transactions t
  set category_id = k.id
  from public.categories l
  join public.categories k
    on k.user_id = keeper
   and k.type    = l.type
   and lower(k.name) = lower(l.name)
  where t.category_id = l.id
    and l.user_id = loser;
  get diagnostics n = row_count;
  raise notice 'transactions.category_id repointed: %', n;

  delete from public.categories l
  where l.user_id = loser
    and exists (
      select 1 from public.categories k
      where k.user_id = keeper
        and k.type = l.type
        and lower(k.name) = lower(l.name)
    );
  get diagnostics n = row_count;
  raise notice 'duplicate loser categories deleted: %', n;

  update public.categories set user_id = keeper where user_id = loser;
  get diagnostics n = row_count;
  raise notice 'categories moved to keeper: %', n;

  -- ----- BANKS --------------------------------------------------------------
  update public.banks set user_id = keeper where user_id = loser;
  get diagnostics n = row_count;
  raise notice 'banks moved: %', n;

  -- ----- MONTHLY BALANCES ---------------------------------------------------
  update public.monthly_balances set user_id = keeper where user_id = loser;
  get diagnostics n = row_count;
  raise notice 'monthly_balances moved: %', n;

  -- ----- TRANSACTIONS -------------------------------------------------------
  update public.transactions set created_by = keeper where created_by = loser;
  get diagnostics n = row_count;
  raise notice 'transactions moved: %', n;

  -- ----- INVESTMENTS --------------------------------------------------------
  update public.investments set created_by = keeper where created_by = loser;
  get diagnostics n = row_count;
  raise notice 'investments moved: %', n;

  -- ----- BUDGETS (dedup on unique (user_id, category_id, month)) ------------
  delete from public.budgets l
  where l.user_id = loser
    and exists (
      select 1 from public.budgets k
      where k.user_id = keeper
        and k.category_id = l.category_id
        and k.month = l.month
    );
  update public.budgets set user_id = keeper where user_id = loser;
  get diagnostics n = row_count;
  raise notice 'budgets moved: %', n;

  -- ----- BANK BALANCE HISTORY / RECONCILIATION / AUDIT ----------------------
  update public.bank_balance_history set changed_by    = keeper where changed_by    = loser;
  update public.bank_reconciliation  set reconciled_by = keeper where reconciled_by = loser;
  update public.audit_log            set user_id       = keeper where user_id       = loser;

  -- ----- DROP ORPHANED public.users ROW -------------------------------------
  delete from public.users where id = loser;
  get diagnostics n = row_count;
  raise notice 'orphaned public.users row deleted: %', n;
end $$;

-- Sanity: what does the keeper own now?
select 'banks'         as tbl, count(*) from public.banks         where user_id    = 'fc64f096-ec5d-417e-b585-fb72828754e3'
union all
select 'categories',         count(*) from public.categories    where user_id    = 'fc64f096-ec5d-417e-b585-fb72828754e3'
union all
select 'transactions',       count(*) from public.transactions  where created_by = 'fc64f096-ec5d-417e-b585-fb72828754e3'
union all
select 'investments',        count(*) from public.investments   where created_by = 'fc64f096-ec5d-417e-b585-fb72828754e3'
union all
select 'budgets',            count(*) from public.budgets       where user_id    = 'fc64f096-ec5d-417e-b585-fb72828754e3';
