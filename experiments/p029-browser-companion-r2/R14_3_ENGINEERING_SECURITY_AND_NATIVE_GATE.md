# P029 LUCH Browser Companion · R14.3 · 27 November 2026

**Status: QA candidate, NOT production release.** Parent exact GitHub HEAD: `fa8dbf5a1cbfb6a8b67ffa707840246f7aafdf7e`. Changes developed in a separate clean Git worktree. Original local 0.8.4 working tree is untouched.

## Changes

- Normal first-time authorization requests only optional `tabs`, `downloads` and ordinary HTTP(S) host permissions, via the actual owner click in `popup.html`. The browser's native permission prompt is never automated or bypassed.
- Optional `debugger` permission is NOT requested during normal browser onboarding. It is reserved for the explicit, separate precise-cursor control (also used for advanced keyboard operations).
- Acquiring browser-wide control never silently elevates every tab to precise-cursor control. A pre-existing, per-tab cursor opt-in is preserved only while the same origin and grant remain valid.
- Chrome permission revocation or tab cross-origin navigation never creates new cursor approval. Event-driven tab synchronization preserves explicit approval only for the same origin.
- Page-executed DOM operations (including click, fill and form submit) now receive `expectedOrigin` and verify it **inside the page before mutation**, closing a worker-to-DOM navigation race.
- EN/RU setup descriptions distinguish default browser access from optional advanced debugger permission. Existing automatic session recovery and zero-tab steady job poll are unchanged.

## Fresh test evidence (Mac)

- `/usr/local/bin/node --test tests/*.test.mjs`: **65 passed / 0 failed**.
- `/usr/local/bin/node security-qa.mjs`: **21 security-negative cases passed**.
- `git diff --check`: clean.
- New adversarial coverage: owner rejecting permission, no debugger on first CTA, debugger capability missing, per-tab cursor isolation, event reconciliation and origin change, revoke during queued `navigate`, `close_tab`, `download_url`, and page-origin fencing for DOM click/fill/form submission.

## Native browser gate, not accepted yet

- Normal installed Google Chrome 158 cannot use command-line `--load-extension`: Chrome-branded builds removed that support starting at Chrome 137. Chrome also removed `--disable-extensions-except` from branded Chrome 139 onward.
- Official Chrome for Testing Stable 158.0.8127.88 for `mac-x64` was sourced from Google Chrome for Testing metadata but download timed out at 19,693,559 / 213,548,436 bytes; incomplete archive removed.
- Isolated Opera/Chromium 157 was started with **no optional privileges pre-approved**. The real extension `popup.html` loaded, and `chrome.permissions.getAll()` showed only `activeTab`, `alarms`, `storage`, `scripting`, not `tabs`, `downloads`, `debugger`. The CDP session timed out before it could prove a genuine owner click/natively accepted consent, so this is **not** a passed first-permission E2E.
- Each temporary browser instance was stopped and its isolated profile removed. Production Chrome profile, installed extension, cloud auth and production were not changed.

## Outstanding acceptance and independent QA

1. Run official Chrome **for Testing** (not branded Chrome) in a new disposable profile, load the unpacked candidate, use the normal extension UI and let the **owner** accept or decline the genuine Chrome permission dialog.
2. Assert that normal browser access works without `debugger`; that enabling the precise pointer separately prompts Chrome; and that pause/disconnect, cross-origin navigations, and restart/recovery behave correctly.
3. Independently scrutinize the full mutation set, including operations that act through `chrome.tabs`, `chrome.debugger`, and both page DOM executors, with live revoke/origin race tests.
4. Existing P029 QA and Critic must publish independent results, and cloud authenticated command → actual fixture browser action → receipt must be verified before release.

Do not claim Chrome first-use native authorization PASS, production release, successful cloud E2E, or independent QA ACK on this evidence alone.
