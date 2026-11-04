# LUCH

**One connection. Your entire digital workspace within reach of AI.**

LUCH is a **powerful, permissioned MCP execution platform**. It connects AI to the tools that normally live apart: **cloud and desktop browsers, computers, Apple Notes, files, terminal, servers, GitHub, connected services and agent coordination**. AI can move from understanding a task to taking authorized steps and showing what really happened.

[**Explore LUCH**](https://luch.lenarsalimov.ru/) · [**Full capabilities**](docs/CAPABILITIES.md) · [**Connect your AI**](docs/CLIENTS.md) · [**Managed Agents**](docs/AGENTS.md) · [**Русский**](README.ru.md)

### 158 connected tool operations. One operating layer.

The current owner's ChatGPT connection exposes **158 LUCH tool operations**, including 54 for web/browser execution, 23 for GitHub, 17 for server/device operations, and 12 for Peer Bus and Chat Bridge. Those are **real tool definitions available in that connected environment**, not a guarantee that every fresh user or AI host receives the same permissions or tools.

## What becomes possible?

Imagine asking an AI to **investigate an engineering issue**, read a set of approved project notes, inspect the relevant GitHub history, work in an isolated browser or a paired computer, prepare a bounded code change, open a pull request, check the server and return links to verified results.

That is the power of LUCH: **connected execution across tools rather than a single disconnected plugin action**. Each action uses a real available tool, explicit authorization and observable evidence.

#### Browser orchestration beyond a tab

Open public pages in temporary cloud browsers; use connected local browsers when the task depends on your session. Read DOM/accessibility information, navigate, fill forms, click, scroll, capture screenshots, upload/download within the available permission scope, and release temporary sessions afterward.

#### Computer, files and Apple Notes

Read screen, window and application state; carry out authorized mouse, keyboard and accessibility actions on a paired Mac. Search, read and update permitted files and notes. File writes can use stale-write protection; Apple Notes mutations use explicit two-phase confirmation.

#### Terminal, servers and development

Operate explicitly paired server infrastructure, inspect real command results and task status. GitHub tools extend beyond cloning: search repositories, compare commits, create branches, modify files, work with issues and pull requests, and use release and evidence workflows where permitted.

#### Business applications and visual design

LUCH has integrations for GetCourse account/access checks and Tilda page/editor operations, with actual read/write capability determined by authorization and host readiness. There is a Figma bridge workstream, alongside a separately connected Figma provider; do not confuse a design bridge candidate with verified universal Figma control.

#### Agent coordination

LUCH includes a **Peer Bus**, task handoffs, receipts and **Chat Bridge** transport for ChatGPT and Claude. Those mechanisms are real components of the product. Autonomous invocation of each external AI conversation is a *separate host-specific readiness check*, rather than a promise derived from a queued message.

#### Photos and iPhone

Read/search authorized photo sources and selected paired/cached mobile media. Native system-wide iPhone app control belongs to an independent engineering track.

[**Explore the detailed capability map →**](docs/CAPABILITIES.md)

## Work through the AI you prefer

**[ChatGPT / Codex](https://github.com/lenar2/luch-claude-plugin/tree/main/integrations/chatgpt)** — existing private LUCH plugin plus a public client candidate.  
**[Claude](https://github.com/lenar2/luch-claude-plugin)** — public package; latest submission passed an automated Anthropic scan and awaits the next publisher/review step.  
**[Cursor](https://github.com/lenar2/luch-cursor)** — public plugin source.  
**[Gemini CLI](https://github.com/lenar2/luch-gemini)** — public extension source.  
**[Kimi](https://github.com/lenar2/luch-claude-plugin/tree/kimi-v0.1.6-candidate)** — adapter candidate.

LUCH is **not** a Claude product. This is the independent product repository; each platform-specific package remains in its own repository for installer and review compatibility.

## Your tools are free. Managed work is a separate offer.

Self-directed LUCH Core tools are intended to be available without individual paid feature unlocks, subject to appropriate security and fair-use limits. **LUCH Managed Agents** is the planned separate service for long-running, coordinated tasks, QA, recovery and managed compute. Read its [product concept](docs/AGENTS.md); no nonexistent paid subscription is being sold.

## Trust and observed behavior

Use OAuth and user/device-specific grants. An explicitly selected offline or unauthorized device must not silently reroute to a different machine. A received message is not equivalent to a task executed. The public client packages do **not** expose the proprietary hosted LUCH service or anyone's credentials.

For transparency, the [capability matrix](docs/CAPABILITIES.md) distinguishes functions observed in an authorized account, functions requiring a paired device, and host-specific release checks. **LUCH has been used operationally for months in the owner's environment**. Broader marketplace approvals and independent first-time sign-in are evaluated separately; they do not define the product's capability ceiling.

## Follow LUCH

Click **⭐ Star** if you want to follow the project. Stars show interest, not installation numbers.

[Get started](https://luch.lenarsalimov.ru/docs/get-started/) · [Support](https://luch.lenarsalimov.ru/support/) · [Privacy](https://luch.lenarsalimov.ru/privacy/) · [Terms](https://luch.lenarsalimov.ru/terms/) · [Security](SECURITY.md)

*The license of this documentation hub does not include hosted backend code, customer data or LUCH trademarks. Version and permission scopes are specific to individual AI clients.*
