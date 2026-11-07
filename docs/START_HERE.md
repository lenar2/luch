# Start with the AI you already use

[← LUCH](../README.md) · [Русский](START_HERE.ru.md) · [Service availability](https://luch.lenarsalimov.ru/en/status/)

**First, an honest check:** LUCH is operating for enabled accounts, but independent self-service onboarding of a new customer has not yet been verified. There is no universal “connect now” action that can truthfully promise access.

| If you use… | Go here | What to expect now |
| --- | --- | --- |
| **ChatGPT** | [Integration candidate](https://github.com/lenar2/luch-claude-plugin/tree/main/integrations/chatgpt/) | Founder private integration works; the public package is **not** an approved OpenAI Directory listing |
| **Claude** | [Claude adapter](https://github.com/lenar2/luch-claude-plugin/) | Published client source; host approval and new-user access must be checked |
| **Cursor** | [Cursor adapter](https://github.com/lenar2/luch-cursor/) | Local installation instructions exist; an enabled account and OAuth sign-in are required |
| **Gemini CLI** | [Gemini CLI extension](https://github.com/lenar2/luch-gemini/) | CLI installation steps exist; successful new-user OAuth end-to-end is not verified |
| **Kimi** | [Candidate branch](https://github.com/lenar2/luch-claude-plugin/tree/kimi-v0.1.6-candidate) | Candidate only, not a confirmed public catalog release |

## If you already have an enabled account

1. Follow your host-specific README. Authenticate through the supported flow, never by copying an owner's credentials.
2. Find the exact authorized browser, file or server. An offline or unpaired device is not an invitation to use another one.
3. Start read-only: *“Read this public page and tell me what it says, with a source link.”*
4. Confirm the actual result and any permissions used. Ask before external publication, deletion or other consequential actions.

## If you do not have access

The public adapters let you inspect code, **not** bypass account enrollment. Do not attempt unsupported workarounds or use private endpoints. Read [service status](https://luch.lenarsalimov.ru/en/status/) and [support options](https://luch.lenarsalimov.ru/support/). The onboarding gap is explicitly [tracked as unverified](RELEASE_READINESS.md).

The [real founder-environment case](REAL_WORK.md) illustrates what permissioned work can look like, without pretending the same access is generally available.
