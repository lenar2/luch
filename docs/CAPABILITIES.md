# LUCH capabilities — verified tool inventory

**Scope:** one authenticated owner ChatGPT environment exposing **158 LUCH tools**. The numbers describe the mounted LUCH tool catalog, not necessarily public skills, independent customer access or permissions granted in every host. It is a capability inventory, **not a certification that every action can currently run on every user account**.

## Product operating model

**AI client → LUCH remote MCP → identity + permission scopes → execution routing → selected transport → real result/evidence.**

Execution can use a server browser, paired desktop/browser, terminal, device relay, service UI/API or structured internal coordination. A tool can be *defined* and still require a paired device, authenticated service, or live provider session.

## Observed tool-family inventory

| Family | Exposed tool operations | Real scope observed |
| --- | ---: | --- |
| Browser (cloud + paired browser) | **54** | Isolated server browser available; GUI/browser target binding depends on paired Mac and session |
| GitHub | **23** | Repository inspection, branches/commits, file changes, PRs/issues, releases and evidence, where authorized |
| Servers and devices | **17** | Server companion online independently of Mac; explicit device IDs, paired devices and commands |
| Agent coordination and Chat Bridge | **12** | Peer Bus online; ChatGPT/Claude bridge transport exists; target model/browser readiness is separate |
| Photos and iPhone | **15** | Photos and cached media; native unrestricted iPhone app control not implemented |
| Tilda | **9** | Model and viewer routes exist; authenticated authoring not currently ready |
| GetCourse | **6** | Authorized UI read and access verification; writes guarded/unavailable |
| Computer and native UI | **5** | Mac computer read/actions, native AX/OCR; paired online device and OS permissions |
| Terminal and jobs | **5** | Bounded commands and job lifecycle on available companion |
| Files | **4** | Read/list/search, edit and manage operations; stale-write protection |
| Apple Notes | **3** | Read and two-phase confirmed writes on paired Mac |
| System / transport / Telegram extract / onboarding | **5** | Diagnostics, transport recovery, controlled enrollment and extraction |
| **Total** | **158** | **One connected inventory, not general-market exposure** |

**Counter interpretation:** individual tools are high-level APIs that may provide multiple named operations. Example: the Mac computer tool supports more than a dozen read operations and more than a dozen input/action operations. These are **not added** to 158 because it would double-count named subcommands.

## Current runtime readback

- **Mac computer**: companion HEALTHY; computer read supports system information, screen/window/accessibility, files and clipboard. Actions include apps, window movement, pointer, keyboard and clipboard.
- **Files**: read operations stat/list/read/search; write and manage operations present; `expectedSha256` stale-write guard.
- **Apple Notes**: read/search/list/attachments plus create/update/append/move/delete/export. Writes require two-phase argument-bound confirmation.
- **Server companion**: healthy; does **not** require Mac.
- **Server browser**: online, execution-owned temporary sessions; router version 0.3.4.
- **Peer Bus**: online and has real historical messages, but a bus receipt does not authenticate a live model invocation.
- **Chat Bridge**: transport components present. At the latest check, both ChatGPT and Claude target surfaces were NOT execution-ready, so **unattended current execution cannot be claimed**.
- **GetCourse**: real authenticated read-only UI observation; API credentials for CRUD absent; modifications disabled.
- **Tilda**: native capability family exists, but authoring requires authenticated UI session and current runtime is not authoring-ready.
- **iPhone**: media cache and companion-related functions exist; live full native app automation not implemented and current companion not live.
- **Figma**: a separate Figma connector is available in the founder's AI environment and a LUCH Figma bridge prototype is documented, but no universal production LUCH-to-Figma write E2E is attested.

## Independent proof vs operational proof

1. Months of owner operation prove the platform is **real and useful**; this is not a slideware concept.
2. Anthropic automated scan passed for the latest Claude package (source submission exists), which is actual third-party **package/static scan evidence**.
3. Historical independent Claude review ran on an earlier artifact with both findings and tests; exact version/scope must be preserved. Technical scan approval is **not identical** to independent OAuth/tenant security certification.
4. No generic „EARLY ACCESS” banner should reduce the product to a hobby project. Publication status belongs to a **separate host/release status section**.
5. Public claims of every-user self-service require a fresh, third-party account and independent E2E. Product capability and **distribution state are distinct**.

## Long-term platform

LUCH Core offers the tool substrate; separate **Managed Agents** are the future service for long-running tasks and hosted compute. Self-directed tools remain free by founder policy. See [Managed Agents](AGENTS.md).

## QA requirements

Product and capability claims need actual host-bound receipts, not mere tool names. Independent design and accessibility QA must evaluate the rendered EN/RU site at mobile and desktop widths, source-to-copy traceability, brand, accessibility, first-task success, permissions and no invented store/price/status claim. No participant data is required for the published capability overview.

**Evidence scope:** tool inventory and sampled runtime checks from the connected account. Public-client installation, service access and individual permissions have separate acceptance criteria.
