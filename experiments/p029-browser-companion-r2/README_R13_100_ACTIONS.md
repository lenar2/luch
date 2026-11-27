# P029 LUCH Browser Companion R13 · 100-operation candidate

**Candidate:** 0.8.3, branched from `feat/p029-browser-companion-r3-expanded-20261116`. **Not deployed to the browser or production cloud.**

## Precisely 100 named operations

- 47 read operations, including 22 additional real DOM operations, browser state, downloads inspection and bounded navigation waits.
- 48 interactive operations, including 14 additional real DOM writes, pin/mute/move/duplicate/discard/zoom, keyboard and download initiation.
- 5 pointer operations retained.
- All operation names are enumerated consistently in the MV3 worker, private browser bridge route, local broker and Supabase MCP function; no remote eval or arbitrary downloaded executable scripts.

The new DOM executor is `extension/extended-dom-ops.js`. Bundled in deterministic ZIP `dist/LUCH-Browser-Companion-v0.8.3.zip`.

## No per-operation popup confirmations after one-time browser authorization

The **Enable full browser control** control uses a direct owner gesture to ask Chrome for optional `tabs`, `debugger`, `downloads` and HTTP(S) host permissions. These are Chrome-native permission requests, not bypassed.

Once granted, the extension publishes interactive grants for up to 80 ordinary HTTP(S) tabs per browser and updates grants on creation, closure, or origin navigation. Commands from the authenticated LUCH transport execute under those grants without additional popup clicks. **Pause browser control** immediately clears local grants; **Disconnect browser** revokes the paired session locally and attempts cloud revocation.

Existing keyword-based blockers for form submission and buttons containing “send”, “submit”, “отправить” etc. have been removed. Password and file-input contents remain excluded; unpaired peers or non-authorized tabs cannot execute jobs. No hidden or automatic payment action was run during QA.

### Visible controls

- Unpaired: **Connect browser**.
- Paired and paused: **Enable full browser control**, **Disconnect browser**.
- Paired and enabled: **Pause browser control**, **Disconnect browser**.

The older tab and cursor advanced controls remain in the legacy DOM for compatibility but are hidden. The Chrome permission dialog is a one-time platform step, not an ordinary plugin confirmation.

## QA evidence

- `node --test tests/*.test.mjs`: **50/50 PASS** on 2026-11-27 (Mac).
- `node security-qa.mjs`: **21/21 negative-security PASS**.
- Real isolated headless Chrome: **36/36 new DOM operations PASS** (22 read + 14 write) against a local fixture, including an explicit form submission, protected password-field omission, Shadow DOM and range input.
- `bash package.sh`: ZIP and SHA256 successfully generated and validated.
- The other 19 new Chrome API, keyboard, wait and download operations are implemented and registered, but each still requires independent real-extension/runtime E2E before release. The limit-review unit tests also prove 125 tabs not truncated, explicit 501-tab overflow, and CDP keys F24, semicolon and Insert.
- The new cloud tool registration must be deployed to the existing LUCH endpoint and end-to-end tested before a production rollout. No deploy performed here.

## Remaining platform limitations and deferred operations

