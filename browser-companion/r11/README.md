# LUCH Browser Companion · R1.1

## Your browser stays yours

LUCH can work with a tab you choose, without taking over your browser. Open the Browser Companion, enter the one-time code, and grant access to **that tab only**. You can revoke it at any time; the grant also expires after 15 minutes or when the tab moves to another website.

R1.1 connects that experience to the **existing LUCH commands**, not to a separately installed Chrome DevTools MCP:

- **browser_tabs** shows user-approved tabs and isolated automation tabs distinctly. The list never exposes names or URLs from unapproved native Chrome windows.
- **browser_read_text** reads approved content via Browser Companion, not by silently switching to an unrelated CDP profile.
- Commands such as **browser_click** remain blocked on user-owned tabs in this candidate. A read grant is not an action grant.
- **browser_status** distinguishes user approval, pending pairing and isolated automation availability.

If the isolated browser stops working, an approved personal tab remains readable. If no permission exists, LUCH says so rather than pretending it can see your session.

## Engineering boundaries

R1.1 is implemented as a **loopback-only shadow router** that speaks the existing Browser Bridge HTTP contract. It delegates isolated automation requests to the existing bridge and consented-tab reads to the R1 broker. It uses the existing device's private bridge credential; it never sends it to the extension. Browser Companion has its own short-lived pairing code and authenticated local session.

The MCP adapter's existing \`FACTORY_BROWSER_BRIDGE_URL\` configuration can point to the shadow router. No replacement of the production bridge or change to Chrome is needed for candidate tests.

| Local endpoint | Function |
| --- | --- |
| 127.0.0.1:9240 | Existing Browser Bridge (not changed) |
| 127.0.0.1:9248 | Companion local broker |
| 127.0.0.1:9251 | New R1.1 shadow router |
| 127.0.0.1:9243 | Optional isolated MCP QA adapter, never the production 9242 |

### Verified

- **Google Chrome for Testing 156**: 10/10 real extension + broker + R1.1 router E2E checks PASS.
- **Unmodified stock LUCH MCP adapter** in an isolated test container: 7/7 commands/permission checks PASS, including real tool names \`browser_tabs\`, \`browser_read_text\`, \`browser_click\`, and \`browser_status\`.
- **Router regression suite**: 4/4 cases PASS, including expired/revoked grants, isolation of unapproved native-window metadata, unavailable isolated CDP and strict fail-closed behavior.
- R1 broker authorization regression remains 12/12 PASS in its earlier QA run.

See [R1.1 QA report](QA_REPORT_R11_20261109.md) and [source adapter](../integration/local-bridge-proxy.mjs).

### Still HOLD

The extension has **not** been installed or paired in the owner's signed-in Chrome, Tilda or GetCourse. The cloud LUCH account/device/OAuth authority boundary and independent adversarial review are **not** certified. Opera and other browser engines, store publication, installation UX and production rollback remain unverified. These must pass before enabling R1.1 for all users.

This branch is a **candidate**, not a deployed service. It does not modify the default English GitHub homepage.

[Русский](README.ru.md) · [Original R1](../README.md) · [P029 tracking](https://github.com/lenar2/ai-factory-evidence/issues/3835)
