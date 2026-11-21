# P029 R12 — ChatGPT-only connection handoff (18 Nov 2026)

**Engineering stage:** private 0.7.0 candidate / **RELEASE HOLD**.  
**Product:** Tools for the user's existing ChatGPT. No mandatory separate LUCH chat, no user-supplied OpenAI API key and no paid API/agent mode.  
**Explicit user constraints:** NO CLAUDE E2E. NO GITHUB ACTIONS. Keep PR draft; no stores or customer rollout.

## Implemented and verified

1. Removed both active P029 workflow YAML files from `.github/workflows` on the PR branch; GitHub tree verified empty. This prevents new workflow runs from future P029 commits.
2. Remote MCP: `https://api.lenarsalimov.ru/luch/browser/mcp` on TLS 443, with OAuth protected-resource metadata pointing to the Supabase Auth issuer.
3. Supabase Edge Function `p029-browser-companion` deployed ACTIVE **version 4**, code blob SHA `fb217d5027311734aba56276259ae1e0fa470252`.
4. The authenticated-user MCP and paired-device bearer are strictly separate. Device pairing issues a random 256-bit token, stores its hash only and consumes a single-use eight-digit code after at most 10 minutes.
5. Fixed a blocking live protocol mismatch: Postgres `target_id` is mapped to the exact extension protocol `targetId`, so an approved extension job is addressable.
6. A claimed job is never auto-requeued: a dropped response cannot result in a repeated browser click/type action. Lease/expiration guards reject late results.
7. Public pairing attempts are rate-limited with an atomic Postgres service-only RPC: max 18 per Cloudflare client IP bucket in 10 minutes and a separate global bucket max 240 in 10 minutes. No plaintext client IP is persisted. Unknown IP uses one fail-closed shared bucket.
8. Removed direct authenticated/anonymous SELECT access to all P029 sensitive tables, including pairing-code hashes, token hashes, queued jobs and page results. Seven tables show RLS enabled, authenticated SELECT=false, service_role SELECT=true. The exact MCP handler still validates user_id/device_id/tab grants.
9. Updated RU/EN extension pairing copy for cloud routing, correct ten-minute code lifetime and no local Companion prerequisite. Cloud host permission is restricted to `https://api.lenarsalimov.ru/luch/browser/*`.
10. Updated the candidate privacy disclosure to explicitly describe off-computer page data processing and unfinished retention policy (nothing presented as published store policy).

## Exact local LUCH Server tests

Executed on the LUCH internal server, not GitHub Actions:

- `node --test tests/*.test.mjs`: **32/32 PASS**.
- `node security-qa.mjs`: **21/21 PASS** (these are mainly the **legacy local-broker** negative tests, not a cloud tenant-isolation E2E).
- `deno check --node-modules-dir=auto supabase/functions/p029-browser-companion/index.ts`: PASS.
- `bash package.sh`: PASS, private deterministic package:
  - `dist/LUCH-Browser-Companion-v0.7.0.zip`
  - SHA-256: `09e39eec1909ec0c0091cf55857be301c9db3e6eb37df26375c4f2fdb218dd78`
  - Internal build path: `/srv/factory-scratch/p029-r12-exact-build/experiments/p029-browser-companion-r2/dist/`
  - Package is **NOT** an approved release or public download.
- Public smoke tests: MCP metadata HTTP 200, unauthenticated device jobs/grants/results HTTP 401, invalid OAuth bearer HTTP 401, invalid pairing code HTTP 403 (rate-limit RPC confirmed operational), public health HTTP 200.
- Supabase Auth authorization-server discovery advertises S256 PKCE, authorization code + refresh token and dynamic registration.

## What happened in the actual existing ChatGPT

Using the LUCH-managed Chrome isolated session with an existing **ChatGPT Plus** account, opened Plugins > Add > Add custom MCP server and entered:
`https://api.lenarsalimov.ru/luch/browser/mcp`

Created a private draft **LUCH Browser Companion R12 TEST** and reached ChatGPT's own **Connect LUCH Browser Companion R12 TEST** consent dialog. This is not an authenticated plugin connection. **The owner's required Connect action was intentionally not performed**, and no OAuth login, MCP tool listing or authorized browser action has been established. The test modal is specific to the paired browser session and may not be visible in another ChatGPT client.

## Exact next ChatGPT-only E2E

1. The owner explicitly grants ChatGPT connection consent in their authenticated ChatGPT client.
2. Inspect the actual Supabase OAuth browser redirect and authorization/consent UI. If the registered authorization path is missing, implement it on the established LUCH site and verify login + denial + approval, without bypass tokens.
3. Ask the existing ChatGPT to list LUCH Browser Companion tools and invoke `browser_companion_status`, then `browser_companion_pairing_create` if permitted by this user's plan.
4. Install the exact private 0.7.0 extension into a **disposable Chromium profile**, not the owner's production browser profile. Pair using the user-generated code; check the device appears only for that owner.
5. In a synthetic fixture tab approve read, call `browser_read_text`. Separately approve interaction, call `browser_click` or `browser_pointer_click`, verify physical DOM effect; then revoke and prove subsequent denial.
6. Second owner/account and device negative tests: cross-tenant/device ID rejection, stale target ID, revoked grant, changed origin and lost acknowledgement.
7. Independent Chrome/Opera permission UX, store graphics and packaging audit, final data retention/purge policy.

**Never substitute tests in Claude, bypass the ChatGPT consent prompt, assume write-capable custom MCP on Plus, publish the ZIP, use GitHub Actions or switch production Mac Bridge.**

## Release decision

**HOLD**. The transport and isolated security components are materially improved; an owner-approved positive ChatGPT→OAuth→MCP→device→approved-tab E2E is still missing.
