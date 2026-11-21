# P029 Browser Companion 0.7.0 — R17 public-release readiness decision

**Audit date:** 2026-11-21  
**Decision:** **NO-GO: public publication blocked, PR #12 remains DRAFT.**  
**Scope:** Chrome and Opera, existing ChatGPT/compatible AI tool host, no personal model API key or separate LUCH chat, no Claude E2E and no GitHub Actions.

## What was actually completed in this audit

1. Re-read exact GitHub candidate sources and manifest rather than relying on previous handoffs. Manifest v0.7.0 includes `activeTab`, `scripting`, `storage`, `alarms`, **required install-time `debugger`**, host permission restricted to `https://api.lenarsalimov.ru/luch/browser/*`, optional `tabs`.
2. Local tests executed on LUCH Server (not Actions): **38/38 Node tests PASS**, **21/21 legacy-broker security negative cases PASS**, Deno `check` PASS, deterministic ZIP package integrity PASS. Current tested HEAD before report: `ce449459de799d7ea1b33110c924404e3ec2b7d1`.
3. Private exact-source 0.7.0 ZIP was built by `package.sh` on LUCH Server. SHA-256: `c9d1565f14ccb46509ad8adadf7650b92858b045027a90cef84a156f95a6f9a3`. **Not published; not an approved store package.**
4. Fixed a real idle-service-worker timing race: Chrome may only deliver MV3 `chrome.alarms` every 30 seconds or later, while the cloud used to time out at 30 seconds. New cloud wait is **55 seconds**, online freshness **90 seconds**, job expiration **120 seconds**, claim lease **60 seconds**. This improves reliability but does **not** prove arbitrary Chrome idle/wake latency under every OS state.
5. Deployed the amended private cloud relay as Supabase Edge Function `p029-browser-companion` **v7 ACTIVE**.
6. Installed Supabase `pg_cron` and created active named task `p029-browser-companion-retention` running every five minutes. The function clears expired jobs and prunes job payloads, pairing codes, stale tab metadata/grants, expired rate buckets, audit metadata and revoked devices under specified limits. Verified **one active cron task, zero remaining stale jobs** after explicit cleanup; anonymous/authenticated clients cannot execute cleanup directly.
7. Replaced obsolete localhost/0.6.0 README, inaccurate Chrome/Opera store drafts and stale privacy text **on the PR branch** with truthful 0.7.0 cloud/OAuth copy and current retention. Current public website privacy pages have **not** been approved as Browser Companion-specific store policies.
8. Public smoke: `/luch/browser/health` HTTP 200, OAuth protected-resource metadata HTTP 200, `/ru/connect/` and `/en/connect/` HTTP 200, unauthenticated MCP POST HTTP 401. There is still no approved public customer download or store listing for this build.
9. Attempted real native **Opera for Mac** isolated-profile installation. Developer mode was enabled and the unpacked-extension installer was invoked. The first immediate load gave an explicit developer-mode timing error. After dismissing the error and retrying with developer mode enabled, the 0.7.0 extension still did not appear among installed extensions or run as a background service worker. **Opera exact-build E2E NOT PASS**. The dedicated test Opera process was stopped by exact PID; existing user Opera processes were not touched.

## Positive evidence inherited from completed R16

In one owner-authorized signed-in ChatGPT Plus + Chrome test profile, the actual LUCH MCP tool discovered devices, paired with a one-time code, read the approved `example.com` tab and returned the actual text. Revocation was observed and a repeated read was denied. This proves a **specific read-only** pilot path, not general-public readiness or full 45-operation support.

## Blocking gates (must not silently waive)

- **B1 — Opera:** actual Opera 0.7.0 extension install, pairing, approved read and interaction/pointer regression is unverified. Different Chromium/CDP processes are not substitutes for the real Opera extension.
- **B2 — First-user onboarding:** a fresh, unconfigured account has not completed OAuth, creation, pairing and tool discovery independently on Windows/macOS. Existing connected owner account is insufficient evidence for a self-service product.
- **B3 — Authorization / tenant boundary:** negative E2E across two separate users/devices and a foreign tab, altered origin and revoked grant must be independently repeated against cloud transport.
- **B4 — Full browser action coverage:** neither the ChatGPT cloud write/click/pointer operations nor idle/wake performance across browsers and network conditions has passed release-grade E2E. A claimed job is deliberately at-most-once; an ambiguous late result cannot be silently retried.
- **B5 — Store and publisher controls:** Chrome Web Store and Opera Add-ons each require a real developer/publisher account, complete listing, permission disclosure, true runtime screenshots, publisher verification where needed, reviewer submission and moderation. No verified version-matched listing or approval yet.
- **B6 — Permissions and security:** Required install-time `debugger` has broad capabilities and needs an independent least-privilege review. MCP supply-chain dependencies are not all exactly version-pinned; retention, privacy and authorizations need independent confirmation under traffic. A global pairing limit of 240 attempts/10 minutes can create public onboarding contention and has not been load tested.
- **B7 — Universal ChatGPT access:** OpenAI's official custom-MCP documentation currently gives Business and Enterprise/Edu full write support. Pro has read/fetch limits, while Free/Plus full write support is not universally documented. An independent free browser extension cannot override host plan/workspace restrictions. See https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt .

## Release policy

- Do **not** merge PR #12 to `main`, create a GitHub public release/tag that promises general availability, upload to the Chrome Web Store or Opera Add-ons, or publish the current ZIP as an approved customer build.
- Do not activate GitHub Actions, invent customer successes, request user-supplied OpenAI API keys or create a separate LUCH chat.
- After B1–B6 pass, package the exact audited source, record SHA-256, open reviewer submissions and label availability accurately by each AI host's supported plans. Store moderation may take additional time.

**Final verdict for this audit: NO-GO public release; private engineering candidate and cloud service improvements completed.**
