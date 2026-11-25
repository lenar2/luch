# LUCH Home — SO 6.2 integration architecture candidate

**STATUS: SOURCE-ONLY / NOT CONNECTED / NOT RELEASE-APPROVED.**
This document is not a model invocation, SDK integration or functioning AI chat. English remains the default; RU localization is separate.

## Human outcome before technology
A person should choose an actual task, see what access it requires, grant only the minimum permission, receive a source-backed outcome, inspect what happened and revoke the grant. A chat box, synthetic test or registration screen alone is not human value.

**Existing beta:** personal account, explicit permission for one public HTTPS homepage, actual metadata result, history, revoke and deletion. No model inference. HEA R8 lets the person select the site before registration but does not check it until authorization. Canonical broader intent: Factory issue #4104.

## Integration boundary

    Existing Home account and user-scoped session
        → TaskIntent (type, inputs, expected human outcome)
        → server-side policy/consent broker (deny by default)
        → task-scoped short-lived operation grant
        → SO 6.2 adapter (ONLY after approved integration)
        → registered read-only tool proposal
        → second policy gate (current user, exact origin, scope, TTL, revoke epoch)
        → existing LUCH Core bounded executor (no second Core)
        → real result + provenance + user-visible activity and revoke

The model's tool proposal is NOT authorization. The public Home is NOT the founder's privileged ChatGPT conversation. No owner-only LUCH admin tools, Docker sockets, private network access or cross-tenant credentials may be inherited. The adapter must not surface model/provider secrets in JS, logs or the repo. Keep existing CSRF, HTTPS/SSRF protection, rate limits, sessions and data separation.

## User-visible capability truth
1. AVAILABLE NOW: public HTTPS homepage inspection (only current real functionality).
2. REQUIRES SETUP + CONSENT: future scoped capability with a verified live runtime. Show prerequisites, exact source and scope before action.
3. NOT CONNECTED: SO 6.2 chat, private files, external apps and device actions until separately verified.
4. RUNNING: real task ID, authorized tools and cancellation/revocation state.
5. COMPLETE / PARTIAL / FAILED: distinguish actual external observation, AI interpretation, unverified advice and missing result; no fake DONE.

## Proposed bounded contracts (not yet deployed)
- TaskIntent: user principal, task type, validated inputs, desired outcome, capability request, creation time and idempotency key.
- ConsentDecision: authenticated principal, exact resource, method, scope, TTL, terms version, revocation epoch and audit reference.
- AssistantRun: user-scoped task and adapter identity, allowed capabilities, exact model version, expiry, output and source refs.
- ToolProposal: untrusted model suggestion; independently checked against the existing grant before every effect.
- EvidenceReceipt: source identity, observed response, timestamp, status, error/partial state and privacy-redacted trace.

## First useful possible SO 6.2 journey (future)
The user checks a site through today's genuine bounded HTTPS flow, sees the actual result and separately asks a connected SO 6.2 model to explain that result and suggest a next action. The AI explanation must be explicitly marked as interpretation; it cannot claim to fix the site or perform external actions it did not perform. Generic personal email/social access, financial tools, a public app marketplace and device/robotics control are not implied.

## Release gates
- Verify the real model adapter, live auth and capability discovery from an independently authenticated runtime.
- Two-user A/B negative tests for source isolation, expired scopes, revoke-during-execution, CSRF, SSRF and all existing permissions.
- One real model-backed, user-permitted task with exact source/result receipt; no mocked inference.
- Independent QA and Critic inspect and execute against exact SHA; maker tests do not authorize deployment.
- Pre-implementation Founder value baseline with frozen tasks, alternatives and measurable outcomes; observed meaningful task completion by real participants under consent, independently verified. The participant threshold must be set by independent project authority, not after the tests.
- Isolated stage, approved release admission, verified production shadow and tested rollback before go-live.

**Owners:** P029 engineering owns the service adapter and security; HEA owns task UX and value criteria; P036 supports empirical human studies; separate QA/Critic and release authority decide readiness. No production change is authorized by this document.
