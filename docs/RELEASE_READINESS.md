# LUCH — Public release readiness

**Last reviewed: 2026-11-05.** This page distinguishes source availability from a fully verified public product. **UNKNOWN ≠ PASS.**

## Product surfaces

- Global product site: https://luch.lenarsalimov.ru/ (English) and https://luch.lenarsalimov.ru/ru/ (Russian).
- Main product repository: https://github.com/lenar2/luch
- Claude adapter: https://github.com/lenar2/luch-claude-plugin
- Cursor adapter: https://github.com/lenar2/luch-cursor
- Gemini adapter: https://github.com/lenar2/luch-gemini
- ChatGPT/Codex portable candidate: https://github.com/lenar2/luch-claude-plugin/tree/main/integrations/chatgpt
- Kimi adapter: candidate, not a confirmed public catalogue listing.

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
