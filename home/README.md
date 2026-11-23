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
