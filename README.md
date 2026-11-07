<p><img src="website/assets/luch-ray.svg" alt="" width="40"></p>

# LUCH
### I want AI to do more than answer. I want it to help get work done.

I am building **LUCH to connect AI with real digital work**. Not another chat window: a connection to the browser, files, apps, devices, servers and services you choose. The AI can inspect, compare, prepare changes and — with the right authority — act, then show you what happened.

[**Explore every capability**](docs/CAPABILITIES.md) · [**A real result**](docs/REAL_WORK.md) · [**Connect your AI**](docs/START_HERE.md) · [Русский](README.ru.md) · [Website](https://luch.lenarsalimov.ru/en/)

![From a human request to selected tools and a result that can be checked](docs/visual/platform-journey-en.svg)

## Real work. Not hypothetical superpowers.

I use LUCH for much more than improving LUCH itself. These are three different kinds of work my connected environment has helped complete — each with a real outcome, not just a prompt.

### 01 · Two customers paid. Their access never arrived.

A live audio-to-text service had accepted payments, but the associated minutes had not reached the customers' balances.

**Through my authorized cloud server,** the work traced the original transactions to the payment provider, reconciled the exact affected accounts, restored **240 minutes to each of two customers**, verified the ledger and sent two separate Telegram apologies. Other customers and canceled orders were left unchanged.

**Why this matters:** an AI working through LUCH can help investigate a real business failure, safely repair the specific records and verify that customers receive what they paid for.

### 02 · My computer had connectivity trouble. I wanted it usable again.

After complex system changes, an old network-relay profile had interrupted internet access on my Mac. I needed to understand the actual device state without losing the remaining remote connections.

**Through authorized computer and terminal access,** the recovery checked network routes, proxy settings, running services and the connection path, then established a working direct Wi-Fi route without the phone connection at the recorded checkpoint. Long-term stability remained a separate check.

**Why this matters:** rather than telling me which settings to click, connected AI could inspect the machine, take bounded recovery steps and report the observed outcome.

### 03 · A website needed a real fix, not another design suggestion.

I asked for a human-centered bilingual redesign. The work inspected the actual website and GitHub source, checked **32 routes at four screen sizes**, found a narrow-screen defect, corrected it and published the approved version.

[**See the public source commit and the real result →**](docs/REAL_WORK.md)

**Why this matters:** browser research, source changes, verification and a published artifact can be connected into one task.

[**Read all three real stories and their evidence limits →**](docs/REAL_JOBS.md)

*The prompts above describe the intent of each task; they are not presented as verbatim transcripts. The website release has public source evidence. The customer-restoration and computer-recovery logs contain private operational data and are summarized here without exposing accounts, secrets or personal files. These founder-environment cases do not establish that every new account has all routes enabled.*

## The full LUCH experience

**12 documented skills. One connected way of working.** I have organized the public capabilities by the part of your life or work they can improve, rather than by internal API names.

### Understand and navigate the web

| What I want AI to help with | What LUCH provides |
| --- | --- |
| **Explore public websites** | An isolated server browser: navigate pages, follow links, read content, enter text, click and capture screenshots in a permitted session |
| **Work in my own browser** | A separately authorized local browser or profile when an existing signed-in session is genuinely needed |
| **Manage a task's tabs** | Inspect and operate granted tabs and windows, preserving the rest of your browsing session |

[Browser, local browser and tabs →](docs/CAPABILITIES.md#browser-and-web)

### Work with my files, apps and devices

| What I want AI to help with | What LUCH provides |
| --- | --- |
| **Find and work with files** | Search, read, compare, create or edit selected files and folders, with verification and sensible backups |
| **Use a connected computer** | Where available, inspect the screen and work with native apps, windows, mouse and keyboard on the exact permitted device |
| **Inspect my servers** | Discover a selected paired server, read its status and run bounded terminal diagnostics |

[Files, computer and server →](docs/CAPABILITIES.md#files-devices-and-servers)

### Connect services and carry work across steps

| What I want AI to help with | What LUCH provides |
| --- | --- |
| **Work with a linked service** | Use a supported service API or approved browser session within my account's permissions |
| **Complete multi-step tasks** | Coordinate browser, files, server and other exposed tools; check actual outcomes rather than just reporting “done” |
| **Know what is available** | Discover the real tools, connected resources and permissions in this specific session |
| **Stay in control** | Select the target, confirm important changes, keep access limited, and diagnose connection or permission problems |

[Services, workflows, access and troubleshooting →](docs/CAPABILITIES.md#services-workflows-and-control)

A capability in a public skill is **not automatically an available tool** on every device or AI host. The full map distinguishes demonstrated actions, device-dependent routes and future features.

## What I have already used LUCH to do

I wanted to redesign the LUCH website around people rather than technical terminology. Using my authorized environment, AI read the live site and GitHub source, prepared the bilingual changes, checked **32 routes at four screen sizes**, corrected a mobile issue and published the change after my approval.

**This is a real, inspectable result**, not an imaginary product demo.

[Read my account of the work](docs/REAL_WORK.md) · [View the exact commit](https://github.com/lenar2/luch/commit/06daa8d6b89a3dfd65e74628b895879e79a0c931) · [Release checks](https://github.com/lenar2/ai-factory-evidence/issues/4009#issuecomment-6692683064)

## One LUCH, different ways to begin

| Your AI | A useful starting point | Integration |
| --- | --- | --- |
| **ChatGPT** | Research a question with source-backed comparisons | [ChatGPT candidate](https://github.com/lenar2/luch-claude-plugin/tree/main/integrations/chatgpt/) |
| **Claude** | Connect selected documents and sources into a decision brief | [Claude plugin](https://github.com/lenar2/luch-claude-plugin) |
| **Cursor** | Diagnose a code problem against a selected environment and prepare a patch | [Cursor plugin](https://github.com/lenar2/luch-cursor) |
| **Gemini CLI** | Check a paired server and turn observed output into an operational report | [Gemini extension](https://github.com/lenar2/luch-gemini) |

These are examples of how each host can use the LUCH tool set where the necessary tools and grants are exposed — not four different products.

[Choose your connection path](docs/START_HERE.md) · [Host-specific readiness](docs/RELEASE_READINESS.md)

## The direction I am building toward

**LUCH Core** is intended as a free set of tools for working with your own authorized resources, subject to sensible security and capacity limits. A separate managed-agent service for longer autonomous work is a future direction, **not a product currently being sold**.

My principle is simple: **the task belongs to the human; the tools are there to help it move.** Your permissions, your ability to inspect what happened, and your decision about consequential changes remain central.

---

[Full capabilities](docs/CAPABILITIES.md) · [Product site](https://luch.lenarsalimov.ru/en/) · [Safety](https://luch.lenarsalimov.ru/en/safety/) · [Privacy](https://luch.lenarsalimov.ru/privacy/) · [Support](https://luch.lenarsalimov.ru/support/)

<details><summary>For developers and reviewers</summary>

This repository is the public LUCH platform hub and website source. The 12 portable skills live in the separate client repositories; they are workflow descriptions, not an implicit grant of runtime tools. The hosted backend, credentials and user device permissions are not published here.

[Technical setup](https://luch.lenarsalimov.ru/docs/get-started/) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md) · [Release-readiness gates](docs/RELEASE_READINESS.md). The Apache-2.0 license applies to this repository's public files, not the hosted service or other packages.

</details>
