# BF2026 R109 site-boundary QA + native order execution contract (isolated)

This is an isolated backend contract/test branch, not a production release. It does not create GetCourse orders and contains no native GetCourse multi-offer driver.

## Current provider evidence

Canonical UI readback: `ai-factory-evidence#4073/comment/6993420543`.

- Widget 1686693: Offer 8933492 → Product 4557988 → Training 936022301, 6990 RUB.
- Widget 1686738: Offer 8919715 → Product 4550895 → Training 933861292, 6000 RUB.
- Each public iframe is a distinct POST form, each with one checked `formParams[offer_id][]` radio, its own stable form action ID (2263265127 vs 2263282483), and exact one-offer selection.
- Marketing consent is optional and unchecked by default; offer/privacy acceptance remains required.
- These are two single-offer forms, not one native multi-offer form. No one-form/two-line order or actual unpaid two-line order is evidenced.

See `PROVIDER_WIDGET_READONLY_FINDINGS.md` and `native-widget-pair-readonly-evidence.json`.

## Backend work in this patch

- `native-order-execution-contract.cjs`: HMAC-SHA256 signed selection envelope, R109 plan recomputation, stable checkout idempotency key, strict native multi-offer capability gate, unpaid order readback validator, and exact paid grant validation.
- `native-order-idempotency.sql`: PostgreSQL durable idempotency schema; NOT deployed.
- `createPostgresIdempotencyStore()`: transactional unique reservation, conditional transitions, replay handling, and ambiguity reconciliation. Tests use a query-recorder test double; no live DB was connected.
- The coordinator fails before touching idempotency storage/provider when no independently reviewed one-form/two-line native capability is supplied. There is no GetCourse native order driver in this branch.

## Exact signed selection

The signed selection binds R109's server-recomputed `set:rejection_program|union` plan: subtotal 12990 RUB, 10%, final 11690 RUB; Offer/Product/Training IDs and 365-day AFTER_PAY grant mappings are exact. The stable 32-hex checkout idempotency key is separate from the token nonce and remains the same across retries.

## Durable idempotency policy

- Unique `(scope, checkout_idempotency_key)`.
- Same key + same selection replays prior state/order; no second provider call.
- Same key + changed selection conflicts.
- `PROVIDER_SUBMITTING` or `PROVIDER_OUTCOME_UNKNOWN` blocks automatic retry; only independent native order lookup can reconcile.
- `ORDER_CREATED` replays the provider order ID.

## Exact focused QA run

    BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js \
    BF_R109_PRICING=/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json \
    node --test bf2026-checkout/site-boundary-qa-r1/site-boundary.test.cjs \
      bf2026-checkout/site-boundary-qa-r1/native-order-boundary-contract.test.cjs \
      bf2026-checkout/site-boundary-qa-r1/widget-1686693-inspection.test.cjs \
      bf2026-checkout/site-boundary-qa-r1/native-order-execution-contract.test.cjs

Captured deterministic suite: **43/43 PASS**. The live 265 quote test suite was not rerun. Widget tests consume the sanitized pair snapshot; `inspect-native-widget-pair.cjs` is a public-GET-only refresh utility and never submits a form.

## Current blockers

- No site-engineer ACK in #4112; the latest UI/owner handoff is not an engineer acceptance.
- No single native multi-offer public form or actual unpaid two-line order readback.
- No native provider order driver; do not infer it from `formParams[offer_id][]` array syntax or two separate widgets.
- Production remains `sales_ready=false`, `provider_offer_ready=false`, `verified_sale_routes=0`; last observed `/start` is 503 `GETCOURSE_OFFER_NOT_READY`.

## Boundaries

No GetCourse UI/lock, form submit, buyer data, order, payment, email, production registry, route, design or deployment was touched. Do not merge to production or enable sales from this contract alone.


## Native provider evidence intake (Dispatch A)

See `NATIVE_PROVIDER_EVIDENCE_ACCEPTANCE.md` for the signed evidence-bundle schema and exact acceptance command. `native-provider-evidence.cjs` verifies the Ed25519 attestation, raw artifact SHA-256, one-form/two-offer control semantics, stable form action ID, two-line order reconciliation, exact 11,690 RUB amount and paid grant mapping. TEST_ONLY fixtures are structurally validated but have `provider_verified=false` and cannot unlock the capability gate. No trusted production key or live multi-offer evidence is currently configured.
