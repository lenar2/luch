# P029 Browser Companion R11 — remote MCP bridge

**Status: deployed engineering candidate / RELEASE HOLD**

## Public endpoint

**MCP:** `https://api.lenarsalimov.ru/luch/browser/mcp`

**OAuth Protected Resource Metadata:** `https://api.lenarsalimov.ru/.well-known/oauth-protected-resource/luch/browser/mcp`

The endpoint is public on TCP 443 and returns RFC 9728 metadata advertising the LUCH Supabase Auth issuer. Unauthenticated MCP requests return HTTP 401 with the matching `WWW-Authenticate: Bearer resource_metadata=...` challenge.

## Architecture

```
Existing ChatGPT / Claude / other MCP host
        │ OAuth 2.1 / Supabase Auth
        ▼
https://api.lenarsalimov.ru/luch/browser/mcp
        │ user_id from verified JWT
        ▼
P029 Edge Function + RLS-backed job relay
        │ account + device + tab-grant isolation
        ▼
paired Browser Companion device token
        │ HTTPS polling
        ▼
Chrome / Opera MV3 extension
        │ explicit user tab grants
        ▼
approved HTTP(S) tab
```

The MCP bearer token and the browser device token are **different credentials**. The extension never receives the AI host's OAuth bearer token. The MCP server never receives the browser's raw device token.

## Device pairing

1. User connects the remote MCP server from an existing AI host.
2. Authenticated user invokes `browser_companion_pairing_create`.
3. LUCH returns an eight-digit, one-time code valid for 10 minutes.
4. User enters that code in the Chrome/Opera extension.
5. The server hashes the code, atomically consumes it and issues a random 256-bit device token.
6. Only the token hash is stored in Postgres.
7. All future extension requests are scoped by `device_id → user_id`.

Pairing codes are rate-limited to three unused codes per user per minute.

## Browser grants

The extension continues to enforce local consent:

- read grant per tab;
- separate interaction grant;
- separate precise-cursor grant;
- optional all-tabs metadata sharing;
- origin change revokes the tab grant;
- browser close removes session grants;
- precise pointer rechecks live origin/grant immediately before native debugger input;
- server only accepts a target ID matching the exact current `device_id + tab_id + grant_id`.

The cloud relay stores only redacted tab URLs in grant/overview state. Page results are transient job payloads and are cleared after the MCP request completes.

## Job relay

The extension polls `/extension/jobs` every 5 seconds.

MCP calls create a short-lived job. The extension atomically claims it with a 30-second lease and posts the result to `/extension/result`.

The server:
- rejects jobs for another user/device;
- rejects stale or revoked devices;
- rejects missing/revoked tab grants;
- rejects read actions without read approval;
- rejects interactions without interaction approval;
- rejects pointer operations without precise-cursor approval;
- expires jobs after 90 seconds;
- cancels jobs when a device is revoked/disconnected.

## Security boundaries

No:
- OpenAI API key;
- Anthropic API key;
- second LUCH chat;
- shared account credential;
- local broker secret exposed to cloud AI;
- arbitrary extension host permission for `<all_urls>`;
- cookies/history/webRequest/nativeMessaging permissions.

The MV3 extension's only required host permission is the LUCH relay itself. Page access continues to use `activeTab` and explicit runtime consent.

Chrome's permission model recommends optional permissions for capabilities that are not required by the core extension; LUCH keeps `tabs` optional and requests it only for the explicit all-tabs overview. See the Chrome permissions documentation for the rationale. 

## Current verified evidence

- Deno type-check: PASS.
- Supabase migration applied: PASS.
- Edge Function deployed active: `p029-browser-companion`, version 1.
- Public health endpoint: HTTP 200.
- Public extension endpoint without device token: HTTP 401 `DEVICE_UNAUTHORIZED`.
- MCP endpoint without OAuth: HTTP 401.
- Protected-resource metadata: HTTP 200, correct resource and Supabase authorization server.
- MV3 contract tests: 5/5 PASS.
- Pointer VM/security regression: included in the 5/5 suite.
- Existing headed Chromium pointer E2E from the previous candidate remains PASS.
- Caddy public HTTPS route is active on TCP 443.

## Still required before release

1. A **real authenticated MCP user** must create a pairing code.
2. A real Chrome/Opera extension must pair with that code.
3. The same authenticated AI host must list tabs, invoke one approved read, then an approved interaction, and verify revoked/foreign-target failures.
4. Repeat with a second user/device to prove tenant isolation.
5. Real Claude connector E2E.
6. Real eligible ChatGPT Business/Enterprise/Edu E2E. Personal Plus/Pro cannot be used as proof of full write-capable custom MCP because OpenAI currently limits full MCP to Business and Enterprise/Edu.
7. Opera exact-build headed E2E and clean-install onboarding.
8. Final immutable ZIP + checksum and store review.

**Do not mark this release-ready until the authenticated positive E2E exists.**
