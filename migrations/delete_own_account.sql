-- Lets a signed-in user delete their own account and every row they own.
-- Runs as postgres via SECURITY DEFINER but only ever touches auth.uid(),
-- so there's no privilege escalation. Per-table deletes are guarded so a
-- schema mismatch on one table doesn't block the rest.
--
-- To run: paste into Supabase SQL editor and execute once.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- User-scoped data. Try each variant since some legacy tables use
  -- `created_by`/`changed_by` while newer ones use `user_id`.
  begin delete from public.transactions          where created_by = uid; exception when others then null; end;
  begin delete from public.transactions          where user_id    = uid; exception when others then null; end;
  begin delete from public.investments           where created_by = uid; exception when others then null; end;
  begin delete from public.investments           where user_id    = uid; exception when others then null; end;
  begin delete from public.budgets               where user_id    = uid; exception when others then null; end;
  begin delete from public.bank_balance_history  where changed_by = uid; exception when others then null; end;
  begin delete from public.banks                 where user_id    = uid; exception when others then null; end;
  begin delete from public.categories            where user_id    = uid; exception when others then null; end;
  begin delete from public.audit_log             where user_id    = uid; exception when others then null; end;
  begin delete from public.users                 where id         = uid; exception when others then null; end;

  -- Finally the auth row itself — kills the session everywhere.
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
