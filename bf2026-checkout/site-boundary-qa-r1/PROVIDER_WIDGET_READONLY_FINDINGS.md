# BF2026 — current native GetCourse widget pair and multi-offer boundary

## Canonical UI readback

Source: `ai-factory-evidence#4073/comment/6993420543` (19 Nov 2026). It supersedes the earlier single-widget inspection that focused on the empty legacy `formParams[setted_offer_id]` field.

## Fresh unauthenticated public GET evidence

Both native embed scripts and iframes returned HTTP 200 in the direct read-only inspection. The sanitized machine-readable capture is `native-widget-pair-readonly-evidence.json`; no per-visitor session values are retained.

| Native widget | Offer | Product | Training | Price | Stable form action |
|---|---:|---:|---:|---:|---|
| 1686693 | 8933492 | 4557988 | 936022301 | 6,990 RUB | `POST /pl/lite/block-public/process?id=2263265127` |
| 1686738 | 8919715 | 4550895 | 933861292 | 6,000 RUB | `POST /pl/lite/block-public/process?id=2263282483` |

Each iframe has exactly one checked radio input named `formParams[offer_id][]`, with the matching Offer ID and matching `data-price-value`. Each form is POST, has `formParams[willCreatePaidDeal]=1`, `formParams[in_widget]=1`, `formParams[need_offer]=1`, and the caption `Оформить заказ`. Each action URL also has visitor-specific `gcSession`, `gcVisitor`, `gcVisit`, and `gcSessionHash` parameters. These values are dynamic and are deliberately redacted; do not copy or reuse them.

Offer/privacy acceptance remains enabled and required. Marketing opt-in is enabled but unchecked by default in both public iframes; the account-level UI readback says it is optional. No marketing message was sent.

## What this proves — and what it does not

**Proven:** two distinct public native single-offer GetCourse forms exist, each with its own widget ID, form action ID, one selected radio Offer position, and the exact native Offer mapping.

**Not proven:** one native form accepting both Offer IDs; a single GetCourse order with two order lines; an actual unpaid two-line order; payment, receipt, or two access grants. Two widgets on one landing page are still two separate HTML forms with different action IDs. Submitting them independently is not evidence of one combined order.

The form field name ends with `[]`, but that alone does not prove multi-value semantics. The observed control is `type=radio`, one per form. Do not concatenate two values, post to either action, or label the result a combined order without an actual native GetCourse order readback showing both lines.

## Backend integration contract

`native-order-execution-contract.cjs` signs the server-recomputed R109 selection using HMAC-SHA256. The signed envelope binds both exact Offer/Product/Training lines, the 11,690 RUB server quote, a 5-minute maximum expiry, a nonce, and a stable 32-hex checkout idempotency key. The key is deliberately separate from the nonce and must be reused across retries of the same logical checkout.

`native-order-idempotency.sql` and `createPostgresIdempotencyStore()` define a durable PostgreSQL reservation ledger. Unique `(scope, checkout_idempotency_key)` prevents duplicate logical checkouts; a changed selection under the same key conflicts. `PROVIDER_SUBMITTING` or `PROVIDER_OUTCOME_UNKNOWN` never auto-retry. Ambiguous outcomes require native order lookup and reconciliation. The migration is included for review only; it is NOT deployed and no production DB was connected.

The native order coordinator requires independently reviewed evidence of one public native multi-offer form and an actual unpaid two-line GetCourse order before it can call any provider driver. No GetCourse multi-offer driver exists in this branch. With current evidence the capability gate fails closed before the idempotency store or provider is called.

After confirmed payment only, the exact grant mapping is:
- Offer 8933492 → Product 4557988 → Training 936022301, 365 days, AFTER_PAY.
- Offer 8919715 → Product 4550895 → Training 933861292, 365 days, AFTER_PAY.

Both grants must reference the same native provider order and same confirmed paid event. A paid readback also needs receipt/tax, offer terms, and duplicate-submit evidence. No positive synthetic provider-order fixture is present.

## Site engineer / production status

Latest #4112 comments contain no site-engineer ACK. The newest relevant UI/owner comment is #4112 comment 6993427561; it is a UI handoff, not an engineer acceptance. Both previously allowed PeerBus deliveries remain PENDING; no third delivery was sent.

Production readiness was checked once in this dispatch: `sales_ready=false`, `provider_offer_ready=false`, `verified_sale_routes=0`, `WAITING_FOR_VERIFIED_OFFERS`. The last observed `/api/checkout/start` results remain 503 `GETCOURSE_OFFER_NOT_READY` for Lot5 and Lot5+Union. Registry SHA is unchanged.

## Safety / limits

- Public GET only; no form submission, buyer data, native order, payment, email, or marketing send.
- No GetCourse UI or mutex/lock access.
- No production route, registry, design, or deployment change.
- Signed selection is an internal authorization envelope, not a GetCourse order and not a provider API.
- PostgreSQL adapter tests use a query-recorder test double; this is not proof of a live DB migration or persistence.
- Focused deterministic suite: 23/23 PASS.
