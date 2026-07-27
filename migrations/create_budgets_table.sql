-- Budgets — one row per (user, category, month).
-- Amount is the monthly budget the user set for that category.
-- Actual spend is computed at read time from transactions (not stored here).
--
-- To run: paste this into Supabase SQL editor and execute.

create table if not exists public.budgets (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  category_id   bigint not null references public.categories(id) on delete cascade,
  -- First day of the month the budget applies to (e.g. 2026-07-01 for Jul 2026).
  month         date not null,
  amount        numeric(12, 2) not null check (amount >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, category_id, month)
);

create index if not exists budgets_user_month_idx on public.budgets (user_id, month);
create index if not exists budgets_user_category_idx on public.budgets (user_id, category_id);

-- Keep updated_at fresh on updates
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists budgets_set_updated_at on public.budgets;
create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- Row Level Security — each user only sees their own budgets
alter table public.budgets enable row level security;

drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own"
  on public.budgets for select
  using (auth.uid() = user_id);

drop policy if exists "budgets_insert_own" on public.budgets;
create policy "budgets_insert_own"
  on public.budgets for insert
  with check (auth.uid() = user_id);

drop policy if exists "budgets_update_own" on public.budgets;
create policy "budgets_update_own"
  on public.budgets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_delete_own"
  on public.budgets for delete
  using (auth.uid() = user_id);
