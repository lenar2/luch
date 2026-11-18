# LUCH Browser Companion — setup & support

**Status: 0.6.0 release candidate / early access. This is not a general public self-service release.**

The extension shares only the browser tab that you explicitly approve. It needs a compatible LUCH Companion already installed and running on the same computer, plus an LUCH account and AI-client connection that are already authorized. The extension alone does not install the desktop Companion, create an account, or connect an AI host.

The currently verified local setup is limited to supported, already-authorized macOS configurations. A general public installer, fresh-user onboarding, Windows end-to-end verification and Opera runtime verification are not complete.

## Before you begin

- Confirm that your LUCH account and the AI client you intend to use are already authorized.
- Confirm that a supported LUCH Companion is installed and running on this computer.
- The local Companion must expose its pairing page at `http://127.0.0.1:9248/setup`.
- Use an ordinary `http://` or `https://` page. Browser-internal pages such as settings and extension pages cannot be shared.

## Pair this browser

1. Open the LUCH Browser Companion extension.
2. Select **Open local setup on this computer**.
3. On the local page, generate a new eight-digit pairing code.
4. Return to the extension and enter the code.
5. The code is single-use and expires after five minutes. If it expires, generate another code locally.

Pairing connects this browser to the local Companion only. It does not authorize an AI client. Your AI host must separately have an authorized LUCH connection.

## Share a tab

1. Open the exact website tab you want to share.
2. Open the extension and choose **Allow reading on this tab**.
3. Use your already-authorized LUCH AI client for the task.
4. If the task requires clicks, typing or other page changes, grant **Allow interaction on this tab** separately.
5. Revoke access when the task is complete, or disconnect the browser entirely.

Reading and interaction are separate permissions. Password and file inputs are protected; form submissions and some consequential controls are refused. Review the target page and action before granting interaction.

## When access ends

A tab grant is scoped to the exact tab and website origin. It ends when you revoke it, close the tab, end the browser session, or navigate to a different website origin. The five-minute lifetime applies to the pairing code, **not** to an already granted tab.

The extension does not silently grant access to other tabs. A newly opened tab requires its own approval.

## What is shared

For an approved tab, the extension may process its URL, title, tab/grant identifiers and the visible page content requested by an authorized LUCH action. A requested page-text response is bounded to 65,536 characters. A screenshot request captures the active approved tab.

The extension sends approved-tab data to the local Companion over loopback at `127.0.0.1:9248`. When you ask an authorized AI host to use that content, the requested result may be sent to that AI host. Do not approve a page whose contents you do not want to share with that host.

The extension does not request cookie, browsing-history, saved-password, download, geolocation, clipboard or broad all-sites permissions by default. All-tab metadata requires an optional tabs permission; the required Chrome debugger permission triggers a security warning at installation, while enabling precision pointer within LUCH remains a separate per-tab opt-in. It uses the local browser storage for pairing state and session storage for tab grants. The local Companion and AI host have their own processing and retention controls.

See the [Browser Companion privacy disclosure](browser-companion-privacy.md).

## Troubleshooting

**The local setup page does not open**

The extension cannot start or install the desktop Companion. Confirm that a supported LUCH setup is already running on this computer and that local port 9248 is available. If you do not have a supported setup, stop here; the general public installer is not yet available.

**The code is rejected or expired**

Generate a fresh code from the local setup page. Codes are single-use and expire after five minutes.

**The browser pairs, but my AI cannot see the tab**

Browser pairing and AI-host authorization are separate. Confirm that the AI client is connected to the same authorized LUCH account and that the compatible Browser Bridge integration is enabled for your setup. Pairing the extension alone does not enable an AI host.

**The tab cannot be shared**

Use a normal HTTP(S) webpage. Open the extension on the exact tab and grant reading. A different tab or a different website origin needs a new approval.

**A click or text entry is refused**

Interaction permission is separate from reading permission. Some high-impact actions and protected form controls are intentionally blocked. Do not try to bypass those safeguards.

**The extension says the Companion is unavailable**

Check that the local Companion is running and that the pairing page at `http://127.0.0.1:9248/setup` loads on the same computer. Re-pair only after confirming the supported setup is healthy.

## Support

Report issues at [LUCH GitHub Issues](https://github.com/lenar2/luch/issues). Include the browser and extension version, operating system and a description of the failure. Never include pairing codes, tokens, cookies, passwords, private page contents or personal data.

**Release note:** Chrome's public listing remains on v0.4.0. Candidate 0.5.2 is not published. Opera's previously submitted 0.4.1 and the 0.5.2 candidate are separate states; Opera 0.5.2 has not passed its own runtime gate.

## All open tabs and precise pointer (optional)

1. To see tab titles and URLs, choose Show my open tabs and approve the optional Chrome tabs permission. This initially displays the list only inside the extension.
2. To let an already-authorized LUCH AI inspect that overview, explicitly choose Share tab titles and addresses. URL parameters and fragments are removed; the contents of each page still require a separate per-tab grant. Stop sharing at any time.
3. For a true browser-protocol cursor, first approve reading AND interaction for one tab. Then choose Enable precise pointer. Chrome already displayed its debugger warning during extension installation. This enables viewport move, click, double-click, wheel and bounded drag through the browser input protocol, not the operating-system mouse. Turn it off when finished.
4. A Chrome permission prompt is not LUCH authentication. Your AI host must independently support LUCH tools. Installing only a Chrome extension cannot automatically add tools to every paid or free ChatGPT/Claude session. There is no second AI chat or user-supplied API key in this extension.
