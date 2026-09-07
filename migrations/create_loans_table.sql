-- Loans — money the user borrowed and pays back over time. Each EMI
-- transaction can link to a loan via transactions.loan_id, which lets
-- the dashboard show the outstanding balance as principal minus the
-- sum of linked payments.
--
-- Safe to re-run — everything is IF NOT EXISTS.
-- Run in Supabase SQL editor.

create table if not exists public.loans (
  id             bigserial primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  principal      numeric(12, 2) not null check (principal > 0),
  emi_amount     numeric(12, 2),
  interest_rate  numeric(6, 3),
  tenure_months  int,
  start_date     date,
  lender         text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists loans_user_id_idx on public.loans(user_id);

-- Link column on transactions. NULLABLE — most transactions have no
-- loan; only EMI-category ones do. ON DELETE SET NULL so deleting a
-- loan doesn't cascade-wipe the user's EMI history.
alter table public.transactions
  add column if not exists loan_id bigint references public.loans(id) on delete set null;
create index if not exists transactions_loan_id_idx on public.transactions(loan_id)
  where loan_id is not null;

create or replace function public.loans_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists loans_set_updated_at on public.loans;
create trigger loans_set_updated_at before update on public.loans
  for each row execute function public.loans_set_updated_at();

alter table public.loans enable row level security;

drop policy if exists "loans_select_own" on public.loans;
create policy "loans_select_own" on public.loans
  for select using (auth.uid() = user_id);

drop policy if exists "loans_insert_own" on public.loans;
create policy "loans_insert_own" on public.loans
  for insert with check (auth.uid() = user_id);

drop policy if exists "loans_update_own" on public.loans;
create policy "loans_update_own" on public.loans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "loans_delete_own" on public.loans;
create policy "loans_delete_own" on public.loans
  for delete using (auth.uid() = user_id);
