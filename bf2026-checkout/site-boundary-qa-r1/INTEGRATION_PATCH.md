# BF2026 R109 native multi-offer execution patch — isolated integration handoff

## Why this patch stops short of a provider POST

Latest public evidence (#4073 comment 6993420543) shows two separate GetCourse widgets: 1686693 has one checked radio `formParams[offer_id][]=8933492` and form action ID 2263265127; 1686738 has one checked radio `formParams[offer_id][]=8919715` and form action ID 2263282483. Both are independent POST forms. `[]` in the field name does not prove a single native form can carry multiple values; observed controls are radio, one per form. There is no native multi-offer form or actual unpaid two-line order readback.

Do not concatenate the two values or submit both widgets independently and call it one order. This branch deliberately contains no GetCourse POST driver.

## Files

- `native-widget-pair-readonly-evidence.json`: sanitized public form facts; visitor session values omitted.
- `inspect-native-widget-pair.cjs`: public GET-only refresh helper.
- `native-order-execution-contract.json/.cjs`: exact signed selection, provider capability gate, unpaid native order readback contract and paid grant validator.
- `native-order-idempotency.sql`: PostgreSQL durable idempotency migration (review only; not deployed).
- `native-order-execution-contract.test.cjs`: deterministic regression tests, including proof the current capability gate fails before store/provider calls.

## Backend execution sequence after native capability is actually proven

1. Server recomputes the exact R109 quote; client prices/Offer IDs are never trusted.
2. Server seals the selection with HMAC-SHA256 and a stable 32-hex checkout idempotency key (separate from nonce).
3. Require one public native GetCourse form whose saved/reopened GET shows both exact Offer IDs and a supported multi-value selection control.
4. Require a real native unpaid order readback with exactly two lines: 8933492/4557988/936022301 at 6990 and 8919715/4550895/933861292 at 6000; subtotal 12990, final amount 11690.
5. Reserve the stable key in the PostgreSQL ledger before provider submit. Unique key + selection digest prevents duplicate checkout. Mark PROVIDER_SUBMITTING before network I/O.
6. If provider response is ambiguous, mark PROVIDER_OUTCOME_UNKNOWN and do not retry. Reconcile by independent native order lookup. If already ORDER_CREATED, replay the same provider order ID.
7. Only after confirmed payment grant Training 936022301 and 933861292 for 365 days AFTER_PAY, both bound to the same provider order and paid event. Verify receipt/tax, offer consent and duplicate-submit negative test.
8. Independent QA and owner release before any production route/registry change.

## Important distinction

The signed token is an internal authorization envelope, not a GetCourse order. The coordinator has an injected provider port but no concrete GetCourse driver. The native capability gate currently fails with `NATIVE_MULTI_OFFER_MECHANISM_UNVERIFIED`, before the idempotency store or provider is called.

The PostgreSQL adapter is source-level code with query-recorder unit tests. The migration is not deployed and no live database was connected. Do not claim durable production idempotency until the site engineer integrates and tests it against the actual DB.

## Current status / ownership

- Latest #4112 contains no site-engineer ACK; latest owner/UI handoff does not count as acceptance.
- Production readiness checked once this dispatch: sales_ready=false, provider_offer_ready=false, verified_sale_routes=0.
- Existing PR #17 only; no duplicate PR or issue comments. Integrate into the site engineer's isolated branch only after ACK. Do not overwrite their work.
- No GetCourse UI, lock, form, order, payment, email, production registry, design or deployment was touched.


## Evidence intake hardening added in Dispatch A

`native-provider-evidence.cjs` now requires a signed evidence bundle with pinned Ed25519 trust key, artifact hashes, a single native POST form/action ID, both Offer IDs simultaneously selectable in that form, and a native order readback reconciled to that action/widget. It validates exact two-line 12,990 RUB subtotal, 10%/1,300 RUB discount and 11,690 RUB amount due. Paid readback validation binds both 365-day AFTER_PAY grants to the same provider order and paid event, with receipt/tax, offer consent and duplicate guard. `assertNativeMultiOfferCapability` now fails closed unless this evidence is signed by a trusted SITE_ENGINEER_ATTESTED key.

The evidence tests use an ephemeral TEST_ONLY key and synthetic fixture artifacts solely to test the contract parser; they assert `provider_verified=false` and prove the fixture cannot reach the store/provider. Provider timeout and duplicate tests exercise the idempotency state machine with test doubles; they do not prove GetCourse accepted a real order. The exact acceptance command and evidence packaging rules are in `NATIVE_PROVIDER_EVIDENCE_ACCEPTANCE.md`.
