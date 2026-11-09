# Draft Chrome Web Store listing (NOT submitted)

**Name:** LUCH Browser Companion

**Short description:** Connect selected browser tabs to LUCH with explicit user consent and instant revocation.

**Long description:**
LUCH Browser Companion connects the browser tabs you specifically choose with your own paired LUCH Companion. The extension never reads other open tabs by default. For each tab, you choose whether to allow access for up to 15 minutes. You can revoke a tab permission or disconnect the entire browser.

Browser Companion is a component of the unified LUCH product and requires a compatible running LUCH Companion. All active grants remain visible in the extension popup.

**Data disclosure / permission justification:**
- `activeTab`: to request temporary access only after the user activates the extension on a page.
- `scripting`: to read bounded visible page text after explicit approval, not to run remote scripts.
- `storage`: to store local pairing and temporary grant state.
- `alarms`: to wake the MV3 service worker and process bounded broker jobs.
- `http://127.0.0.1:9248/*`: the device-local LUCH Companion broker, not a third-party website.

Data: after approval, the page URL, title and up to 65,536 characters of visible DOM text may be processed by the paired LUCH Companion and provided to user-authorized AI tools. We do not claim that approved page text is never transmitted beyond the device. The extension does not request browsing history, cookies, password databases, or all-sites host access.

Links: https://luch.lenarsalimov.ru/en/ ; https://luch.lenarsalimov.ru/en/privacy/ ; https://luch.lenarsalimov.ru/en/help/

**Submission hold:** live pairing/onboarding not ready, platform QA incomplete, publisher identity pending.
