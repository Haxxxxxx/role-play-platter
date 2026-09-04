-- Guests never have a recoverable credential -- if the browser session is
-- lost, that specific anonymous account is gone for good (this is exactly
-- what happened testing the invite feature: 3 "Harlarr" guests nobody could
-- log back into). Rather than let these pile up forever, sweep out
-- anonymous accounts that have gone quiet and never converted to a real
-- account, on a schedule.
--
-- Safety: is_anonymous flips to false automatically the moment a guest
-- links a real identity (linkGoogleAccount), so this can never touch anyone
-- who upgraded. On top of that, a GM is explicitly excluded even if still
-- anonymous -- the whole point of the guest-first flow is "try before you
-- make an account," and a GM mid-campaign who hasn't gotten around to
-- linking yet must never have their campaign cascade-deleted out from
-- under them just for going quiet for a few weeks.
create extension if not exists pg_cron with schema extensions;

create or replace function cleanup_inactive_anonymous_users()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users
  where is_anonymous = true
    and coalesce(last_sign_in_at, created_at) < now() - interval '30 days'
    and id not in (select gm_id from campaigns);
end;
$$;

select cron.schedule(
  'cleanup-inactive-anonymous-users',
  '0 3 * * *', -- daily, 03:00 UTC
  $$select cleanup_inactive_anonymous_users();$$
);
