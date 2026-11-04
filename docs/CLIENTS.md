# Choose an AI client for LUCH

**LUCH is the platform.** Each AI application is a client that can expose a different subset of permitted tools and skills.

## ChatGPT and Codex

- Existing authenticated **LUCH 0.3.51** is a private plugin in the founder's ChatGPT account, operating with the canonical hosted MCP endpoint.
- [OpenAI public package candidate](https://github.com/lenar2/luch-claude-plugin/tree/main/integrations/chatgpt) includes validated manifests and public skills, prepared separately from the private package.
- The private install proves an actual owner connection, **not** that arbitrary third-party customers have been granted accounts.
- OpenAI publisher identity, store review and visible public listing are separate from the functioning software.

## Claude

- [LUCH Claude package](https://github.com/lenar2/luch-claude-plugin) is a dedicated adapter.
- Actual Anthropic manage dashboard showed an existing submission, passed automated scan, directory policy warnings and a not-live version. Reviewer-request control and account verification were not confirmed complete.
- The earlier independent Claude artifact audit had real scoped findings; do not transfer its verdict blindly to the current version.

## Cursor

- [LUCH Cursor package](https://github.com/lenar2/luch-cursor) is publicly downloadable.
- A repository is not itself proof of a published marketplace listing. Its actual publisher status must be read from a signed-in dashboard.

## Gemini CLI

- [LUCH Gemini extension](https://github.com/lenar2/luch-gemini) has a public source package.
- Real installation/OAuth and client-specific available tools need a separately authorized test identity.

## Kimi

- [LUCH Kimi adapter candidate](https://github.com/lenar2/luch-claude-plugin/tree/kimi-v0.1.6-candidate).
- User and assistant used the Kimi feedback interface to request the correct publisher route; that is not confirmed official catalogue admission.

## Remote MCP endpoint

For an enabled LUCH account, the established private ChatGPT integration uses:

```text
https://luch.lenarsalimov.ru/luch/mcp
```

The isolated restricted public-core candidate used by some client adapters is a *distinct resource* and not interchangeable with the founder's private plugin. Avoid copying privileged tokens into a new client or changing OAuth resource origins silently.

The MCP endpoint challenges unauthenticated requests. Anonymous rejection does not itself prove a new user's OAuth success.

## Availability states

**Operational owner account**, **publicly downloadable client source**, **provider package scanned**, **marketplace approved**, **marketplace published**, and **independently tested fresh-user onboarding** are six different facts. Do not collapse them into a single global “early access” or “production approved” label.

**Product website:** [LUCH](https://luch.lenarsalimov.ru/) · [Russian](https://luch.lenarsalimov.ru/ru/).
