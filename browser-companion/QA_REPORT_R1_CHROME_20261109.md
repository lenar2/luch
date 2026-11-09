# P029 Browser Companion R1 — independent reproduction record

Date: 2026-11-09. Candidate status: **Isolated Chrome QA PASS / release HOLD**.

## Proven runtime

| Check | Observed result |
| --- | --- |
| Chromium 153, headed Xvfb, actual MV3 service worker | PASS |
| Google Chrome for Testing 156.0.8078.47, headed Xvfb | PASS |
| Popup pairing after one-time code | PASS |
| Tab unreadable before explicit Chrome action | PASS |
| Keyboard shortcut invoking extension action gives `activeTab` | PASS |
| Chrome-owned popup Grant button (CDP-driven click) | PASS |
| Only granted tab in `/v1/tabs` | PASS |
| Unapproved second tab read denied | PASS |
| Authorized DOM text travels through extension → local broker | PASS |
| Revoke blocks subsequent reads | PASS |
| Navigating to another origin revokes | PASS |
| Node broker/security/extension tests, including missing Origin regression | 12/12 PASS |

The test used two local synthetic pages on 127.0.0.1:10011 and :10012 and a broker on :9248. The signed-in Chrome on the user's Mac was **not** used. To generate the Chrome user gesture, a **test-only** manifest keyboard shortcut for `_execute_action` was introduced, *not* extra host permissions. Before the shortcut Chrome returned a host-permission denial; after the shortcut an `activeTab` operation succeeded.

## Root defect

Chrome MV3 background worker polls `GET /extension/jobs` without `Origin`; requiring Origin unconditionally caused a 403 and the popup reset to disconnected despite correct pairing. **Fix:** require the active Bearer token for all extension routes; for `GET` only, allow absent Origin, but never a foreign Origin. All `POST` routes still require the paired extension Origin. Malicious-origin and replay tests remain red/denied.

## Limits

- The Chrome-owned popup **Grant** button was clicked through a CDP-driven DOM interaction after the X11 keyboard action invoked the extension. The UI handler published one tab grant. A human mouse click remains untested.
- Official Chrome Stable 156 was not an E2E PASS: command-line loading of unpacked extensions did not register its service worker in this environment, so the test used **Google Chrome for Testing** instead.
- OAuth cloud binding, Tilda/GetCourse signed-in access, other browsers, store release, independent approval and rollback remain HOLD.
- Production Browser Bridge unchanged. No user Mac, Xcode, email or other services modified.

Minimal repro on an appropriately equipped isolated Linux browser test machine: run the companion broker and `tests/chrome-runtime-e2e.cjs` in a headed Chrome for Testing/Chromium context with Xvfb and the private XTest keyboard gesture helper. The script's `/qa` mount layout is QA-specific, not an installer for end users.
