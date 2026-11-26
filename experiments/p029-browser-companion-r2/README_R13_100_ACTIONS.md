# P029 LUCH Browser Companion R13 · 100-operation candidate

**Candidate:** 0.8.0, branched from `feat/p029-browser-companion-r3-expanded-20261116`. **Not deployed to the browser or production cloud.**

## Precisely 100 named operations

- 47 read operations, including 22 additional real DOM operations, browser state, downloads inspection and bounded navigation waits.
- 48 interactive operations, including 14 additional real DOM writes, pin/mute/move/duplicate/discard/zoom, keyboard and download initiation.
- 5 pointer operations retained.
- All operation names are enumerated consistently in the MV3 worker, private browser bridge route, local broker and Supabase MCP function; no remote eval or arbitrary downloaded executable scripts.

The new DOM executor is `extension/extended-dom-ops.js`. Bundled in deterministic ZIP `dist/LUCH-Browser-Companion-v0.8.0.zip`.

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

- `node --test tests/*.test.mjs`: **46/46 PASS** on 2026-11-27 (Mac).
- `node security-qa.mjs`: **21/21 negative-security PASS**.
- Real isolated headless Chrome: **36/36 new DOM operations PASS** (22 read + 14 write) against a local fixture, including an explicit form submission, protected password-field omission, Shadow DOM and range input.
- `bash package.sh`: ZIP and SHA256 successfully generated and validated.
- The other 19 new Chrome API, keyboard, wait and download operations are implemented and registered, but each still requires independent real-extension/runtime E2E before release.
- The new cloud tool registration must be deployed to the existing LUCH endpoint and end-to-end tested before a production rollout. No deploy performed here.

## Remaining platform limitations and deferred operations

Chrome itself requires permission on first activation and may block privileged pages (e.g. chrome://), browser UI, OS dialogs and native file pickers. This candidate does not include unrestricted reading of password values, arbitrary extension code evaluation or bypassing Chrome permission prompts. Iframe listing is available; DOM automation across cross-origin frames is not proven. Shadow DOM inspection covers open roots only. Native OS cursor and file uploads are separate integration concerns. These are not claimed as supported operations in the 100 count.

**Review gate:** compare old 45 operations with new 100 and check `README_R13_100_ACTIONS.md` before promoting. Do not silently replace currently installed 0.4.x/0.7.x extensions with this unqualified candidate.