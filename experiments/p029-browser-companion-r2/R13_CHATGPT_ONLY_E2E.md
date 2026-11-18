# P029 · R13 — ChatGPT-only real tool check and Chrome pairing gate

Date: 2026-11-18. Status: **PARTIAL / RELEASE HOLD**.

## Actual positive evidence

1. The existing ChatGPT Plus conversation, with the private OAuth-connected **LUCH Browser Companion R12 TEST**, executed **`browser_companion_status`** once and displayed the actual result `[]`. A separate direct call to the SAME installed R12 TEST connector returned `[]` as well. The production P029 database independently contained **0 active browser devices**.
2. The existing ChatGPT conversation next invoked **`browser_companion_pairing_create`** with the disposable test device label. ChatGPT displayed a separate **one-time tool-permission confirmation**. No silent write access was assumed. The installed connector was also independently invoked from the user-authorized ChatGPT session, and it generated actual one-time codes. None are reproduced in this document.
3. An unapproved `browser_read_text` against a deliberately synthetic target returned **`BROWSER_COMPANION_OFFLINE`**, which is an expected denial, not a successful page read.

## Extension-level engineering fixes

- Fixed real popup runtime defect: `popup.js` referred to an undefined `locale` variable instead of the declared `lang`. This blocked actual first-run setup. Commit `d45727f871f58aefa484672381e5e556a0e831d3`.
- Added two VM tests executing the RU/EN popup initialization, not merely static string checks. Commit `7c995ef19251f0aa8b2c1d388cc1e394700efbe7`.
- Replaced fixed port `19492` in the old local-broker contract test with a dynamically assigned localhost port to avoid collision on a shared LUCH test runner. Commit `75fd7bb11cbbc80658e32e9a5db5fd549a4c8694`.
- LUCH Server exact-head local checks: **34/34 Node tests PASS**, **0 GitHub Actions**.
- Mounted the corrected 0.7.0 MV3 extension in a private, non-production Chromium container on LUCH Server. The real extension service worker was present and `popup.html` executed, rendering **Browser not paired** and the expected setup link. This is a real Chromium smoke test, NOT an authenticated end-to-end PASS.

## Pairing blockers encountered

- The first disposable test harness failed **before code consumption**, because it deleted the temporary one-time pairing code before the isolated Chrome container finished startup. This was a harness race, not a proven server rejection.
- On attempting a corrected automatic transfer from the LUCH/ChatGPT connector to a separate execution tool, the platform blocked forwarding the one-time pairing credential. **Do not bypass or obfuscate that protection.** The secure intended flow is for the owner to read the code in the authorized ChatGPT client and enter it directly in the extension popup.
- All **2 unused R13 test pairing codes** generated during investigation were explicitly expired in Supabase; no active device or pending browser action was left. The scoped Mac headless-Chrome test process was shut down without touching any other Chrome instance.
- The secondary Mac test with branded Chrome 157 did not load the unpacked extension via `--load-extension` in headless mode; the hosted server's Playwright Chromium DID load it. The Mac test profile and the production user browser were not treated as an E2E PASS.
- Actual Chrome `activeTab` permission should be granted by a genuine human click on the extension in the target tab. Merely opening `popup.html` through CDP is NOT sufficient; do not bypass this restriction or claim a synthetic grant equals user consent.

## Evidence boundaries and next exact steps

**Verified:**
- ChatGPT authenticated MCP tool invocation;
- status `[]` consistent with live database;
- pairing creation tool available and invoked;
- real Chromium extension popup runtime;
- no-permission denial.

**Not verified / blocked:**
- One-time code redeemed by a real Chrome extension;
- account→device binding persisted and then seen in ChatGPT;
- explicit `activeTab` per-tab read grant;
- successful ChatGPT `browser_read_text` return of the fixture marker.

**Safest continuation:** On a disposable Chrome/Chromium profile with the candidate unpacked extension installed, the owner should invoke `browser_companion_pairing_create` from their connected **existing ChatGPT**, approve the tool **once**, and type the displayed code directly into the extension UI. Then select a harmless fixture tab (e.g. Example Domain), click the Browser Companion extension icon in that tab, and explicitly approve reading. Once that real grant exists, invoke `browser_companion_status`, `browser_list_open_tabs` (only if separately enabled), and `browser_read_text` on the genuine `ext:<tabId>:<grantId>` target. Verify response against page and test revocation.

Do not invoke Claude, GitHub Actions, paid model APIs, production browser writes, or store publication.

**Release decision: HOLD until an owner-mediated positive ChatGPT→cloud MCP→paired extension→explicitly approved tab E2E and independent QA.**
