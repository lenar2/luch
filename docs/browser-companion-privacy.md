# LUCH Browser Companion — privacy disclosure

**Candidate version:** 0.5.2  
**Disclosure revision:** 17 November 2026  
**Status:** Draft for the 0.5.2 release candidate; update the live store policy only after release approval.

## Summary

LUCH Browser Companion connects a browser tab that you explicitly approve to a compatible LUCH Companion running locally on the same computer. The extension does not continuously read all tabs. It does not work as a standalone AI assistant and cannot create a LUCH account or authorize an AI host.

A supported local setup and an already-authorized LUCH AI connection are required. The general public self-service Companion installer is not yet available.

## Data processed

When you explicitly approve a tab, the extension may process:

- The selected tab's URL and page title.
- The browser tab identifier and a random grant identifier.
- The selected tab's visible page text when requested by an authorized LUCH action (bounded to 65,536 characters per text response).
- A screenshot of the active approved tab when explicitly requested.

The extension stores its pairing token in Chrome-managed local extension storage. Approved-tab grants are held in session storage and are scoped to the selected tab and its current website origin.

## Where data goes

The extension communicates with the local Companion over loopback at `http://127.0.0.1:9248`. The extension does not itself send approved page contents directly to a public LUCH web endpoint.

When you ask an authorized LUCH AI host to inspect or act on the approved page, the requested page content or action result may be passed through the connected LUCH service to that AI host. The AI host's privacy terms and retention settings then apply. Do not approve pages containing material you do not want to share with the AI host.

The extension does not write page text to a persistent extension database. The local Companion, connected LUCH services, browser and AI host may have their own operational logs or retention controls.

## User controls and retention

- You approve reading for each tab.
- You must separately approve interaction on that tab.
- You can revoke the current tab's grant at any time.
- You can disconnect the browser to clear pairing and all tab grants.
- A grant ends when revoked, when its tab closes, when the browser session ends, or when the tab navigates to another website origin.
- The eight-digit pairing code is single-use and expires after five minutes. This is the code lifetime, not the tab-grant lifetime.

## Permissions

The extension requests only:

- `activeTab` — temporary access to the tab after a user action.
- `scripting` — run the extension's bundled, bounded page-reading and interaction functions in an approved tab.
- `storage` — retain pairing state and session-scoped grants.
- `alarms` — check the local Companion for authorized work while the browser session is active.
- Host access to `http://127.0.0.1:9248/*` — communicate with the local Companion only.

The extension does not request cookies, browsing history, downloads, geolocation, clipboard, webRequest or all-sites access. The tabs permission is OPTIONAL and Chrome asks for it only when the user requests an all-tab overview. The debugger permission CANNOT be optional under Chrome manifest rules: Chrome warns about it at extension installation. Despite the manifest permission, LUCH pointer commands remain disabled until the user separately authorizes interaction and precision input on a particular tab. Debugger attachment is short-lived and is released after each pointer action. The extension does not inject remotely supplied executable code.

## Sensitive content and safeguards

A page may contain personal or sensitive information. You are responsible for selecting the tab and deciding whether to grant access. Password and file inputs are protected; form submissions and some high-impact controls are refused. These safeguards do not replace reviewing the page and the requested action.

## Sale and advertising

LUCH does not sell browser page content or use it for advertising or unrelated profiling. The extension does not include advertising.

## Contact

For privacy questions or requests, use [LUCH GitHub Issues](https://github.com/lenar2/luch/issues). Do not post tokens, pairing codes, passwords, private page contents or other sensitive information in a public issue.

## Optional open-tab overview and precise pointer

Users can inspect their open tabs after explicitly granting the optional Chrome tabs permission. The list includes titles, active/window flags, and URLs with search parameters and fragments removed. LUCH cannot send that list to an AI host until the user separately enables overview sharing. This grants access to tab METADATA only, not contents. Sharing is session-scoped and can be turned off at any time.

The precise on-page pointer requires debugger permission declared at installation, plus a separate in-app opt-in after the user has granted interaction on the current tab. It supports pointer movement, clicking, double-clicking, wheel scroll, and limited dragging within the approved webpage viewport. Chrome may show a prominent debugger warning. It is not an OS-level mouse and does not grant unrestricted computer control. A browser permission or per-tab grant can be withdrawn at any time.

An existing AI host must support a separate authorized LUCH tool connection. The extension has no bundled ChatGPT/Claude chat and does not demand a personal OpenAI or Anthropic API key to use its browser controls. Installing the extension alone does not enable third-party tool access in every AI client, including free-plan clients.
