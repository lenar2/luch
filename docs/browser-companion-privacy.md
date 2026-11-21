# LUCH Browser Companion — privacy disclosure

**Version under review:** 0.7.0 · **Updated:** 21 November 2026  
**Status:** Engineering candidate. Not yet approved for a public Chrome Web Store or Opera Add-ons release.

## What LUCH Browser Companion does

The extension allows tools in an existing, separately authorized AI conversation to read and interact with **browser tabs you explicitly approve**. No separate LUCH chat, OpenAI API key or Anthropic API key is required. The AI provider may independently restrict custom MCP availability, tools, or plans; the extension does not bypass provider restrictions.

## Information processed and where it goes

When you explicitly approve **Read**, the extension can send the approved tab's origin, URL, title, page text, headings, links, forms, selected elements or a requested screenshot to the LUCH cloud relay and onward to your authorized AI host. **Page content does leave your computer**, and the AI provider has its own data policies and retention controls.

When you separately approve **Interaction**, the extension may execute bounded clicks, typing, scrolling, navigation or window changes. Optional precise pointer actions use the Chrome debugger API and require a further per-tab opt-in. Chrome may show a broad debugger-permission warning at installation; the permission is powerful, even though LUCH limits the operations it performs.

The optional **All open tabs** view requests the separate `tabs` permission and a second explicit switch before any such metadata is shared with your AI. Tab titles and addresses are metadata, not permissions to read those tabs' page content. Query strings and URL fragments are removed from cloud-shared tab metadata, but approved page content may itself contain sensitive information.

The extension does not request browser-history, cookie, OS-file, clipboard, downloads, native-messaging, or all-sites host permissions. Chrome manifest permissions: `activeTab`, `scripting`, `storage`, `alarms`, `debugger`; optional: `tabs`; required server host: `https://api.lenarsalimov.ru/luch/browser/*`.

## Identity and security

Your existing AI host authorizes the public OAuth-protected remote MCP endpoint `https://api.lenarsalimov.ru/luch/browser/mcp`. LUCH uses Supabase Auth to identify the account. The browser extension receives a different 256-bit random device token after the user enters an eight-digit, one-time code. Only a hash of the device token is stored in the cloud database. Your AI-host OAuth credential is never the browser device token.

Tab grants are separate by account, device, tab, URL origin and permission scope. Navigating to a different origin, closing a tab/browser session, revoking permission or disconnecting ends the appropriate grant. We test denial cases but cannot guarantee that any connected AI will never request an unsafe action or misinterpret untrusted page content.

## Retention

An automatic five-minute database maintenance schedule is active for P029:

- A one-time code is usable for no more than **10 minutes** and cannot be redeemed twice. Pairing-code records are deleted within approximately 24 hours after their use or expiry.
- Commands expire if not executed in time. Browser job payloads and associated arguments are deleted within approximately **15 minutes** of job creation. They may temporarily contain page data or text entered in a permitted field.
- Metadata for tab overviews is removed after 24 hours without updates; stale device grants are removed when the device has not checked in for over 24 hours.
- Browser action audit event metadata is retained for up to 30 days; revoked device records are removed after 30 days.
- The browser's authorization token remains until the device is disconnected or revoked. User-approved tabs may be shared across operations only while the grant is valid.

Retention periods above refer to the active P029 database cleanup; separate AI-host records, system backups, and legally required operational logs may be governed by their own retention rules. Do not assume the LUCH schedule erases independent AI-provider copies.

## User controls and limits

You can deny initial pairing, grant read without interaction, decline all-tabs metadata sharing, disable cursor control, revoke a specific tab's grant, or disconnect the whole browser. The authorized AI host may also let you revoke the remote MCP connection.

Do not approve sensitive financial, identity, administrative or medical pages unless you understand the data exposure and the requested actions. Password/file fields and some high-impact operations are blocked, but those safeguards are not an absolute guarantee of safety.

LUCH does not sell approved browser page contents or use them to target ads. No advertising is embedded in the extension.

## Contact

Report privacy issues through [LUCH GitHub Issues](https://github.com/lenar2/luch/issues) without posting account credentials, pairing codes, device tokens or private page data.
