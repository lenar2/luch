# LUCH Browser Companion · R1 candidate

**A page in your browser is personal. LUCH may read it only after you choose to share that tab.**

This is an isolated, **read-only** Chromium Manifest V3 browser companion candidate. It is **not connected to production LUCH** and is not a browser-store release. It uses an existing browser's `activeTab` user-consent mechanism, not a separately installed Chrome DevTools MCP.

## What the person sees

Open the LUCH extension, enter the **one-time pairing code** shown by your local LUCH connection, and select **Allow this tab**. The permission lasts up to **15 minutes**, can be revoked from the extension, and is removed when the tab closes or moves to another origin. Other tabs remain invisible to LUCH.

A connected AI can use the local broker to list only approved tabs and read bounded visible page text. There is **no arbitrary JavaScript execution from the AI**, no cookie/history reader, no form submission, and no write commands.

## Components

- `extension/`: Chrome / Chromium MV3 extension with `activeTab`, `scripting`, `storage`, and `alarms`. The shipped manifest has **one host permission**, the private local broker at `127.0.0.1:9248`; it has **no all-sites host permission**.
- `broker/server.mjs`: loopback-only broker; short-lived pairing code, one extension session, per-tab grants, bounded read jobs, independent bridge token, explicit revoke/disconnect.
- `runtime-e2e.cjs`, `send-shortcut.py`: isolated Chromium 153 / Xvfb experiment that uses a **test-only keyboard shortcut** to trigger the browser action and obtain the genuine `activeTab` grant. No extra site host permission is added.
- `security-qa.mjs`: 18 denial, expiry, and session-authentication checks.
- `QA_BROWSER_R1_PASS.json` and `QA_REPORT.md`: recorded evidence, constraints, and remaining release gates.

## Verified in the isolated environment

Chromium **153.0.8010.12**, launched graphically with Xvfb; **10/10** end-to-end checks including MV3 worker startup, actual pairing through the popup, denial before the browser action, the browser action yielding `activeTab`, one-tab inventory, a real DOM read via broker, manual revocation, and origin-change revocation. **18/18** additional broker-security tests passed.

The initial failure was real: the service worker's job polling made a credentialed GET request without an `Origin` header. The broker rejected it and the popup showed *not connected*. The candidate broker now accepts that specific originless GET **only with the existing valid secret**, while requests with foreign origins and forged credentials remain denied.

## Run in a controlled test environment

The broker uses Node.js and listens on loopback only. The browser test was run with Playwright's Chromium binary, Xvfb, Python XTest and Node.js in an isolated container. It uses paths `/qa` (this folder mounted there) and the test container's `/app/node_modules/playwright-core`; these are **test-harness paths, not end-user installation requirements**.

```sh
node security-qa.mjs

# In the controlled LUCH QA image with Chromium, xvfb-run and playwright-core:
xvfb-run -a -s '-screen 0 1365x900x24' node runtime-e2e.cjs
```

The e2e script copies the candidate extension to a temporary test folder and adds a **shortcut only in that temporary copy**. The real extension manifest is not widened.

## Not yet approved for release

- The standalone browser popup's **Grant** button has not been independently exercised by a real human. The test proved Chrome's genuine `activeTab` permission after an OS-level browser-action shortcut, then invoked the existing grant code.
- No real signed-in Tilda or GetCourse tab was accessed with this candidate.
- The production LUCH `browser_tabs` and `browser_read_text` routes are **not yet wired** to the broker. An empty isolated CDP browser must never be represented as a user-authorized session.
- Independently review authorization and site/tab isolation, revoke behavior, expiration, cold-start lifecycle and concurrent tabs. Then conduct user-consent E2E in real Chrome and Opera and integrate by an explicit feature gate, with rollback.

**Status:** isolated Chrome R1 works. Product integration and independent release QA remain **HOLD**.
