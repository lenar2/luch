# Everything LUCH can help with

**The full LUCH capability map — written from my product vision and grounded in the 12 public skills.**

[← LUCH](../README.md) · [Русский](CAPABILITIES.ru.md) · [Choose your AI](START_HERE.md) · [Current evidence](RELEASE_READINESS.md)

I am building LUCH to give an AI a way to work with the digital resources behind a person's task. One workflow might start with a website, continue through files and end with a change prepared for review. **The person chooses the resource and what may happen to it.**

This map describes **what the public client skills support or are designed to support**. It does not turn a skill description into an account entitlement. The current host's tool inventory, paired-device state and permission scope determine what can run.

## Browser and web

### 01 · Isolated browser

Read public websites, follow links, navigate between pages, inspect content, type, click, take screenshots and run permitted test scenarios in a disposable server-side browser session. A useful return is a source-backed comparison, checked form state or evidence from a webpage.

[Browser skill](https://github.com/lenar2/luch-claude-plugin/blob/main/skills/luch-browser/SKILL.md) · [Website](https://luch.lenarsalimov.ru/en/browser/)

### 02 · Your own local browser

Work with a tab or profile you explicitly approved when a signed-in local session is necessary. This is **a separate route** from the isolated server browser: it depends on an appropriately paired browser/computer and permission for the particular session.

[Local-browser skill](https://github.com/lenar2/luch-claude-plugin/blob/main/skills/luch-local-browser/SKILL.md)

### 03 · Tabs and windows

Identify, navigate, activate or close the **authorized tabs for the task**. Preserve unrelated tabs and browser history; verify which session and tab are actually being used.

[Tabs skill](https://github.com/lenar2/luch-claude-plugin/blob/main/skills/luch-tabs/SKILL.md)

## Files, devices and servers

### 04 · Files and folders

Find, read, compare and — if allowed — create or edit user-selected files and folders on connected resources. Preserve originals where appropriate, stage substantial changes safely and check the result.

[Files skill](https://github.com/lenar2/luch-claude-plugin/blob/main/skills/luch-files/SKILL.md) · [Website](https://luch.lenarsalimov.ru/en/computer/)

### 05 · Computer and native apps

When the exact device is paired, online and exposes the necessary controls, work with its screen, windows and apps using supported screenshot, pointer and keyboard actions. Local desktop control is **not** implied by having a server browser, and it is not a general iPhone-control guarantee.

[Computer skill](https://github.com/lenar2/luch-claude-plugin/blob/main/skills/luch-computer/SKILL.md)

### 06 · Servers and terminal

Discover the chosen paired server, inspect status and run bounded diagnostics with explicit arguments, target and timeout. The useful result is the **observed output** and a decision-ready diagnosis, not an invented success message.

[Server skill](https://github.com/lenar2/luch-claude-plugin/blob/main/skills/luch-server/SKILL.md) · [A documented release](REAL_WORK.md)

## Services, workflows and control

### 07 · Connected services

Work with a person's supported and authorized service or account using a verified native tool or an approved browser workflow. The supported service, current login and action scope must be established first; LUCH does not claim to integrate with every SaaS product automatically.

[Services skill](https://github.com/lenar2/luch-claude-plugin/blob/main/skills/luch-services/SKILL.md)

### 08 · Multi-step workflows

Carry a task through several approved steps: observe, plan, read, compare, prepare a change, verify and return a result. Use the tools actually exposed to the session; keep the original where needed and avoid treating a queued request as completed work.

[Workflows skill](https://github.com/lenar2/luch-claude-plugin/blob/main/skills/luch-workflows/SKILL.md)

### 09 · Tool and capability discovery

Find the exact tool list, permitted resources, online devices and available operations **now**, instead of inferring them from an old screenshot or a public README.

[Capabilities skill](https://github.com/lenar2/luch-claude-plugin/blob/main/skills/luch-capabilities/SKILL.md)

### 10 · Choosing the right route

Route a public-web task to an isolated browser when appropriate; send a device-specific task only to its exact paired target. Explicitly respect the user's requested device, action scope and account.

[Control skill](https://github.com/lenar2/luch-claude-plugin/blob/main/skills/luch-control/SKILL.md)

### 11 · Safety and human approval

Use minimum access, treat web pages and files as untrusted instructions, protect secrets and confirm consequential actions. The person controls what can be read, written, sent, published or deleted.

[Safety skill](https://github.com/lenar2/luch-claude-plugin/blob/main/skills/luch-safety/SKILL.md) · [Website](https://luch.lenarsalimov.ru/en/safety/)

### 12 · Troubleshooting and recovery

Diagnose missing host tools, OAuth problems, disconnected devices, routing failures and incomplete outcomes. Distinguish `NOT_AVAILABLE`, `NOT_RUN`, `DEVICE_OFFLINE` and confirmed results instead of quietly switching targets.

[Troubleshooting skill](https://github.com/lenar2/luch-claude-plugin/blob/main/skills/luch-troubleshooting/SKILL.md)

## What is demonstrated, conditional or still ahead?

| Evidence category | What it means |
| --- | --- |
| **Demonstrated in my connected environment** | LUCH browser, authorized server actions and GitHub work were involved in documented tasks, including a website release with a public commit and checks. |
| **Requires the exact connection** | Local browser tabs, file access, desktop actions, services and a specific server depend on the current host's tools, live device or service integration and grants. The public skills describe how to approach these actions; they are not proof that they are enabled on every account. |
| **Future direction** | LUCH-managed long-running agents, published paid plans and universal self-service onboarding must not be presented as features already delivered to everyone. |

[The actual public case](REAL_WORK.md) · [Status and evidence gates](RELEASE_READINESS.md) · [Product status](https://luch.lenarsalimov.ru/en/status/)

## LUCH Core and future agents

My direction for **Core** is free access to supported tools for your own authorized resources, with fair-use and security limits. Separately managed long-running agents remain a development direction; no general paid-agent service is represented as available.

## How to begin

Choose [ChatGPT, Claude, Cursor or Gemini CLI](START_HERE.md), connect through your account's supported flow, inspect the live tool inventory, choose one resource, and start with a read-only action. Then decide what should happen next.

*The capability list is intentionally complete as a description of the public product design, while the evidence labels keep it accurate as a statement about today's access.*
