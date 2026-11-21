-- R12: atomic fail-closed rate limiting for public one-time pairing codes.
-- No plaintext IP addresses, pairing codes, or device tokens are stored.
create table if not exists public.p029_browser_pair_rate (
  bucket_key text primary key check (length(bucket_key) between 1 and 100),
  attempts integer not null default 0,
  window_expires_at timestamptz not null
);

alter table public.p029_browser_pair_rate enable row level security;
revoke all on public.p029_browser_pair_rate from public, anon, authenticated;
-- No client RLS policies: only the service-role RPC can touch these counters.

create or replace function public.p029_pair_attempt_allowed(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
begin
  if p_key is null or length(p_key) not between 1 and 100
     or p_limit not between 1 and 1000
     or p_window_seconds not between 30 and 86400
  then
    return false;
  end if;
  insert into public.p029_browser_pair_rate as buckets (bucket_key, attempts, window_expires_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (bucket_key) do update
    set attempts = case when buckets.window_expires_at <= now() then 1
                        else buckets.attempts + 1 end,
        window_expires_at = case when buckets.window_expires_at <= now()
                                 then now() + make_interval(secs => p_window_seconds)
                                 else buckets.window_expires_at end
  returning attempts into v_attempts;
  return v_attempts <= p_limit;
exception when others then
  -- Fail closed on database failures, including counter overflow.
  return false;
end;
$$;

revoke execute on function public.p029_pair_attempt_allowed(text,integer,integer) from public, anon, authenticated;
grant execute on function public.p029_pair_attempt_allowed(text,integer,integer) to service_role;

comment on function public.p029_pair_attempt_allowed(text,integer,integer)
  is 'P029: atomic fixed-window pairing attempt limiter, service_role only';
