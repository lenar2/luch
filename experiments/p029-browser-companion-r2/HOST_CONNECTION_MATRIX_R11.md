# P029 · R11 · Existing AI host compatibility and first-use truth (2026-11-18)

**State: engineering candidate / RELEASE HOLD. This is a compatibility register, NOT a claim that LUCH is available to every host.**

## Product contract

The user stays in an existing ChatGPT, Claude, or another compatible AI. LUCH Browser Companion is an authorized browser *tool layer*, not a new AI chat. No personal OpenAI/Anthropic API key or AI-token billing is needed for this intended flow. An AI host must still natively accept a trusted tool/connector connection; a Chrome extension cannot inject tools into an unrelated chat by itself.

## Host-level matrix (official documentation as of 2026-11-18)

| AI host | Official external-tool path | Plan / operating caveat | LUCH cloud-host E2E |
| --- | --- | --- | --- |
| Claude web / Claude Desktop | Custom **remote MCP** connector via Customize → Connectors; OAuth strongly preferred | Claude's current support article includes Free (one custom connector), Pro, Max, Ultra, Team, Enterprise. Remote MCP is reached from Anthropic's cloud on public HTTPS port 443. Team/Enterprise owner setup may be required. | **NOT TESTED** |
| ChatGPT web | Custom MCP in Plugins or custom app where enabled, using remote HTTPS MCP endpoint, OAuth/host approvals | Official current full write/modify MCP support: Business and Enterprise/Edu, with workspace permissions. Pro has read/fetch restrictions; do not imply 45 actions work there. Other individual plans are **not verified** for full control. Web only for this custom MCP setup. | **NOT TESTED** |
| ChatGPT Work/Desktop browser control | OpenAI's separate official browser extension and its own Computer Use permissions | This is OpenAI's browser integration, **not LUCH**. Do not treat it as evidence that a LUCH extension is automatically available to ChatGPT. | **NOT APPLICABLE** |
| Other tools (Cursor, Claude Code, etc.) | Must independently validate their supported MCP transport, local/remote access and account permissions | Never claim feature parity or universal subscription access without a real per-host test. | **NOT TESTED** |

Official current source URLs:
- Claude: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- ChatGPT: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
- ChatGPT's separate browser integration: https://learn.chatgpt.com/docs/chrome-extension

## The missing actual connection (release-blocking)

Current 0.6.0 Chrome MV3 extension → localhost `127.0.0.1:9248` broker → consented Bridge route exists **as an engineering candidate**. It is not a public cloud MCP endpoint. ChatGPT and Claude cloud connectors **cannot** reach a localhost address on a user's computer.

For an ordinary new user to succeed, the following *must be implemented and verified*, without inventing a personal AI API key:

1. Public `https://…/mcp` Streamable HTTP endpoint on TCP 443 with standards-compliant discovery/tool calls.
2. OAuth user login and per-user tenant/device identity, secure token lifecycle and explicit client grants. Never grant a cloud host the local broker's Bridge secret.
3. Authenticated account-bound relay from cloud MCP to the **same** user's paired LUCH Companion; no unrelated tenant, browser, or fallback profile.
4. Local extension's explicit per-tab read, interaction, and pointer grants; tab metadata opt-in is separate. Revalidate these at execution time.
5. A test from a **real existing Claude Free** session and an eligible **real ChatGPT** session: enumerate permitted tabs, select/approve a real tab, execute a real click, reject denied/revoked action. Record request IDs and sanitized evidence.
6. Clean-account install, Opera runtime evidence, independent security & UX review. No silent production migration.

## What was actually changed in R11

- The precise-pointer route rechecks the *live* original tab origin, exact grant ID, interaction permission and pointer approval immediately before debugger actions. Drag validates intermediate points; native debugger detaches in cleanup.
- Added a navigation-race regression test: a site change between preflight and native debugger attach must not produce a click.
- Users can now **switch to an open HTTP(S) tab** from the tab overview through an explicit button. This does **not** grant access to that tab's content: the user must reopen the popup and authorize read and interaction separately.
- These code and test changes are **pending exact-head CI/independent QA**; operation counts have not changed.

## Links, installation and publication

Canonical engineering status and stable reference: https://github.com/lenar2/luch/pull/12

Do **not** instruct customers to download a temporary GitHub Actions artifact: artifacts expire and can return 404. Draft ZIPs in the PR are not approved public installation assets. When genuinely ready, distribute from a permanent, versioned public GitHub Release and the verified Chrome Web Store and Opera Add-ons listings, with checksums and instructions tied to that exact build. Never present a draft artifact as a published extension.

Current support/website candidates (HTTP and content must be rechecked for the actual release):
- https://luch.lenarsalimov.ru/ru/connect/
- https://luch.lenarsalimov.ru/en/connect/
- https://github.com/lenar2/luch/blob/main/docs/browser-companion-support.md
- https://github.com/lenar2/luch/blob/main/docs/browser-companion-privacy.md

Release remains **HOLD**: no valid multi-host, multi-tenant, end-to-end ready product has been shown.
