# LUCH Browser Companion v0.5.1 — Chrome / Opera listing candidate

**Name:** LUCH Browser Companion

**Short description:** Let your AI understand and work with the browser tabs you choose — read pages, navigate, capture and interact with permission.

## Full description

**Your browser can become part of the work, not just something you look at.**

LUCH Browser Companion connects web pages you choose to the LUCH tools available in your AI assistant. Instead of copying text between windows, let your AI inspect an approved page and bring back structured, checkable information.

**Explore pages:** Read visible text, find a phrase, inspect headings and links, and understand the structure of forms and tables.

**Move through the browser:** Navigate a permitted tab, reload, go back or forward, inspect page elements, and capture a screenshot of the active approved tab.

**Interact when you allow it:** Separately enable interaction on a specific tab to click permitted elements, fill ordinary fields, select options, check boxes and scroll. Sensitive inputs and consequential actions remain restricted.

**Stay in control:** You choose which tab LUCH can read and whether interaction is allowed. Sharing continues for the current browser session until you revoke it, close the tab or browser, or leave the website. Disconnect instantly. No arbitrary 15-minute cutoff.

**Part of LUCH:** The extension requires a compatible running LUCH Companion on the computer. This is an early-access integration for supported setups. The general-purpose local Companion installer and self-service pairing are not yet available. Installing the extension alone does not connect an AI.

Explore the full LUCH platform: https://luch.lenarsalimov.ru/en/ . Browser capabilities outside this extension are provided through separate authorized LUCH routes; they are not automatically available here.

## Verification and truth boundary
The 0.5.1 candidate contains 16 read/inspection and 23 interaction/navigation operation identifiers, not 54 independent extension operations. LUCH's broader public API describes 41 local browser and 13 separate server browser tools. Those numbers must not be conflated.

No user cookies, browsing history, debugger or saved passwords APIs are requested. The page URL/title/visible contents from approved tabs may be provided to the locally paired Companion and a user-authorized AI host; do not claim data never leaves the device.

Before store release, independently verify real Chrome MV3 UI, paired browser, secure revocation, OAuth/tenant routing and actual screenshots. Current public Chrome v0.4.0 is unchanged by this file.

## Media concept
Hero uses the full LUCH app icon for the store tile and micro-L variant B for the tiny toolbar button. Hero should show a real example of an approved tab becoming an AI-readable page with a checkable result. Second visual: inspected headings/links/forms. Third: two distinct Read/Interact approvals. Safety and revocation belongs near the end, not the headline. Any illustrative workflow must be labeled, never passed off as a real AI result.
