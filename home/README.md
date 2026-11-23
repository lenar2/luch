# LUCH Home R7 — public web workspace

LUCH Home is the existing LUCH product's real web app at https://luch.lenarsalimov.ru/home/. Not a new marketing site or the privileged R5 ChatGPT bridge. English is the default language, with a Russian switch.

## Real capabilities
Pseudonymous username/password accounts, per-user session and activity, permission to inspect exactly one public HTTPS website homepage, one real source-backed GET with certificate validation, status/title/mobile viewport/timing/hash, immediate revocation and account/data deletion. Requests don't run JavaScript or follow redirects. The check inspects a maximum of 96 KiB; it is not a full SEO, security or accessibility audit.

**AI is NOT connected.** SO 6.2 integration is a later independent stage. No owner's ChatGPT conversation, Mac bridge, Docker control, privileged tools, payments, mail, or paid AI APIs.

## Safety
- Random-salted PBKDF2-SHA256 password hashes (260000 rounds), 14-day random sessions stored as hashes, Secure/HttpOnly/SameSite=Lax cookie scoped to /home.
- Same-origin POSTs, authenticated CSRF token, max 2 KiB JSON, signup/auth/check rate limits, bounded threads and concurrent checks.
- SQLite grants, records and events scoped to the signed-in user ID. Every new grant revokes the prior grant. Revocation is checked again after in-flight network work. Cross-user reads are prohibited.
- HTTPS public DNS checked and connection pinned to validated public IP, verified certificate, no redirects, blocked private/reserved targets, paths, credentials, query strings and custom ports. Optional fixed trusted edge route for the exact canonical LUCH domain, TLS-verified.
- 90-day retention of checks and activity; user can delete account and all associated records. No email collected, and no password recovery in this beta.
- Nonroot read-only Docker image, isolated private database bind, no published container port, no mounted host sockets, CPU/memory/PID limits. Security headers including CSP, no external scripts.
- Account permissions authorize public website inspection only. No claim of website ownership, no tools beyond the verified first-party read-only checker.

## Routes
Internal: GET /, /app.css, /app.js, /mark.svg, /brand-wordmark.svg, /healthz, /api/state.
POST /api/register, /api/login, /api/logout, /api/delete-account, /api/consent, /api/check, /api/revoke.
External: all under https://luch.lenarsalimov.ru/home/, with canonical Caddy stripping the prefix.

## QA & release
- python3 tests/test_api.py: isolated SQLite + two-user auth/grant/read/deny/revoke/logout security contract. No external work.
- node --check frontend/app.js; python3 -m py_compile app/server.py.
- tests/qa_visual.cjs: actual isolated Chromium rendering with mocked API fixtures (visual QA, not end-to-end).
- Real ephemeral stage server tested two accounts with a genuine HTTPS response from example.com, per-user history, deny after revoke, and deletion.
- README is disclosure, not certification. Public availability and real device behavior must be verified after deployment.

Canonical website, existing public site and main README remain in place.


## R7.1 internal LUCH routing and per-client rate limits

The shared outer Caddy can be reloaded by other service owners. LUCH Home thus has a narrow fallback route in the existing LUCH website's own internal Caddy: home/deploy/inner-luch.Caddyfile. It reverse-proxies only /home/* to the independent R7 service; existing marketing paths are served from their original files. No separate domain, public host port, or altered MCP gateway is required.

The canonical outer Caddy normalizes X-Forwarded-For. The internal LUCH website Caddy forwards that to the R7 application as X-LUCH-Client-IP, and the application uses the last validated address for per-client throttling. Without this, all Internet visitors would share one Docker edge IP and one registration allowance. IP addresses are not proof of user identity; actual data isolation remains by independent account sessions, CSRF and resource grants.


## R7.2 · Human Experience Repair (2026-11-23)

- English remains primary. Direct \`?lang=ru\` to EN and back is fixed using original English source text captured before any translation; WebKit/Chromium roundtrips tested.
- On 390 px iPhone-sized screens, the first actionable CTA is visible near 450–486 CSS px rather than below 1,100 px; a signed-in shortcut and clearly labeled example result are available before registration.
- Signup has explicit current Home Privacy/Terms acknowledgement, recorded with the terms version and timestamp; canonical public Home policies distinguish it from restricted LUCH Core.
- Password visibility is supported; account recovery uses a random one-time 256-bit recovery code shown once, stored as a digest, required to recover without email. Reset invalidates all existing sessions and consumes the code. Existing users can rotate their code after confirming their password. Losing password AND the saved recovery code remains unrecoverable by self-service.
- Old checks/events are filtered after 90 days and deleted on a separate 15-minute service loop, not just at server startup. HEAD endpoints return header-only 200 for existing GET paths.
- Increased small-text contrast and translated application errors. Dedicated controls remain within authenticated user boundaries.
- Verification: 30 offline security/API contract assertions passed; actual separate staging account recovery/register-reset-rotate-delete path passed; 12 EN/RU WebKit/Chromium layout/language scenarios passed; code-dialog acknowledgement tested; original brand, no AI API changes.
- **Physical iPhone Safari was NOT tested:** paired iPhones are offline and LUCH has no proven native Safari automation. Browser tests use headless WebKit, not a physical phone. Only mark device acceptance after user-side Safari check.
- **Legal review recommended** for the updated factual Privacy/Terms clauses before large-scale marketing. The factual code/document consistency check is not a legal compliance certification.
- No API, Mac, LUCH privileged tools, or SO 6.2 connection is added by R7.2.
