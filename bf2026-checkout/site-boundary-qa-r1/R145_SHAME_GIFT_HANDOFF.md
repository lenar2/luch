# BF2026 R145 — first-24h «Освобождение от стыда» gift outbox

Date: 2026-11-19. Existing PR #17 only. **Prepared but NOT activated, NOT wired, NOT deployed.**

## Owner-confirmed native gift objects

From GetCourse native UI readback recorded in ai-factory-evidence #4112 comment 7011994210:
- Private Training: `936028240` — «Исцеляющая аудиопрактика „Освобождение от стыда“».
- Product: `4559950`, mapped to Training `936028240`.
- Audio lesson placeholder: `350912495` — «Освобождение от стыда».
- No gift Offer or paid order was created. The audio itself has not been uploaded; native storage was reported at 981% and the owner must resolve capacity/upload the file.

The prior local 12/12 pure eligibility guard did not provide a durable buyer ledger or native grant worker. R145 adds that missing independent backend layer.

## Exact eligibility window

- Moscow timezone: `Europe/Moscow`.
- Start inclusive: `2026-11-20 10:00:00 +03:00` = `2026-11-20T07:00:00.000Z`.
- End exclusive: `2026-11-21 10:00:00 +03:00` = `2026-11-21T07:00:00.000Z`.
- Eligibility uses native `paid_at`, never order `created_at`, callback arrival time, or order-created status.
- Requires native `order_status=payed`, `payment_status=paid`, exact full paid amount = order total, RUB currency, exact line-total reconciliation, fresh readback, and zero refund/chargeback.
- All purchased Offer IDs must belong to the owner-attested active paid BF2026 Offer allowlist. Lead-only/removed/non-BF offers fail closed. Lot10 one-Deal multi-Offer purchases are supported only when every line is in that allowlist and all positions/total reconcile.

**The live allowlist is intentionally not hardcoded.** Existing R130 snapshots include QA-only/legacy entries and do not fully reflect the new R151/R152 catalogue; new DGS2 and «Кнопочка» Offers `8937776` and `8937784` were created later. The sole GetCourse UI owner must supply one fresh native readback of every currently active paid Offer and exclude lead-only/removed items. Until then no production activation manifest can be produced.

## What R145 adds

- `r145-shame-gift.cjs`: strict activation manifest validation; Moscow-time window; callback hint normalization; independent native paid/refund readback contract; encrypted-at-rest buyer ID; PostgreSQL transaction store; unique buyer+Training gift outbox; one callback event key; row-locked `SKIP LOCKED` worker; stable provider idempotency key; pre-grant and post-grant entitlement readbacks.
- `r145-shame-gift.sql`: additive event ledger + durable grant outbox. **Migration is not applied anywhere.**
- `r145-shame-gift.test.cjs`: 22 deterministic unit/query-contract tests using an in-memory store and synthetic provider adapter. No real GetCourse call or entitlement write.

## Safety and recovery contract

1. GetCourse Process callback uses the existing shared-secret callback convention and is treated only as a hint. `provider_signature_verified=false` remains explicit. The module never promotes callback `PAID` to payment proof.
2. A fresh internal native order readback must independently prove paid status, full amount, buyer, exact Offers, `paid_at`, no refund and provider evidence digest.
3. A database unique constraint allows one gift per GetCourse buyer + Training, even across multiple BF orders. Callback event replay with identical digest is a duplicate; changed content under the same event ID is a conflict.
4. Buyer ID is encrypted with AES-256-GCM before PostgreSQL persistence; only its SHA-256 is used for uniqueness.
5. The worker re-reads the paid order immediately before grant, reads current Training entitlement first, writes only through an injected owner-approved native provider adapter, then independently reads back the exact active Training entitlement before marking `GRANTED`.
6. If a process restarts after an ambiguous provider write and native entitlement is absent, the worker will NOT blindly repeat unless the provider's idempotency-key behavior is independently verified. It then holds for reconciliation. If provider idempotency is verified, retries reuse the same stable key.
7. A refund/chargeback before grant marks `REFUNDED_NO_GRANT` and removes the row from retry. A refund after an already verified grant becomes `REFUND_AFTER_GRANT_REVIEW`; automatic revocation is deliberately not implemented until the owner separately approves and verifies a native revoke capability.
8. The gift does not alter order pricing, create an Offer/order, send email, send marketing, or infer marketing consent.

## Activation requirements — all missing from the live integration today

The module defaults to disabled. It is not imported by production `server.js`, no route or scheduler calls it, no activation file exists, and no migration is deployed. A 0600 owner-private activation JSON must be provided only after the GetCourse UI owner and provider/site engineers have native readback evidence for:
- Owner approval and GetCourse UI owner approval.
- Exact Training/lesson privacy and Product→Training mapping.
- Explicit approval of 365-day access term (the previous owner note called this tentative).
- Complete active paid Offer allowlist with fresh native readback evidence.
- Native payment and refund readback contract.
- Native entitlement readback and supported grant-write capability.
- Provider idempotency support (or the conservative single-attempt/no-blind-retry mode).
- Evidence SHA-256 references for all the above, including the native Process/configuration.

The activation manifest schema and all required evidence keys are enforced by `validateActivation`. Missing/incorrect evidence means disabled, no DB enqueue and no provider calls.

## Handoff contracts

**GetCourse UI owner:** verify Training 936028240 / Product 4559950 / lesson 350912495; resolve storage and upload the actual audio; confirm private access and explicit 365-day term; provide fresh active paid Offer allowlist; prove native payment/refund and gift entitlement readback; explicitly approve the native grant Process/adapter and revocation policy. Do not create a public gift Offer or duplicate Training.

**Site/backend engineer:** implement an internal adapter for `readNativeOrder({provider_order_id})`, `providerAdapter.readGiftEntitlement({userId,trainingId})`, and `providerAdapter.grantGiftAccess({userId,trainingId,productId,accessDays,source,sourceOrderId,idempotencyKey})`. Adapter capabilities must be backed by native UI readback and owner approval. Then stage the migration, callback mapping, and worker; test unpaid, partial, refunded, duplicate, replay-after-restart, one-buyer, and post-grant readback cases. Do not wire a public route or scheduler before the owner-approved activation manifest exists.

## Current boundary

- R137 and Lot10 remain fail-closed.
- Native checkout buttons and site files unchanged.
- GetCourse UI and its mutex untouched by this backend task.
- No real payment, order, receipt, email, grant, or revoke performed.
- R145 test result is **22/22 PASS** on local deterministic fakes/query contract only. No live PostgreSQL integration test or native GetCourse grant PASS is claimed.
