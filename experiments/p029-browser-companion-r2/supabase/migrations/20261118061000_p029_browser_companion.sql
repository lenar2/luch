-- P029 Browser Companion cloud relay: account/device/job isolation.
create extension if not exists pgcrypto;

create table if not exists public.p029_browser_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null check (char_length(device_name) between 1 and 80),
  token_hash text not null unique,
  browser text not null default 'unknown' check (char_length(browser) between 1 and 40),
  extension_version text not null default 'unknown' check (char_length(extension_version) between 1 and 40),
  status text not null default 'active' check (status in ('active','revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

create index if not exists p029_browser_devices_user_idx
  on public.p029_browser_devices(user_id);
create index if not exists p029_browser_devices_token_idx
  on public.p029_browser_devices(token_hash);

create table if not exists public.p029_browser_pairings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  device_name text not null check (char_length(device_name) between 1 and 80),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists p029_browser_pairings_user_idx
  on public.p029_browser_pairings(user_id, created_at desc);
create index if not exists p029_browser_pairings_code_idx
  on public.p029_browser_pairings(code_hash);

create table if not exists public.p029_browser_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.p029_browser_devices(id) on delete cascade,
  tab_id bigint not null,
  grant_id text not null,
  origin text not null check (origin ~ '^https?://'),
  url_redacted text,
  title text,
  scope text not null check (scope in ('read','interact')),
  precise_cursor boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(device_id, tab_id)
);

create index if not exists p029_browser_grants_user_idx
  on public.p029_browser_grants(user_id);
create index if not exists p029_browser_grants_device_idx
  on public.p029_browser_grants(device_id);

create table if not exists public.p029_browser_tab_overviews (
  device_id uuid primary key references public.p029_browser_devices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  tabs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists p029_browser_tab_overviews_user_idx
  on public.p029_browser_tab_overviews(user_id);

create table if not exists public.p029_browser_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.p029_browser_devices(id) on delete cascade,
  tool_name text not null check (char_length(tool_name) between 1 and 80),
  op text not null check (char_length(op) between 1 and 80),
  target_id text,
  args jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','claimed','completed','failed','expired','cancelled')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  lease_until timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '90 seconds')
);

create index if not exists p029_browser_jobs_device_pending_idx
  on public.p029_browser_jobs(device_id, status, created_at);
create index if not exists p029_browser_jobs_user_idx
  on public.p029_browser_jobs(user_id, created_at desc);
create index if not exists p029_browser_jobs_expires_idx
  on public.p029_browser_jobs(expires_at);

create table if not exists public.p029_browser_audit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.p029_browser_devices(id) on delete set null,
  tool_name text not null,
  op text,
  target_origin text,
  outcome text not null,
  created_at timestamptz not null default now()
);

create index if not exists p029_browser_audit_user_idx
  on public.p029_browser_audit_events(user_id, created_at desc);

-- Defense in depth: the Data API never needs anonymous access to these tables.
alter table public.p029_browser_devices enable row level security;
alter table public.p029_browser_pairings enable row level security;
alter table public.p029_browser_grants enable row level security;
alter table public.p029_browser_tab_overviews enable row level security;
alter table public.p029_browser_jobs enable row level security;
alter table public.p029_browser_audit_events enable row level security;

revoke all on table public.p029_browser_devices from anon, authenticated;
revoke all on table public.p029_browser_pairings from anon, authenticated;
revoke all on table public.p029_browser_grants from anon, authenticated;
revoke all on table public.p029_browser_tab_overviews from anon, authenticated;
revoke all on table public.p029_browser_jobs from anon, authenticated;
revoke all on table public.p029_browser_audit_events from anon, authenticated;

-- User-facing MCP operations use service_role only after withSupabase has
-- authenticated the caller. The user never receives direct table grants.
grant select on table public.p029_browser_devices to authenticated;
grant select on table public.p029_browser_pairings to authenticated;
grant select on table public.p029_browser_grants to authenticated;
grant select on table public.p029_browser_tab_overviews to authenticated;
grant select on table public.p029_browser_jobs to authenticated;
grant select on table public.p029_browser_audit_events to authenticated;

create policy "P029 users read own devices"
on public.p029_browser_devices for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "P029 users read own pairings"
on public.p029_browser_pairings for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "P029 users read own grants"
on public.p029_browser_grants for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "P029 users read own tab overview"
on public.p029_browser_tab_overviews for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "P029 users read own jobs"
on public.p029_browser_jobs for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "P029 users read own audit"
on public.p029_browser_audit_events for select
to authenticated
using ((select auth.uid()) = user_id);
