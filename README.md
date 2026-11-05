<p align="left"><img src="website/assets/luch-ray.svg" width="62" alt="LUCH eight-ray symbol"></p>

# LUCH
### Your AI. Your tools. Work you can verify.

**LUCH is a permission-aware execution layer** that lets supported AI clients use authorized browsers, paired computers, approved files, GitHub, terminals and connected services.

[Website](https://luch.lenarsalimov.ru/) · [Get started](https://luch.lenarsalimov.ru/docs/get-started/) · [Security](SECURITY.md) · [Русский](README.ru.md)

> **Availability, without guesswork:** LUCH is operating in its founder's connected environment. Independent end-to-end activation for an arbitrary new customer (account → OAuth → pairing → first permitted action) is **not yet verified**. Published client source is not a guarantee of service access. The bilingual public website is now live at https://luch.lenarsalimov.ru/ and its text-based source is published under `website/`. This does not verify fresh-customer OAuth or device pairing.

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
- **Specialized sources** — GetCourse (read-only); Tilda authoring (not currently available; authorization required); Apple Notes, photos and separate Figma integration work.

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

## Published bilingual product website

The public EN/RU product site is [live](https://luch.lenarsalimov.ru/). Its static HTML, CSS, JS and SVG sources for 32 routes are maintained in [website/](website/), with a [SHA-256 source manifest](website/MANIFEST.sha256). The human task → permitted tools → inspectable result examples are illustrations, not records of customer executions.

The released site preserved the existing getting-started guide, legal/support pages and downloadable preview client. The download binary is hosted at the public site rather than duplicated in Git history. See [deployment provenance](website/DEPLOYMENT.md).

**Scope:** static-site release and HTTP checks passed. Fresh-customer signup, OAuth, pairing and first real authorized action remain **UNKNOWN / HOLD**.

[Suggest an improvement](https://github.com/lenar2/luch/issues/new) · [Privacy](https://luch.lenarsalimov.ru/privacy/) · [Terms](https://luch.lenarsalimov.ru/terms/)

This hub does not relicense other client packages or publish the hosted service.
