# LUCH Browser Companion · R2 (Chrome Web Store release candidate)

**Public product name:** LUCH Browser Companion. The earlier `(QA)` label has been removed from the extension manifest and user interface.

**Release gate:** CANDIDATE / DO NOT PUBLISH. This source is an independently staged successor to R1, not a deployed product. R1 remains preserved as its own evidence bundle.

## Single product, not a separate account
Browser Companion is the browser capability provider of LUCH, not a stand-alone product or an alternative to the regular LUCH account. An approved tab must show in the authenticated user's ordinary `browser_tabs` tool and respond to `browser_read_text`, with no automatic wrong-profile fallback.

### Working local capability
- Chromium Manifest V3 (Chrome, Chromium-family); English/Russian popup UI; normal product name and LUCH ray icons.
- One-time 8-digit local pairing to a loopback LUCH Companion broker; the paired extension receives a session token. A separate bridge secret protects read operations.
- Explicit per-tab grant via toolbar/popup (temporary `activeTab` permission), 15-minute expiration, cross-origin revoke, manual revoke, disconnect, per-tab ON badge, bounded DOM text reader.
- No unapproved tab access; no cookies, history, debugger, all-sites host permission, remotely supplied JS, form submission or credential reader.
- Originless MV3 job polling GET allowed **only with** a valid bearer token; foreign extension origins always blocked.
- Grant rollback if the broker is unavailable, rather than silently persisting a grant the user was told had failed.

### Important unfinished integration
The current transport is **only 127.0.0.1:9248**, and the broker is not bundled in the installed LUCH Companion or publicly routed through OAuth. A user installing the extension *without* a compatible local LUCH broker cannot complete pairing. This is a critical product-release blocker, not a UI inconvenience.

The release must not be called fully functional until:
1. Authenticated LUCH account and paired-device binding for the broker/relay, with server-side tenant isolation, nonce/replay defense, revocation and an idempotent session lifecycle;
2. Native Browser Bridge `browser_tabs` / `browser_read_text` routing to approved tab IDs, returning explicit `USER_TAB_PERMISSION_REQUIRED` and `WRONG_PROFILE` when appropriate;
3. Real signed-in **user-consented** Chrome and Opera functional proof, including native popup grant click, revocation during pending jobs, cold-start/reconnect, and XSS/SSRF/cross-tenant attacks;
4. Independently reviewed privacy notice, user onboarding and installation for common macOS/Windows browsers, and Store screenshots;
5. Independent release QA on exact commit + ZIP SHA; publisher identity verification; explicit founder approval before review/publish.

**No change to production LUCH, the founder's browser profile, or Xcode is authorized by this package.**

## Executed R2 evidence
10/10 genuine graphical Chromium 153 isolated integration scenarios passed, 18/18 broker negatives and 4/4 R2 contract tests. See `QA_RUNTIME_REPORT.md` and `QA_BROWSER_R2_ISOLATED_E2E.json`. The actual native popup grant button and user-account integration remain HOLD; this is **not** independent release approval.

## Developer checks
- `node --test tests/*.test.mjs` checks public branding, permissions, local grant lifecycle, revoke and failure rollback using real extension JS in a controlled VM mock.
- `node security-qa.mjs` checks 18 broker security cases against an ephemeral loopback HTTP server.
- `./package.sh` produces a canonical ZIP and a SHA-256 file; updates to an existing Web Store draft require a strictly higher manifest version. Do not click 'Submit for review' until gates close.

## Support / privacy
- Public site: https://luch.lenarsalimov.ru/en/
- Privacy policy: https://luch.lenarsalimov.ru/en/privacy/
- Support: https://luch.lenarsalimov.ru/en/help/
- Source: https://github.com/lenar2/luch
- Store listing must disclose that approved page **visible text** is passed to locally paired LUCH Companion and possibly onwards to user-authorized AI hosts; it is not accurate to say the extension never processes website data.
