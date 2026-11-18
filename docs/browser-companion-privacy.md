# LUCH Browser Companion — privacy disclosure

**Candidate version:** 0.7.0  
**Disclosure revision:** 18 November 2026  
**Status:** Engineering pilot only; **RELEASE HOLD**. No store publication or general customer onboarding has been approved.

## What it does

LUCH Browser Companion connects browser tabs explicitly approved by the user to tools in an existing supported AI chat, such as ChatGPT. It does not create a new AI chat or require a personal OpenAI API key. ChatGPT must separately authorize the remote MCP connection; installing the extension alone does not grant tools to every chat or plan.

## Processing and permissions

After an explicit user action, the extension can share the approved tab's origin, URL, title, a random permission-grant identifier, bounded visible text or a requested screenshot. Interactions such as typing and clicking require a **separate per-tab approval**. Precise cursor control requires an additional opt-in; Chrome warns about the required debugger permission at installation.

Optional all-tabs overview requires the separate Chrome `tabs` permission **and** a user switch allowing the AI host to receive metadata. Shared metadata excludes URL query strings and fragments; content of other tabs remains inaccessible until the individual tab is approved.

The extension does not request Chrome permissions for browsing history, cookies, downloads, OS files, clipboard or all-site host access. It uses the minimum requested permissions `activeTab`, `scripting`, `storage`, `alarms`, `debugger` and the specified cloud-host URL. `tabs` is optional.

## Cloud transport and storage

This 0.7.0 pilot calls the encrypted HTTPS endpoint `https://api.lenarsalimov.ru/luch/browser`, fronting the LUCH Supabase Edge Function. This **replaces** the 0.6.0 localhost `http://127.0.0.1:9248` broker as the extension's required route.

Supabase Auth handles the user's OAuth login to the remote MCP service. The ChatGPT OAuth access token remains in the AI host; the browser receives a separate random 256-bit device token only after the user enters an authorized one-time pairing code. The browser stores that device token in Chrome-managed local extension storage; the cloud stores only its SHA-256 hash. Browser-tab grants are held in Chrome session storage and copied into an account/device-scoped cloud table for validation.

An explicitly requested page read or screenshot is sent through the LUCH cloud relay to the authorized AI client. This means **page content does leave the computer when an authorized AI read operation is performed**. The AI host's terms and retention settings apply separately.

## Retention and owner controls

- Pairing codes expire after **10 minutes**, are single-use and have server-side rate limits.
- A browser job becomes ineligible for execution after 90 seconds; a completed job's result payload is cleared after the waiting MCP call ends.
- Job metadata/arguments and some security audit records may remain in the server database after processing. **A final automated purge/retention policy is still being engineered**, so do not treat this pilot as meeting a finalized data-minimization or store-privacy standard.
- User actions can grant read, interaction, and precise cursor privileges separately for an approved tab; the grant can be revoked from the extension at any time.
- Tab grants end when the tab closes, the browser session ends, or the website origin changes.
- Disconnecting revokes the device credential and clears the extension's local grants. Other paired devices can be revoked from the authenticated MCP tool.
- The cloud account tables do not grant OAuth clients direct database access to token hashes or page/job payloads. Server operations validate account, paired device, target grant and scope.

## Safeguards and limitations

Some sensitive form inputs (for example password and file fields) and high-impact page actions are blocked. This is not a guarantee that all sensitive content on approved pages is safe to share or act upon. Users should avoid approving private or payment-related pages for unreviewed AI operations.

LUCH does not sell browser page contents or use them for advertising. The extension contains no advertising. The current candidate has not passed a user-authorized positive ChatGPT-to-real-tab end-to-end test or final independent security review.

## Contact

For privacy questions, use [LUCH GitHub Issues](https://github.com/lenar2/luch/issues), without posting tokens, one-time codes, private page contents or other sensitive information.
