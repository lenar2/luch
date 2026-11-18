-- P029 R16: redeem a one-time code and create its paired device in ONE
-- database transaction. A row lock prevents parallel redeems; any error rolls
-- back BOTH the code consumption and the device insert.
--
-- This privileged function is callable ONLY through the service_role already
-- authenticated at the LUCH Edge Function boundary.
create or replace function public.p029_claim_pairing(
  p_code_hash text,
  p_token_hash text,
  p_device_name text,
  p_browser text,
  p_extension_version text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pair public.p029_browser_pairings%rowtype;
  v_name text;
  v_browser text;
  v_extension_version text;
  v_device_id uuid;
begin
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$'
     or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
  then
    return null;
  end if;

  select *
    into v_pair
    from public.p029_browser_pairings
   where code_hash = p_code_hash
     and used_at is null
     and expires_at > clock_timestamp()
     for update;
  if not found then
    return null;
  end if;

  v_name := coalesce(nullif(btrim(p_device_name), ''), v_pair.device_name);
  v_browser := coalesce(nullif(btrim(p_browser), ''), 'unknown');
  v_extension_version := coalesce(nullif(btrim(p_extension_version), ''), 'unknown');
  if char_length(v_name) not between 1 and 80
     or char_length(v_browser) > 40
     or char_length(v_extension_version) > 40
  then
    return null;
  end if;

  -- The transaction is fully atomic. A uniqueness or validation failure
  -- cannot leave either a consumed code or an orphaned device behind.
  insert into public.p029_browser_devices (
    user_id, device_name, token_hash, browser, extension_version, metadata
  ) values (
    v_pair.user_id, v_name, p_token_hash, v_browser, v_extension_version,
    pg_catalog.jsonb_build_object('pairedVia', 'p029_pairing_code')
  )
  returning id into v_device_id;

  update public.p029_browser_pairings
     set used_at = clock_timestamp()
   where id = v_pair.id
     and used_at is null;
  if not found then
    raise exception 'P029_PAIRING_CONCURRENT_CONFLICT';
  end if;

  return pg_catalog.jsonb_build_object(
    'deviceId', v_device_id,
    'deviceName', v_name
  );
end;
$$;
revoke all on function public.p029_claim_pairing(text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.p029_claim_pairing(text,text,text,text,text)
  to service_role;

comment on function public.p029_claim_pairing(text,text,text,text,text)
  is 'P029: service-role-only transactional one-time code redemption and device creation';
