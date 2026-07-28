-- Track which lifecycle emails have already been sent so the daily cron
-- doesn't re-send the same reminder every morning.
--
-- To run: paste into Supabase SQL editor and execute once.

alter table public.subscriptions
  add column if not exists welcome_sent_at      timestamptz,
  add column if not exists reminder_3d_sent_at  timestamptz,
  add column if not exists reminder_2d_sent_at  timestamptz,
  add column if not exists reminder_1d_sent_at  timestamptz;