Chrome itself requires permission on first activation and may block privileged pages (e.g. chrome://), browser UI, OS dialogs and native file pickers. This candidate does not include unrestricted reading of password values, arbitrary extension code evaluation or bypassing Chrome permission prompts. Iframe listing is available; DOM automation across cross-origin frames is not proven. Shadow DOM inspection covers open roots only. Native OS cursor and file uploads are separate integration concerns. These are not claimed as supported operations in the 100 count.

**Review gate:** compare old 45 operations with new 100 and check `README_R13_100_ACTIONS.md` before promoting. Do not silently replace currently installed 0.4.x/0.7.x extensions with this unqualified candidate.

## R13.1 — Justified constraint review (2026-11-27)

| Prior constraint | Decision | Technical reason |
| --- | --- | --- |
| 80 approved/open tabs | **Raise to 500** consistently in worker, cloud function, broker and tab inventory. No silent truncation | Need a finite bounded heartbeat/body payload, but 80 was unjustifiably small. Local request budget raised to 2 MB; when over 500, enable fails explicitly, and existing full-mode sessions display an owner-facing overflow warning |
| Wait for load/URL max 20s | **Raise to 40s**; local broker allows 48s for wait operations | Cloud worker waits up to 55s. Longer per-command waits could cause an ACK timeout and ambiguous execution; use separate retryable commands for longer workflows |
| F1–F12 and alphanumeric key set | **Expand F1–F24**, numpad, common editing/navigation keys and printable punctuation | CDP can represent these keys. Unsupported/system-level shortcuts remain outside browser-key API; browser still requires debugger permission |
| 40 windows in inventory | **Remove** | No meaningful transport advantage; do not silently discard open windows |
| Max 5000px window rectangle | **Raise/validate sensible integer bounds** | Modern multi-monitor layouts exceed 5000px. Chrome's actual window constraints still apply |
| Browser HTTP(S) host permissions | **Keep** | Chrome's site-permission and script-injection model |
| One-time Chrome permission dialog | **Keep** | Platform authorization to read/change pages and use debugger/download APIs; only one initial owner gesture, no per-job extension popup |
| Password/file field read denial | **Keep** | Sensitive credential/file-content boundary. Owner-authorized ordinary forms can be submitted without keyword-based blockers |
| 30s alarm/MV3 lifecycle | **Keep** | Chrome platform service-worker lifetime; 30s alarm is minimum supported periodic wake-up, cannot guarantee continuous background service |
| Result-size/DOM read bounds | **Keep pending separate pagination design** | Prevent oversized broker/MCP responses and memory spikes; full-data pagination is a distinct capability enhancement |

No production deployment and no installation occurred in this review.


## R13.2 — Real Mac browser E2E (2026-11-27)

- Browser: separate headless **Opera Chromium** profile on the connected Mac, not the owner's browsing session. No change to production AWS, real browser profiles, Xcode or factory dispatchers.
- Test code: tests/real-companion-19-ops-r13.cjs and tests/real-companion-owner-flow-r13.cjs. To run on the connected Mac, set LUCH_TEST_PUPPETEER_CORE to the installed puppeteer-core module path, and optionally LUCH_TEST_BROWSER_BIN.
- Functional coverage: **19/19 additional Chrome/Opera API operations** executed through the real MV3 extension worker with local fixture and fake local broker. This is not a cloud end-to-end test.
- Real assertions: 100-operation capability registry, correct tab metadata and language fallback, actual zoom/pin/mute changes, live duplication/movement, completed local download bytes, actual text input, Meta+A keydown reaching the page, real discard state, real load/URL waits.
- Corrections from failures: language detection now falls back to document lang on short pages; printable CDP key press now inserts actual text; discard verifies the returned discarded tab and reports a new tab ID if Opera replaces it. With full owner authorization, replaced tab grants are automatically refreshed.
- Chromium compatibility notes: In this isolated Opera version, the requested download filename may be ignored and the file stored under a different basename (the download content is correct and verified; QA-created file is deleted). A Meta+A key event reaches the page with metaKey=true, though selecting text in headless Opera was not proven (baseline Puppeteer Meta+A in headless Opera did not select either). Discard may replace the tab ID; the response reports the actual new ID.
- Owner enable/pause test **PASS with permissions already granted** in the isolated test extension (one popup button; command executed; pause removes grant). Initial optional Chrome/Opera permission dialog **NOT ACCEPTED in headless test**: the browser returned 'Only permissions specified in the manifest may be requested.' This remains a mandatory real-user Chrome UI acceptance gate. Do not claim production-ready or a no-gesture installation.
- All test fixtures are local HTTP-only and copied into isolated temporary profiles. Testing never transmits the QA token or pages to public AWS.