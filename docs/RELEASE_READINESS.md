# LUCH — Public release readiness

**Last reviewed: 2026-11-07.** This is the technical release record; the human-facing product story starts in [README](../README.md). This page distinguishes source availability from a fully verified public product. **UNKNOWN ≠ PASS.**

## Product surfaces

- Global product site: https://luch.lenarsalimov.ru/ (English) and https://luch.lenarsalimov.ru/ru/ (Russian).
- Main product repository: https://github.com/lenar2/luch
- Claude adapter: https://github.com/lenar2/luch-claude-plugin
- Cursor adapter: https://github.com/lenar2/luch-cursor
- Gemini adapter: https://github.com/lenar2/luch-gemini
- ChatGPT/Codex portable candidate: https://github.com/lenar2/luch-claude-plugin/tree/main/integrations/chatgpt
- Kimi adapter: candidate, not a confirmed public catalogue listing.

## Human-facing entry points — HEA R3

The public GitHub experience now has a different working story for each client:

- [Platform hub](../README.md) — the full LUCH value and the documented founder-environment outcome.
- [ChatGPT candidate](https://github.com/lenar2/luch-claude-plugin/tree/main/integrations/chatgpt/) — conversation to a source-backed brief.
- [Claude](https://github.com/lenar2/luch-claude-plugin) — selected project materials to a decision note.
- [Cursor](https://github.com/lenar2/luch-cursor) — code issue to a reviewable patch using the selected test environment.
- [Gemini CLI](https://github.com/lenar2/luch-gemini) — bounded terminal checks to an operational report.

These are designed workflows based on the public client skills. They are not claims that every host-specific scenario has been independently executed by a fresh customer. The exact tools exposed to a live session remain the runtime source of truth.

## Independent evidence gates

| Gate | Required evidence | Status |
| :--- | :--- | :--- |
| Public documentation and client source | Reachable page and matching source code | **PASS for public availability** |
| Denial without credentials | Unauthenticated MCP request must fail closed | **PASS for tested 401 requests** |
| Fresh user enrollment | Unprivileged new user can enable their own account | **UNKNOWN / HOLD** |
| Host-native OAuth | Real new-user consent and authenticated MCP tool discovery | **UNKNOWN / HOLD** |
| User-owned device pairing | Fresh user pairs only their own approved test device | **UNKNOWN / HOLD** |
| Read-only action | Fresh user can read an authorized synthetic file or web page | **UNKNOWN / HOLD** |
| Cross-tenant denial | Other tenant's file/device remains inaccessible | **UNKNOWN / HOLD** |
| Revocation | Revoked permission causes actual subsequent denial | **UNKNOWN / HOLD** |
| Marketplace review | Provider confirms public approval for the exact package | **UNKNOWN / provider-dependent** |

### Safe first-user acceptance test

1. Create a dedicated, non-owner test account and synthetic data.
2. Use the supported AI client to complete login and OAuth consent.
3. Check live `tools/list` to verify the exact public tool contract.
4. Pair a *reviewer-owned* disposable device, if the scenario needs one.
5. Execute a harmless read-only task; save actual result and timestamp.
6. Attempt an unauthorized path and verify denial without data disclosure.
7. Revoke the permission, try again, verify denial.
8. Collect a separate, independent review of those exact results.

Do not substitute the founder's already-connected ChatGPT plugin for this test. A private, working client proves that **one authorized account can connect**; it does not prove that arbitrary new users can self-onboard.

## Marketing policy

Allowed today:
- “Public client source available.”
- “LUCH operates for enabled accounts.”
- “Remote browser and paired device tools exist with permission limits.”
- “Early access.”

Not yet justified:
- “Anyone can install and immediately use LUCH.”
- “Verified on every AI platform.”
- “All marketplaces approved.”
- “Full iPhone control and independent multi-agent execution available.”
- “Production-ready security certified.”

## Official status

The authoritative runtime is the authenticated LUCH tool inventory and independently captured test receipts. README claims do not override runtime permissions, access policy, or a host's actual plugin availability.


## Static website publication — 2026-11-05

The bilingual static product website is published at https://luch.lenarsalimov.ru/ using the versioned R3.1 source and a route-preserving release overlay. The public release was verified by HTTP smoke tests: main EN/RU pages, connection pages, 32 HTML routes, previously active getting-started guide, download, legal/support endpoints and removal of the synthetic reviewer fixture. This is **static website availability only**. It does not change the UNKNOWN / HOLD gates above for arbitrary new-customer OAuth, pairing or end-to-end service use. For code and backup provenance see [website/DEPLOYMENT.md](../website/DEPLOYMENT.md).


## Human-experience release note — 2026-11-07

The human-first site and GitHub product README were published from [commit `06daa8d`](https://github.com/lenar2/luch/commit/06daa8d6b89a3dfd65e74628b895879e79a0c931). See [release evidence](https://github.com/lenar2/ai-factory-evidence/issues/4009#issuecomment-6692683064). The earlier “2026-11-05” passage above remains a **historical record**, not the current site release. A subsequent [author self-audit](https://github.com/lenar2/ai-factory-evidence/issues/4009#issuecomment-6705944671) marked the human journey for further design. **All new-user OAuth and pairing gates above remain UNKNOWN/HOLD.** The [real-work narrative](REAL_WORK.md) covers the founder's already-authorized environment and does not replace independent customer evidence.


## HEA R3 — GitHub experience release, 2026-11-07

The four public product repositories were updated in their default `main` branches:

- Platform: [`fe2b63c`](https://github.com/lenar2/luch/commit/fe2b63c14f1872708bd99b05088bf79d8bd01b7c)
- Claude and ChatGPT candidate: [`909b51a`](https://github.com/lenar2/luch-claude-plugin/commit/909b51a9db2a2fa4bfe15eb3ea0b8581881920cc)
- Cursor: [`c30f3a6`](https://github.com/lenar2/luch-cursor/commit/c30f3a67c1f91b7fb87725dacec43003e5dc1c10)
- Gemini CLI: [`cfb4e38`](https://github.com/lenar2/luch-gemini/commit/cfb4e38962b531b0bc8f5bd8fb23ee8ec6a9fca5)

The release includes bilingual entry pages and client-specific workflow guides. The ChatGPT package builder includes its localized README, workflow guide and SVG asset. See the [founder's release note](https://github.com/lenar2/luch/issues/3#issuecomment-6706766299) and [AI Factory evidence](https://github.com/lenar2/ai-factory-evidence/issues/4009#issuecomment-6706768041).

**Audit scope:** 22 public Markdown entry/workflow pages had no missing relative links or temporary-branch URLs; ten primary README pages had no broken heading anchors. Four integration manifests parsed as JSON and five workflow SVG sources passed structural checks. The ChatGPT ZIP was not built in this release, and rendered GitHub screenshot QA remains UNKNOWN.

**Browser demo note:** two attempts to navigate the synthetic review fixture through an isolated LUCH server-browser session returned a closed page/context error. Sessions are now released or expired and the router reports zero active/queued sessions. No successful fixture execution is claimed. This result is specific to that audit attempt; it does not establish a general browser-service outage.

The repository About descriptions are not updated in this release; the connected GitHub file/ref actions do not expose repository-settings writes. The current metadata remains visible in GitHub's About panels.
