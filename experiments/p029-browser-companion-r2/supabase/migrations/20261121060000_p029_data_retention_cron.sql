-- P029 R17: enforce bounded retention for browser content and pairing data.
-- This is a private candidate migration, not a public release signal.
-- Uses the supported Supabase pg_cron mechanism and touches ONLY P029 tables.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.p029_cleanup_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Expired/abandoned commands are never replayed.
  update public.p029_browser_jobs
     set status = 'expired',
         args = '{}'::jsonb,
         result = null,
         error = 'JOB_EXPIRED',
         completed_at = coalesce(completed_at, now())
   where status in ('pending','claimed')
     and expires_at < now();

  -- Job payloads (potential page content or form inputs) are short-lived.
  delete from public.p029_browser_jobs
   where created_at < now() - interval '15 minutes';

  -- Pairing-code hashes are not retained indefinitely.
  delete from public.p029_browser_pairings
   where expires_at < now() - interval '1 day'
      or used_at < now() - interval '1 day';

  -- Remove rate-limit buckets that no longer contribute to security.
  delete from public.p029_browser_pair_rate
   where window_expires_at < now() - interval '1 hour';

  -- Remove metadata/grants for disconnected browsers. The extension must
  -- explicitly re-publish grants on reconnect; stale metadata cannot revive.
  delete from public.p029_browser_tab_overviews
   where updated_at < now() - interval '24 hours';

  delete from public.p029_browser_grants g
    using public.p029_browser_devices d
   where g.device_id=d.id
     and (d.last_seen_at is null or d.last_seen_at < now() - interval '24 hours');

  -- Keep only short security-incident history, with no browser payloads.
  delete from public.p029_browser_audit_events
   where created_at < now() - interval '30 days';

  -- Revoked devices remain visible briefly for audit, then are purged.
  delete from public.p029_browser_devices
   where status='revoked'
     and revoked_at < now() - interval '30 days';
end;
$$;

revoke all on function public.p029_cleanup_data() from public, anon, authenticated;
grant execute on function public.p029_cleanup_data() to postgres;

select cron.schedule(
 'p029-browser-companion-retention',
 '*/5 * * * *',
 'select public.p029_cleanup_data();'
);
