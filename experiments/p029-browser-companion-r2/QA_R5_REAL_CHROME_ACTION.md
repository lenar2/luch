# P029 Browser Companion R5 — genuine tab action proof candidate (2026-11-16)

**Status: CI E2E in review / user production HOLD.**

Goal: Verify a real installed MV3 service worker in headed Chromium gains `activeTab` from a genuine browser shortcut invocation, receives consent, executes a bounded AI action through the existing local broker and integration route, returns a user-visible DOM change, and denies action after revoke.

Source: LUCH PR #12, previous v0.5.1 had a confirmed real Chrome popup-and-pair CI PASS in run https://github.com/lenar2/luch/actions/runs/43916963193, but did not test grant/action/revoke against an actual tab.

Changes in v0.5.2:
- Add optional `_execute_action` keyboard shortcut (Ctrl+Shift+Y; macOS Cmd+Shift+Y) to exercise Chrome's real, user-triggered `activeTab` permission rather than pretending a manually opened extension URL grants permissions.
- Extend actual headed Chromium CI test to grant read, deny writes before separate interaction approval, approve interaction, route AI type through real local broker + real MV3 worker to real fixture webpage, assert input DOM and readback, revoke, and assert subsequent requests are denied.
- No broad persistent host permissions, network debugging, cookie/history APIs, Mac, production or marketplace changes.
- The test currently simulates the two popup consent button messages from the **extension's genuine service worker**, after the real shortcut gesture. Do not call these a verified native popup mouse-click E2E. Host actor identity, tenant binding and original Mac bridge live deployment are separate gates.

Scope: isolated synthetic local site, no user websites or accounts touched. A PASS in CI confirms only tested operations on this actual MV3 version; no universal 54-tool browser feature claim.

Rebuild with `bash package.sh` in the isolated branch directory, then compare packaged SHA before any QA or store transfer. Keep public Chrome v0.4.0 and Opera v0.4.1 unchanged until strict release QA.
