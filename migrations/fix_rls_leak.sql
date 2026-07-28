-- CRITICAL security fix — the previous `rls_permissive_policies.sql` created
-- `<table>_authenticated` policies with `USING (true)` that Postgres OR-combines
-- with the strict `_owner` policies, effectively granting every signed-in
-- user full read/write on everyone else's finances.
--
-- Drop the permissive policies. Owner-scoped policies from
-- `multi_user_migration.sql` remain and correctly restrict access to
-- `auth.uid() = user_id` per row.
--
-- To run: paste into Supabase SQL editor and execute once, then verify with
--   SELECT tablename, policyname FROM pg_policies WHERE schemaname='public';

drop policy if exists "banks_authenticated"                on public.banks;
drop policy if exists "categories_authenticated"           on public.categories;
drop policy if exists "bank_balance_history_authenticated" on public.bank_balance_history;
drop policy if exists "investments_authenticated"          on public.investments;
drop policy if exists "monthly_balances_authenticated"     on public.monthly_balances;
drop policy if exists "audit_log_authenticated"            on public.audit_log;
drop policy if exists "transactions_authenticated"         on public.transactions;

-- Also fix the storage bucket for receipts — the original policy allowed any
-- authenticated user to read/delete any receipt. Scope it to the uploader.
-- Uploads MUST be prefixed with `<user_id>/...` — the app code writes this.

drop policy if exists "receipts_authenticated"        on storage.objects;
drop policy if exists "Authenticated can read receipts" on storage.objects;
drop policy if exists "Authenticated can write receipts" on storage.objects;

create policy "receipts_read_own"
  on storage.objects for select
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "receipts_write_own"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "receipts_delete_own"
  on storage.objects for delete
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
