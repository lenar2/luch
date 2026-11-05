<p align="left"><img src="website/assets/luch-ray.svg" width="62" alt="LUCH eight-ray symbol"></p>

# LUCH
### Your AI. Your tools. Work you can verify.

**LUCH is a permission-aware execution layer** that lets supported AI clients use authorized browsers, paired computers, approved files, GitHub, terminals and connected services.

[Website](https://luch.lenarsalimov.ru/) · [Connect](https://luch.lenarsalimov.ru/en/connect/) · [Security](SECURITY.md) · [Русский](README.ru.md)

> **Availability, without guesswork:** LUCH is operating in its founder's connected environment. Independent end-to-end activation for an arbitrary new customer (account → OAuth → pairing → first permitted action) is **not yet verified**. Published client source is not a guarantee of service access. The current live website is separate from the HEA V7 draft in this repository.

---

## Begin with the work, not a plugin

**“Find why the page changed after the update. Prepare a fix I can review.”**

With the necessary permissions, the AI can inspect a webpage, compare approved files and repository context, reproduce a problem where supported, then prepare a **reviewable change with evidence**. This is a workflow illustration, not a claim that a particular run has happened.

Other concrete jobs include comparing two sources in a temporary browser, collecting referenced information from approved files, and checking the state of an explicitly selected server.

**LUCH changes what the assistant can reach — not who has authority.** A submitted task is not execution. A PR is not a production release. An ACK from another AI is not proof the work completed.

## What it connects

- **Websites and web apps** — bounded page reads or supported interactions in isolated or authorized browser sessions.
- **Paired computers** — GUI, keyboard, mouse, window and accessibility operations when the host and OS permit them.
- **Files and documents** — authorized discovery, reading, comparison and specific permitted changes.
- **Development** — GitHub code, branches, PRs, supported terminals and named servers.
- **Other AI contexts** — Peer Bus messages and optional bridges; execution availability requires separate evidence.
- **Specialized sources** — GetCourse (currently read-only), Tilda authoring is not currently available in the connected environment (authorization required); Apple Notes, photos and separate Figma integration work.

These capabilities are **account-, device-, host- and permission-dependent**. Native full iPhone control and unrestricted autonomous multi-agent execution are not part of the verified public Core.

## Choose a client

- [ChatGPT integration source](https://github.com/lenar2/luch-claude-plugin/tree/main/integrations/chatgpt) · [Preview package](https://luch.lenarsalimov.ru/downloads/luch-chatgpt-0.1.6-preview.zip) — package/public submission and fresh-user verification remain separate gates.
- [Claude](https://github.com/lenar2/luch-claude-plugin) — public integration source; marketplace approval may differ.
- [Cursor](https://github.com/lenar2/luch-cursor) — client source; service activation not guaranteed.
- [Gemini CLI](https://github.com/lenar2/luch-gemini) — extension source; independent fresh-user test pending.
- [Kimi candidate](https://github.com/lenar2/luch-claude-plugin/tree/kimi-v0.1.6-candidate) — candidate, not an approved public catalog listing.

### First safe task

1. Read the [connection guide](https://luch.lenarsalimov.ru/docs/get-started/) and verify the account is enabled.
2. Ask the client which **LUCH tools and devices are authorized** for the current account. Never assume a device name or routing target.
3. Start with one **read-only** browser or file operation.
4. Inspect the actual output, scope, provenance and any errors before granting write access.

No install archive is an iPhone or native Mac installer, and no public client contains hosted backend secrets.

## Trust model

**Explicit selection.** Unpaired/offline devices fail closed; LUCH must not silently substitute another device.

**Scoped permission.** Tool access depends on the account, connection, device, host and operation.

**Evidence over receipts.** Transport success or task acceptance does not mean the action actually happened.

**No bypass.** OAuth and OS access checks remain in force. Private infrastructure, credentials and real user data are not in this repository.

See [SECURITY.md](SECURITY.md), [release readiness](docs/RELEASE_READINESS.md) and [support](https://luch.lenarsalimov.ru/support/).

## Website design candidate

The bilingual homepage layer is in [website/](website/). It is **not deployed**. It replaces the brochure-style lead with a human task → authorized tools → inspectable outcome narrative. The editorial workflows are explicitly examples, not live activity.

This branch contains the homepage layer and its design assets; existing capability, connection, safety, legal and support routes remain unchanged. The branch alone is not a standalone deployment bundle. Preview it only against the complete static-site tree. **Do not deploy or merge before independent QA and Founder visual acceptance.**

[Suggest an improvement](https://github.com/lenar2/luch/issues/new) · [Privacy](https://luch.lenarsalimov.ru/privacy/) · [Terms](https://luch.lenarsalimov.ru/terms/)

This hub does not relicense other client packages or publish the hosted service.
