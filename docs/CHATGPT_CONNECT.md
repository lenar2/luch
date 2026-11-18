# ChatGPT × LUCH — existing-chat connection (18 November 2026)

[Back to setup](START_HERE.md) · [Русский](CHATGPT_CONNECT.ru.md)

**What this does:** LUCH adds tools to the ChatGPT conversation you already use. You do not need a separate LUCH chat and do not have to buy or supply an OpenAI API key. Your ChatGPT plan and workspace still control whether third-party tools may be connected and which actions they may run.

## Current supported path

ChatGPT's official product documentation describes custom **remote MCP** connections in Plugins / custom apps. Connecting an external server is a separate user-authorized step: installing a Chrome extension by itself does not install tools in an existing ChatGPT chat.

Official reference: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt

At this date the documented full MCP write/modify experience is available in eligible Business and Enterprise/Edu web workspaces, subject to admin permissions. Pro custom connections are read/fetch-limited. Do not assume unrestricted writes for Free, Go, Plus, Pro or every region/surface.

## Browser Companion status

Browser Companion v0.6.0 is a **DRAFT / RELEASE HOLD** engineering candidate. The candidate can route a defined set of 45 browser operations through an authorized **local** Companion broker on `127.0.0.1:9248`, with explicit tab-level grants and separate cursor access. This is **not** yet a public, account-scoped remote MCP service that a new ChatGPT account can connect to.

The missing production step is a verified public HTTPS MCP gateway with secure login and tenant/device isolation, reliable pairing to each user's Companion and actual host-to-tab E2E. Therefore no ready-to-paste universal LUCH MCP URL is claimed here.

**If you already have an authorized LUCH integration:** ask ChatGPT to list currently available LUCH tools before attempting work. If it lacks them, do not provide any password, personal API key or unsupported manual-browser workaround.

**If this is your first connection:** check [current eligibility](https://luch.lenarsalimov.ru/en/status/) or [support](https://luch.lenarsalimov.ru/support/). Do not install a draft ZIP from an expiring GitHub Actions artifact.

[Engineering record, implementation gates, and release status](https://github.com/lenar2/luch/pull/12).
