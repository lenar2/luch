# LUCH

**Your AI, beyond the chat.**

**LUCH is a permissions-aware execution layer that connects AI assistants to the browsers, files, computers, and servers you explicitly authorize.**

[**Website**](https://luch.lenarsalimov.ru/) · [**See capabilities**](https://luch.lenarsalimov.ru/#capabilities) · [**Get started**](https://luch.lenarsalimov.ru/docs/get-started/) · [**Русский**](README.ru.md) · [**Security**](SECURITY.md)

> **EARLY ACCESS — public client code, limited service access.** LUCH already operates for enabled accounts. **Independent self-service signup → OAuth → device pairing → first authorized action has not yet been verified for an arbitrary new user.** Installing a client alone does not grant an account or access to anyone's devices.

## What can LUCH do for you?

You describe a task to your AI. LUCH provides a permitted way to carry it out and report what actually happened.

| Ask your AI | What LUCH can do, when enabled and authorized |
| :--- | :--- |
| **“Compare the information on these two websites.”** | Launch an isolated, temporary **cloud browser**; read or interact with supported public pages; release the session. It does not require your Mac to stay online. |
| **“Check whether my Linux server is healthy.”** | Select an explicitly paired **server**, run a bounded permitted command, and return the actual status and output. |
| **“Summarize the documents in the folder I shared.”** | Read **approved files** through a supported, online device or connected resource, within that account's permissions. |
| **“Show me which of my computers are online.”** | Discover **your paired devices**, their current state, and available actions — without silently switching to another user's machine. |
| **“Use my open browser or app to complete this step.”** | Where supported, operate a **paired computer** using its permitted browser or computer-control tools. |

**Why this matters:** AI is useful when it can move from suggesting an action to executing one with your permission. LUCH provides multiple execution paths — an isolated remote browser, a paired computer, or a connected server — rather than assuming everything has a convenient API.

### A concrete example

> **You:** “Open these two product documentation pages, compare the relevant API limits, and show the source links. Don't change anything.”

An appropriately authorized AI can acquire a temporary browser, visit the pages, read the content, cite the information it found, and release that browser. If a site or tool is unavailable, it should report the failure — **not invent a result**. This is an illustrative workflow, **not** evidence of fresh-customer end-to-end certification.

## One LUCH. Your choice of AI.

| Client | Source / installation information | Actual status |
| :--- | :--- | :--- |
| **ChatGPT / Codex** | [Client candidate](https://github.com/lenar2/luch-claude-plugin/tree/main/integrations/chatgpt) · [Preview ZIP](https://luch.lenarsalimov.ru/downloads/luch-chatgpt-0.1.6-preview.zip) | Existing **private** LUCH 0.3.51 integration; public submission and new-user OAuth review not complete |
| **Claude** | [LUCH for Claude](https://github.com/lenar2/luch-claude-plugin) | Public source; marketplace review is separate |
| **Cursor** | [LUCH for Cursor](https://github.com/lenar2/luch-cursor) | Public client source; new-user access not yet guaranteed |
| **Gemini CLI** | [LUCH for Gemini CLI](https://github.com/lenar2/luch-gemini) | Public extension source; fresh-user verification pending |
| **Kimi** | [Kimi candidate](https://github.com/lenar2/luch-claude-plugin/tree/kimi-v0.1.6-candidate) | Candidate only; no confirmed public catalogue listing |

**This is the official product hub.** Individual client repositories remain separate so installation links and marketplace submissions do not break. The product is **LUCH**, not “LUCH for Claude.”

### Getting started

1. **Explore the [capabilities](https://luch.lenarsalimov.ru/#capabilities)** and choose a supported AI client above.
2. **Review the [connection instructions](https://luch.lenarsalimov.ru/docs/get-started/)**. An enabled account and host-compatible OAuth flow are required for live tool access.
3. **Start read-only.** Ask the AI to show only the LUCH devices and tools authorized for your account, or run a bounded public-page read in a temporary browser.
4. **Verify the actual result**, including the chosen device, permission scope, and whether the operation truly executed.

The source ZIP is **not a native desktop or iPhone installer**, and no client contains server-side implementation, passwords, or owner tokens.

## Built around your permission

- **Explicit device selection.** A specified offline or unpaired device must fail closed, not reroute silently.
- **Account-scoped access.** Permissions depend on the user, device, host, and available tool.
- **Isolated server browser.** Temporary sessions are scoped to a task and released afterward.
- **Actual execution evidence.** A transport receipt or “accepted” response is not proof that a requested action was completed.
- **No authorization bypass.** LUCH does not override OAuth, operating-system permissions, or your chosen access controls.

Native iPhone control, autonomous coordination of independent AI agents, and all-platform public availability are **separate development tracks**, not promises of the current public Core release.

## Release status

| Item | State |
| :--- | :--- |
| International website and English/Russian versions | **Live** |
| Public client source for Claude, Cursor, Gemini | **Available** |
| OpenAI portable package schema validation | **Passed (static only)** |
| Public MCP rejecting unauthenticated requests | **Verified (401)** |
| Fresh-user signup, OAuth, pairing, permitted action and cross-account denial | **Not independently verified — HOLD** |
| General public subscription, complete platform approvals and production-scale launch | **Not claimed** |

See [release verification gates](docs/RELEASE_READINESS.md). We do not treat **UNKNOWN** as **PASS**.

## Follow and contribute

If you find LUCH useful or want to follow its development, click **⭐ Star** at the top of this repository. Stars show interest; they are **not** installation or active-user counts.

[Report an issue](https://github.com/lenar2/luch/issues/new) · [Request a feature](https://github.com/lenar2/luch/issues/new) · [Support](https://luch.lenarsalimov.ru/support/) · [Privacy](https://luch.lenarsalimov.ru/privacy/) · [Terms](https://luch.lenarsalimov.ru/terms/)

**Repository scope:** This hub contains public documentation and integration pointers. It does **not** publish the hosted LUCH server, private control infrastructure, user credentials, or user data. Public client packages have their own stated licenses; this hub does not relicense backend code.
