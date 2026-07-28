-- Subscriptions: one row per user with 7-day trial + paid state.
-- Auto-created for every new signup via a trigger. Only the server-side
-- verify route (with service_role key) can flip `is_paid` — user-facing
-- policies allow SELECT only.
--
-- To run: paste into Supabase SQL editor and execute once.

create table if not exists public.subscriptions (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  trial_ends_at       timestamptz not null default (now() + interval '7 days'),
  is_paid             boolean not null default false,
  paid_at             timestamptz,
  amount              numeric(10, 2),
  razorpay_order_id   text,
  razorpay_payment_id text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists subscriptions_trial_ends_idx on public.subscriptions (trial_ends_at);

-- Auto-create a subscription row for every new auth user (7-day trial).
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_user_subscription();

-- Backfill for existing users so nobody gets locked out.
insert into public.subscriptions (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- RLS: user can read their own row; only server (service_role) can update.
alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_read_own" on public.subscriptions;
create policy "subscriptions_read_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- (No insert / update / delete policies for the anon or authenticated role —
-- those bypass RLS via service_role in the /api/razorpay/verify route.)
