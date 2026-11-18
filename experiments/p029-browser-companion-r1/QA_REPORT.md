# P029 Browser Companion R1 · Chrome execution report

**Date:** 9 November 2026  
**Candidate:** isolated Chromium MV3 extension 0.3.0 + local broker  
**Chrome:** Chromium 153.0.8010.12, graphical Xvfb  
**Production:** unchanged  
**Chrome profile containing user accounts:** untouched

## Root cause and correction

The MV3 service worker successfully launched in a graphical Chromium. Pairing via the popup produced a local session, but the popup remained disconnected. The trace showed that `GET /extension/jobs` was made with a valid bearer token **without the `Origin` header**. The broker required `Origin` even on this GET and refused it. The isolated broker correction permits originless GET only when a valid session bearer token is present; an explicit foreign `Origin` still fails.

## Actual execution, not inferred from source code

**10/10 isolated Chrome scenarios passed:**

1. The real MV3 service worker was registered and running.
2. One-time pairing succeeded through the popup button.
3. The user tab was inaccessible before browser consent.
4. An OS-level keyboard shortcut triggered the extension action; the resulting `activeTab` permission enabled the grant.
5. Only the approved tab appeared in browser inventory.
6. An unrelated open tab stayed hidden.
7. A read against an unapproved tab was rejected.
8. The broker dispatched a read job and returned text from the approved synthetic page.
9. Explicit revocation blocked subsequent reads.
10. Navigation to another origin revoked the grant.

**18/18 separate negative broker tests passed:** denied foreign web/extension origins, invalid and reused pairing codes, missing bridge/session credentials, forbidden schemes, unapproved/expired reads, expiry, and session disconnect. These were executed against the corrected broker.

## Security boundary

The extension does not request access to every visited site and cannot enumerate or read other user tabs without grants. It has a hardcoded DOM text reader bounded to 65,536 characters and a local broker only. Tokens were not put in the GitHub source or QA report.

## Honest limitations

- **Isolated automated Chromium evidence**, not a Chrome Web Store release or an independent human-use test.
- The test-only extension shortcut performed a real browser action. The popup `Grant` control itself was **not independently clicked** in that run.
- No real users' Tilda, GetCourse, or other authenticated sessions were used.
- No LUCH production route was switched.
- Independent adversarial review and a real-user Chrome/Opera consent test remain required.

**Result: R1 Chrome Execution PASS (isolated) / PRODUCT ROLLOUT HOLD.**
