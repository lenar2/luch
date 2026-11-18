# LUCH Browser Extension — product direction (R9)

**Owner requirement accepted on 18 November 2026**

LUCH is not a ChatGPT/Claude clone and does not need a second AI chat. It is a powerful, consented browser-control layer for the AI the person *already uses* — whether that AI is paid or free.

## Core user journey

1. Install LUCH Browser Companion.
2. Connect LUCH to a supported, authorized AI host. The host is not necessarily ChatGPT or Claude, and its own plan may restrict external tools.
3. Explicitly share one web tab for reading; approve interaction separately.
4. Optionally enable all-open-tab metadata, then independently approve sharing its titles and sanitized URLs with the authorized AI host.
5. Optionally enable precision pointer within LUCH after Chrome grants its mandatory debugger permission at extension installation. The user sees Chrome's sensitive-access warning on install. Pointer input is limited by LUCH to the approved tab's viewport and is detached after each operation.
6. Ask the existing AI to read, search, navigate, click, enter text or operate the on-page cursor. Revoke access in LUCH.

**Do not introduce a native chat, require a personal OpenAI/Anthropic API key or bundle token billing into this primary flow.** An optional LUCH-hosted agent/API product may be designed separately later.

## Important compatibility boundary

A third-party Chrome extension alone cannot automatically turn any ChatGPT or Claude subscription (paid or free) into a tool host for LUCH. This requires a supported integration provided by the AI host (plugin, app, MCP, API/host protocol or equivalent). It must be authorized by the user. We must not present cross-host browser control as already working until its actual tool route is tested end-to-end.

On the LUCH side, a generic authorized Browser Bridge action endpoint supports 45 operation identifiers in this R9 candidate. This is **not** evidence that an unmodified ChatGPT or Claude chat has them in its tool menu.

## Browser capabilities in this candidate

- 17 read/inspection identifiers. One of them, list_open_tabs, exposes only titles and sanitized URLs; it needs an independently enabled metadata-sharing setting. It cannot read the contents of the other tabs.
- 28 interaction/navigation identifiers, including 5 optional Chrome debugger pointer operations: pointer_move, pointer_click, pointer_double_click, pointer_drag and pointer_wheel.
- Other tab-level actions remain permission-scoped and origin-bound. DOM-based simulated hover is not the same as Chrome-protocol pointer movement.
- A visible, physical desktop cursor and unrestricted OS mouse remain OUT OF SCOPE.
- Chrome's debugger permission is highly privileged and may create a conspicuous browser notice. Opt-in is intentionally separate from normal tab access. The user can switch it off.
- Some websites and protected controls may still refuse automation; neither 45 command names nor a PASS for synthetic tests proves broad real-world compatibility.

## Permission/privacy model

Required by default: activeTab, scripting, storage, alarms, localhost companion host permission.
Optional, user gesture: tabs (names and URLs of open tabs). Required at extension installation: debugger (Chrome input commands), subject to a prominent browser warning and separate in-app per-tab opt-in.
Additional sharing choice: all-tab overview to the already-authorized LUCH host.
Per-tab interaction choice: separate from reading.
Additional cursor choice: separate from interaction.
Other tab page contents: never shared without individual approval.

## Release blockers

- Validate genuine Chrome optional-permission dialogs and real Input.dispatchMouseEvent on a headed browser. Unit tests/mocks cannot replace this.
- Prove multi-tab metadata lifecycle and revoke using the exact release candidate.
- Verify account/tenant identity and full host-to-extension route; existing shadow Mac canary does not prove production ChatGPT/Claude integration.
- Independent security audit of optional debugger capability and actions with side effects.
- Opera compatibility and store review, new user onboarding and public installer.
- Do not publish 0.6.0 until these pass.

Public Chrome and Opera releases are not updated by this branch.
