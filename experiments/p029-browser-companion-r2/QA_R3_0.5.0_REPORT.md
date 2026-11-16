# Browser Companion R3 / 0.5.0 isolated engineering report — 2026-11-16

**Status: implementation candidate / independent release QA HOLD / not deployed to Chrome, Opera or production.**
Source base: `lenar2/luch` R2 commit `e1ea033f9f4b26ff5a7f58f73ada0a2c13af3f62`.
Branch: `feat/p029-browser-companion-r3-expanded-20261116`.
Current publicly installed Chrome version verified separately: 0.4.0. Existing Opera submission: 0.4.1 awaiting moderation.

## User-directed changes
- Replaced the single `read_text` capability with 39 allowlisted operation IDs: 16 read/inspect and 23 interactive/navigation. These are **NOT** 39 tested host MCP tools, and **NOT** all 54 LUCH browser-related definitions.
- Read sharing and interactive sharing are separate consent operations per selected tab. Any action checks exact source tab and origin; high-impact button clicks, protected form submissions and password/file inputs fail closed.
- **Removed hard-coded 15-minute tab permission TTL from both extension and broker.** Grants are session storage only, end on revoke/tab close/browser close/cross-origin navigation. A 120-second internal broker liveness check prevents stale command execution when the extension is offline, without terminating a live active user session after a fixed duration.
- Refreshed first-run popup with a meaningful feature summary and honest local pairing requirements; brand B founder-selected provisional 128px icon plus properly rasterized sizes 16,32,48.
- Expanded local broker action queue and adapter, retained fixed localhost and authenticated bridge secret. Jobs are delivered at most once, rather than auto-replaying unacknowledged click commands.
- No Mac, production, live Chrome extension, Opera, AWS/Vultr production, OAuth account, private user tab or publisher dashboard touched.

## Performed tests
- `node --test tests/*.test.mjs`: **11/11 PASS** (including new safe DOM actions and broker read-to-interact consent upgrade).
- `node security-qa.mjs`: **21/21 PASS** (includes no arbitrary grant TTL, inactive-session denial, heartbeat resume, foreign origin/token and cross-tab denial).
- `node --check`: background, popup, DOM operations, broker and adapter syntax PASS.
- `bash package.sh`: created root-correct MV3 `LUCH-Browser-Companion-v0.5.0.zip`, SHA-256 `878b47be7d6b0f8ed4c5e3c01ae0e953b1033126ba1db93846b42d8c0ba95e15`. Source zip staged on isolated /dev/shm; not uploaded to public store.

## Explicit remaining gates
1. A fully functioning local LUCH Companion broker installer and authenticated client integration to ordinary public LUCH user accounts and `browser_tabs` / `browser_read_text` routes; currently still standalone loopback stage.
2. Real graphical MV3 service-worker E2E on exact R3 ZIP in Chrome; actual user grant and interactive clicking on a synthetic site; verify protections, screenshot, reload and no accidental access to other tabs.
3. Independent adversarial QA of consent scope, grant revocation race, action replay, anti-exfiltration and cross-tenant routing. Unsafe actions should have separate user confirmation.
4. HEA render review of new popup and real screenshot before any marketplace copy change.
5. Existing Chrome Web Store developer console requires Google login/identity state; Opera 0.4.1 remains in review. Do not claim marketplace upload, approval, production activation or all 54 tools work.

**Release status remains HOLD.** Founder priority is full featured LUCH, not inflated store metrics. The 13 `server_browser_*` tools live in a separate server-browser provider and are not a license to claim them as local Chrome extension functions.
