# LUCH Browser Companion — Privacy Policy

**Publisher:** LUCH (Lenar Salimov)  
**Last updated:** 24 November 2026

## Browser Companion 0.7.0 — cloud-connected update (awaiting Chrome Web Store review)

**This section describes data practices of the cloud-connected 0.7.0 update and replaces any conflicting local-broker statements for 0.7.0. The historical section farther down this page applies only to earlier versions (including the currently published 0.4.0), not to 0.7.0.**

Version 0.7.0 is an MV3 extension that connects approved tabs to the LUCH cloud relay at `https://api.lenarsalimov.ru/luch/browser` and to the user's existing, separately connected AI via OAuth-protected remote MCP. It **does not require a local desktop broker or a personal OpenAI/Anthropic API key**. Installing the extension alone does not provide access to every ChatGPT plan or workspace.

After the user explicitly grants an individual tab permission, LUCH can send that tab's URL, origin, title, permitted page text, page elements or requested screenshots **from the user's computer through the LUCH cloud to the authorized AI host**. This may include sensitive material present on an approved webpage. No other tab's content is available merely because a tab overview is enabled. The optional overview exposes open-tab titles and redacted addresses only after a separate Chrome `tabs` permission and user sharing switch. Other AI providers' privacy and retention terms apply separately.

The updated 0.7.0 candidate requests Chrome `activeTab`, `scripting`, `storage`, `alarms`, and scoped LUCH cloud host access at installation. **Both `tabs` and the powerful `debugger` permission are optional.** Chrome asks for `debugger` only if the user expressly enables advanced precise-pointer control. A previously installed pilot build may have requested debugger during installation; updating to the new candidate does not automatically revoke an already granted permission. The extension does **not** request browsing-history, cookies, downloads, native-messaging, OS files or all-sites host permissions.

The account signs in through Supabase OAuth. A one-time eight-digit code pairs the user's extension to their account with a separate 256-bit random device token; LUCH stores the token's hash, not the raw token. Grants are scoped by user/device/tab/origin and independently separated into read, interaction and precise-pointer permissions. Users may revoke a tab or disconnect their browser at any time.

**Cloud data retention:** A scheduled database cleanup runs every five minutes. Job payloads, which can include requested content or typed field data, are removed approximately 15 minutes after creation. Expired or used pairing-code records are removed after approximately 24 hours, stale overview metadata and idle-device grants after 24 hours, and limited audit metadata after 30 days. Revoked devices are purged after 30 days. Other platform logs, backups and AI-host records can have separate retention schedules. A device's authorization token persists until the user disconnects or it is revoked.

### Data categories, sharing and controls for 0.7.0

The user authenticates via LUCH OAuth. The identity service may process an account identifier and, depending on the identity provider, an email address. The relay sees the device identifier, a **hash** of the separate device token, approved tab origin/title and redacted address, permission scopes, tool/action type, and limited operational result/status metadata. HTTPS requests may contain an IP address, used for fraud prevention and pairing rate limiting. The extension may process activity such as clicks, typing and scrolling **only as explicitly requested within an approved tab**. It does not log every keyboard event, track unrelated browsing in the background or sell browsing data.

The content **you approve and request** may include messages, identifying details or sensitive content (for example health or financial information visible on the approved page). Page content, form values and screenshots can leave your device **through the LUCH relay to your authorized AI host**. Avoid approving sensitive pages unless you understand that transfer. The AI provider is a separate data recipient with its own privacy/retention terms. No general advertising, targeted marketing, credit evaluation or unrelated data sale is performed using page contents.

LUCH does not use Google API-derived user data for advertising, unrelated profiling or onward transfer except as needed to provide the requested browser-to-AI functionality, as required by law, or to secure its services. **Use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including its Limited Use requirements.**

You may turn off all-tabs metadata sharing, decline debugger authorization, revoke a specific tab, or disconnect the browser. Revocation stops local access immediately. If the device is offline, cloud revocation may need to synchronize after reconnecting; use the authorized AI host to revoke the device as an additional safeguard if needed.

### Availability

LUCH Browser Companion 0.7.0 is a candidate for review and is **not yet confirmed publicly available**. The older Chrome Web Store release may still be 0.4.0, which uses a different local-broker architecture. Access to custom remote MCP and interaction tools depends on the AI provider's plan and workspace; installing the extension alone does not enable those features. Independent full cross-account/security acceptance is still pending.

### Privacy contact

For questions, corrections, deletion requests or incident reports, use [LUCH GitHub Issues](https://github.com/lenar2/luch/issues) without posting private content, tokens or credentials.

## Historical local-broker versions (earlier builds only)

**Effective date:** November 10, 2026  
**Publisher:** LUCH (Lenar Salimov)  
**Extension:** LUCH Browser Companion, Chrome extension (Manifest V3)

## What the extension does

LUCH Browser Companion connects an individually approved Chrome browser tab to a **locally installed, separately running** LUCH Companion broker. The extension is not a standalone cloud service. It cannot connect without the local broker and an eight-digit pairing code. Access must be granted per tab by clicking the extension; every grant expires after 15 minutes or sooner if revoked.

## Data it processes

For a tab you explicitly approve, LUCH Browser Companion may process the **tab URL, page title, tab identifier, access grant identifier and expiration timestamp**. While the grant is valid, a user-authorized LUCH tool may request the **visible text of the approved page**, up to 65,536 characters per request. This text may contain personal or sensitive material, including messages, depending on the website you choose. Approved tab metadata and text are communicated only to the locally paired LUCH Companion broker over the loopback interface at `http://127.0.0.1:9248`. The browser extension does not itself send data to an external LUCH server.

When the user uses LUCH through a connected AI host, **the text returned by a user-authorized tool may be transmitted to that AI host** as part of the user's requested task. The AI host's own privacy terms then apply. Do not approve a tab containing content you do not want to share with the connected AI.

## What the extension does NOT access

It does not request Chrome browsing-history, cookies, passwords, downloads, geolocation, clipboard or debugger permissions. It does not inject third-party or remotely supplied executable scripts, and it does not continuously capture or monitor unapproved tabs. It does not sell users' data and does not use it for advertising, financial profiling or unrelated purposes.

## Local storage and retention

The extension uses local Chrome storage to retain a broker pairing token and temporary session storage to retain approved-tab grants. Broker grants exist in local process memory and expire automatically after 15 minutes. The broker does not persist page text to a database; it returns requested page text transiently for a user-authorized task. Local machine diagnostics or AI hosts may have their own logs and retention settings; those are separate from the extension. Disconnecting the browser revokes the broker session and clears extension pairing and grant state. Removing the extension clears Chrome-managed extension storage.

## User controls

You choose every tab to share. You can revoke access at any time from the extension popup, disconnect the browser entirely, close the tab or simply wait for the 15-minute expiry. Cross-origin navigation ends the previous grant. The extension works only after the local LUCH Companion is installed and explicitly paired.

## Security

Communication between extension and broker uses a time-limited one-time pairing code and a session token. The broker is bound to `127.0.0.1` (not an internet-facing interface). Local access should only be given on a device you control.

## Questions and requests

For support or privacy questions, open a ticket at [LUCH GitHub Issues](https://github.com/lenar2/luch/issues) or review the [LUCH Browser Companion support guide](https://github.com/lenar2/luch/blob/main/docs/browser-companion-support.md). Do not include passwords, payment details or other sensitive data in public issue reports.

This policy may be updated as the extension and connection architecture evolve. Any material change to data processing will be reflected here and in the Chrome Web Store disclosure before release.
