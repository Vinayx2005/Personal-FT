-- Receivables — money owed TO the user by other people. Two lifecycle
-- states: unreceived (received_date is null) and received. Unreceived
-- rows are treated as an asset that adds to the dashboard's Current
-- Balance so the user's total wealth reflects money in flight.
--
-- Safe to re-run — everything is IF NOT EXISTS or ON CONFLICT DO NOTHING.
-- To run: paste into Supabase SQL editor and execute.

create table if not exists public.receivables (
  id             bigserial primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  from_name      text not null,
  amount         numeric(12, 2) not null check (amount > 0),
  -- When the loan/advance was given.
  given_date     date not null default (current_date at time zone 'Asia/Kolkata'),
  -- When the money came back. Null until marked received.
  received_date  date,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists receivables_user_id_idx     on public.receivables(user_id);
create index if not exists receivables_pending_idx     on public.receivables(user_id) where received_date is null;

create or replace function public.receivables_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists receivables_set_updated_at on public.receivables;
create trigger receivables_set_updated_at
  before update on public.receivables
  for each row execute function public.receivables_set_updated_at();

-- RLS — each user only touches their own receivables.
alter table public.receivables enable row level security;

drop policy if exists "receivables_select_own" on public.receivables;
create policy "receivables_select_own" on public.receivables
  for select using (auth.uid() = user_id);

drop policy if exists "receivables_insert_own" on public.receivables;
create policy "receivables_insert_own" on public.receivables
  for insert with check (auth.uid() = user_id);

drop policy if exists "receivables_update_own" on public.receivables;
create policy "receivables_update_own" on public.receivables
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "receivables_delete_own" on public.receivables;
create policy "receivables_delete_own" on public.receivables
  for delete using (auth.uid() = user_id);
