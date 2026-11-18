-- P029 R12: authenticated MCP callers must not read pairing-code hashes,
-- device-token hashes, queued actions, or page results through PostgREST.
-- The server validates the OAuth caller, then uses service_role for exact
-- user + device scoped operations. RLS stays enabled as defense in depth.

revoke select on public.p029_browser_devices from authenticated;
revoke select on public.p029_browser_pairings from authenticated;
revoke select on public.p029_browser_grants from authenticated;
revoke select on public.p029_browser_tab_overviews from authenticated;
revoke select on public.p029_browser_jobs from authenticated;
revoke select on public.p029_browser_audit_events from authenticated;

revoke all on public.p029_browser_pair_rate from anon, authenticated;

-- No direct table grants for anonymous or authenticated users.
-- Only the Edge Function's service_role may access these tables.
