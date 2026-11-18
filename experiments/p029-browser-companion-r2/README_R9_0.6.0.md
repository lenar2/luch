# LUCH Browser Companion 0.6.0 — existing-AI browser control (draft)

Release gate: DRAFT / HOLD. No public Chrome Web Store or Opera Add-ons update.

The user brings their own AI chat. LUCH provides browser actions; it does not duplicate ChatGPT, require a personal AI API key, or bill separately for model tokens. The optional LUCH-hosted agent/API product is a future, separate initiative.

## Browser capabilities: candidate only

- 17 read operations, including list_open_tabs. All open-tab titles and sanitized URLs require the optional Chrome tabs permission and a separate user choice to share the overview with an already-authorized LUCH host.
- 28 interaction/navigation operations, including pointer_move, pointer_click, pointer_double_click, pointer_drag and pointer_wheel. Those send browser-protocol Input events in an interaction-approved tab.
- Chrome debugger permission CANNOT be declared as optional. This candidate requests it at installation, which triggers a prominent warning. LUCH requires a separate, explicit per-tab precision-pointer approval before actually using it and detaches after each action.
- Pointer coordinates apply inside the webpage viewport, not to the operating-system cursor. Sensitive controls are checked before click/drag operations, but the existing safeguards still require independent security review.
- Every webpage content action remains restricted to a specifically approved tab and origin. Changing origin or revoking access ends all per-tab permissions.

## Existing AI host compatibility

A Chrome extension cannot automatically make every paid or free ChatGPT/Claude chat gain third-party tools. Each host must support an authorized LUCH integration. The current generic Browser Bridge action endpoint maps 45 operation identifiers to consented targets, but this is not independent proof that every AI plan automatically exposes them.

The intended path:
install LUCH -> connect LUCH through a supported tool interface in the user's existing AI -> choose and approve browser access -> use the same AI chat to act in the page.
No mandatory second chat and no personal OpenAI/Anthropic API key.

## Verification and release blockers

- 25/25 Node tests PASS; 21/21 broker negative security checks PASS.
- Exact-build Chromium tests for real tab-overview prompts, debugger installation warning and native pointer clicks/drags remain outstanding.
- Opera exact-build test is outstanding.
- A public self-service Companion setup and verified all-host tenant isolation are outstanding.
- The local Mac installer is preview-only and has not been activated on the live user system.
- Required debugger permission in the main extension may weaken the installation experience. A separate precision edition is an alternative for product review.
- Do NOT publish 0.6.0 until independent security, permissions, native browser E2E and customer onboarding review.
