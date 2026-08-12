-- SIPs (Systematic Investment Plans) — recurring auto-debits into an
-- investment. Every day, the /api/cron/sip-debit endpoint scans this table
-- and, for any row whose next_debit_date has arrived, inserts an expense
-- transaction from the source bank and (if linked) adds the amount to the
-- investment's cumulative value. Users still set up the actual auto-debit
-- with their bank or mutual-fund provider — this table is Personal FT's
-- record-keeping layer that keeps expenses + investments in sync without
-- manual entry each month.
--
-- Safe to re-run — everything is IF NOT EXISTS or ON CONFLICT DO NOTHING.
--
-- To run: paste into Supabase SQL editor and execute.

create table if not exists public.sips (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  investment_id   bigint references public.investments(id) on delete set null,
  name            text not null,
  amount          numeric(12, 2) not null check (amount > 0),
  frequency       text not null check (frequency in ('monthly', 'weekly', 'quarterly')),
  -- debit_day: 1-31 for monthly (clamped to month length at debit time),
  --            1-7  for weekly  (1 = Monday, 7 = Sunday),
  --            1-31 for quarterly (same as monthly semantics).
  debit_day       int not null check (debit_day between 1 and 31),
  source_bank_id  bigint not null references public.banks(id),
  -- category_id used when we auto-create the debit transaction so it lands
  -- under the user's chosen expense category (usually "Investments" or "SIP").
  category_id     bigint references public.categories(id),
  start_date      date not null,
  end_date        date,
  -- Precomputed so the cron can index-scan for due rows instead of computing
  -- schedules row-by-row. Updated after every successful debit.
  next_debit_date date not null,
  is_active       boolean not null default true,
  last_debited_at timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists sips_user_id_idx        on public.sips(user_id);
create index if not exists sips_next_debit_idx     on public.sips(next_debit_date) where is_active = true;
create index if not exists sips_investment_id_idx  on public.sips(investment_id);

-- Keep updated_at fresh
create or replace function public.sips_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists sips_set_updated_at on public.sips;
create trigger sips_set_updated_at
  before update on public.sips
  for each row execute function public.sips_set_updated_at();

-- RLS — each user only touches their own SIPs.
alter table public.sips enable row level security;

drop policy if exists "sips_select_own" on public.sips;
create policy "sips_select_own" on public.sips
  for select using (auth.uid() = user_id);

drop policy if exists "sips_insert_own" on public.sips;
create policy "sips_insert_own" on public.sips
  for insert with check (auth.uid() = user_id);

drop policy if exists "sips_update_own" on public.sips;
create policy "sips_update_own" on public.sips
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sips_delete_own" on public.sips;
create policy "sips_delete_own" on public.sips
  for delete using (auth.uid() = user_id);
