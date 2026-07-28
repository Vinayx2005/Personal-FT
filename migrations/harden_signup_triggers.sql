-- Signup was failing with "Database error saving new user" because one of
-- the ON-auth.users-INSERT triggers was throwing (bad insert, missing table,
-- constraint conflict). Any exception aborts the whole auth signup and
-- Supabase redirects the user to `/dashboard?error=server_error&error_description=Database+error+saving+new+user`.
--
-- Fix: wrap both trigger bodies in EXCEPTION handlers so a per-user seeding
-- failure logs a warning but never blocks the signup itself. The app can
-- always self-heal the missing rows later (categories auto-create on first
-- use; subscriptions are backfilled here at the end).
--
-- Also re-runs the backfill so any users who signed up in the broken window
-- get their subscription row.
--
-- To run: paste into Supabase SQL editor and execute.

-- ---------- 1. Harden the app-users + default-categories trigger ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.users (id, email, full_name)
    values (
      new.id,
      new.email,
      coalesce(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
      )
    )
    on conflict (id) do nothing;
  exception when others then
    raise warning 'handle_new_user users-insert failed for %: %', new.id, sqlerrm;
  end;

  begin
    insert into public.categories (type, name, user_id, is_default) values
      ('expense', 'Food & Groceries', new.id, true),
      ('expense', 'Rent',             new.id, true),
      ('expense', 'Transport',        new.id, true),
      ('expense', 'Utilities',        new.id, true),
      ('expense', 'Entertainment',    new.id, true),
      ('expense', 'Shopping',         new.id, true),
      ('expense', 'Health',           new.id, true),
      ('expense', 'Others',           new.id, true),
      ('income',  'Salary',           new.id, true),
      ('income',  'Freelance',        new.id, true),
      ('income',  'Others',           new.id, true)
    on conflict do nothing;
  exception when others then
    raise warning 'handle_new_user categories-seed failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

-- ---------- 2. Harden the subscriptions trigger ----------
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.subscriptions (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  exception when others then
    raise warning 'handle_new_user_subscription failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- ---------- 3. Backfill any users left without a subscription row ----------
insert into public.subscriptions (user_id)
select id from auth.users
on conflict (user_id) do nothing;
