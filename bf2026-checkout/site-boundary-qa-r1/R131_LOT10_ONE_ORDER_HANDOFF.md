# BF2026 Lot 10 R131 — reliable GetCourse dynamic one-order preparation

Date: 2026-11-19. Existing `lenar2/luch` Draft PR #17, branch `bf2026-r109-site-boundary-qa-r1-20261119`.

## Current truth

**Live GetCourse checkout is NOT connected.** The separate isolated website offers 2–5-product set choices, canonical discounted quotes, and a validated import plan using existing Offer IDs. One-GetCourse-order creation is implemented as a default-OFF adapter with a durable database ledger. No actual provider API key or independent native consent evidence has been obtained, so no provider write, actual purchase, payment URL, fiscal receipt, or access grant is claimed.

Official GetCourse API docs: https://getcourse.ru/help/api. The vendor supports `/pl/api/deals` with one Offer per request, the same `deal_number` and `system.multiple_offers=1` to add positions; `deal_cost` sets a position price. The vendor explicitly says its Import API is for data import **not real-time object control** and applies tariff limits. A real purchase flow must be verified before public release.

GetCourse may automatically email a customer upon order creation: https://getcourse.ru/blog/1217552 . Setting `return_payment_link=0` in our request does NOT prove that automatic email is disabled. Therefore tests must use an owner-controlled QA buyer.

## Code added in R131

New under `bf2026-checkout/site-boundary-qa-r1/`:

- `r131-lot10-idempotency.sql`: unique, non-recyclable consent nonce per order intent in the actual isolated PostgreSQL16 schema.
- `r131-lot10-idempotency.integration.test.cjs`: real two-connection PostgreSQL concurrency, exactly one intent for two simultaneous identical requests; conflicting body rejected; same nonce with a different idempotency key rejected.
- `r131-lot10-qa-intent-http.cjs`: authenticated GET /api/checkout/_qa/set-order/intent and POST /api/checkout/_qa/set-order/prepare; staging-only synthetic `@example.invalid` or `@example.test` buyer; canonical server-side quote, non-client amount/Offer, 64-char idempotency key header, 2048-byte JSON max. **No transport able to call GetCourse is constructed**; returns durable order plan and HOLD with no payment URL. Public POST /api/checkout/set/prepare is denied.
- `patch-r131-lot10-qa-stage.py`: one-shot patch allowed only on exact isolated server `/srv/factory-scratch/bf2026-r130-lot10-stage-20261119/server.js`, preserves existing R130 and R129 routing.
- `r131-lot10-qa-stage.integration.test.cjs`: real HTTP → PostgreSQL16 staging E2E, QA authorization, forbidden Origin, forged/uncontrolled buyer, duplicate 201/200, one-use nonce conflict 409, direct public checkout 404/503, no payment or provider API.
- `r131-lot10-live-write-gates.test.cjs`: proves future non-test Import API writes remain blocked without explicitly verified owner-controlled QA recipient and owner-approved GetCourse automatic order-notification behavior.

Updated `r130-set-order-worker.cjs`:
- Atomic `INSERT ... ON CONFLICT DO NOTHING` plus locked winner re-read, fixing the same-key first-insert race. Matching concurrent requests return the same durable preparation; changed content fails.
- Different idempotency keys cannot reuse a consent nonce, enforced by the unique DB index.
- Real Import API writer preflight now ALSO requires `owner_controlled_qa_buyer_verified` and `provider_order_notification_behavior_owner_approved`; these are **false/unavailable**, so no real orders can be written.

## Executed evidence, not provider proof

Active isolated stage site `127.0.0.1:18776` PID **3001890**, preview `127.0.0.1:18777` PID **2659603**. Production site and GetCourse UI not changed.

- **18/18 Node results PASS:** 8 unit/native safety, 1 real PostgreSQL + local HTTP simulated five-line importer, 1 real PostgreSQL concurrent idempotency, 1 real staged HTTP→PG QA prep, and 7 nested actual site HTTP→PG checks.
- **4/4 disposable Chromium UI selections PASS** on existing Lot10 visible set iframe, sizes 2/3/4/5. Correct totals **8,400 / 14,050 / 35,240 / 37,820 RUB** and existing Offer IDs. All remain HOLD and no payment redirect occurs.
- In local HTTP fixture, five Offer line submissions reused the same deal number, with `multiple_offers` 0,1,1,1,1; successful replay added zero positions, and an ambiguous response halted automated replays. This is **NOT** a real GetCourse transaction.
- Current isolated PostgreSQL post-cleanup: `bf2026_r130_set_order_intents=0`, `bf2026_r130_set_order_steps=0`, `bf2026_r127_consent_challenges=0`, `bf2026_getcourse_readback_once=0`.
- R129 GetCourse ORDER fields `BF2026 Consent Nonce` and `BF2026 Offer Revision SHA256` both have numeric `field_id=NULL`, state `UNVERIFIED`; native Process ID `NULL`.
- `GET /api/checkout/set/status` still states `live_provider_import_enabled:false`, `sale_ready:false`, and `checkout_url:null`.

## Minimal engineering integration

Keep **existing PR #17**. Fetch branch, restore these files plus updated `r130-set-order-worker.cjs`:

```bash
git fetch origin bf2026-r109-site-boundary-qa-r1-20261119
git restore --source=FETCH_HEAD -- \
  bf2026-checkout/site-boundary-qa-r1/r130-set-order-worker.cjs \
  bf2026-checkout/site-boundary-qa-r1/r131-lot10-idempotency.sql \
  bf2026-checkout/site-boundary-qa-r1/r131-lot10-idempotency.integration.test.cjs \
  bf2026-checkout/site-boundary-qa-r1/r131-lot10-qa-intent-http.cjs \
  bf2026-checkout/site-boundary-qa-r1/patch-r131-lot10-qa-stage.py \
  bf2026-checkout/site-boundary-qa-r1/r131-lot10-qa-stage.integration.test.cjs \
  bf2026-checkout/site-boundary-qa-r1/r131-lot10-live-write-gates.test.cjs
```

On a FRESH isolated Lot10 stage already containing R130 route code, apply `r131-lot10-idempotency.sql` to its staging PostgreSQL, then:

```bash
python3 bf2026-checkout/site-boundary-qa-r1/patch-r131-lot10-qa-stage.py \
  /srv/factory-scratch/bf2026-r130-lot10-stage-20261119/server.js
```

Already applied on the current isolated stage. The patch refuses duplicate and production paths.

## The exact REAL blocker

To initiate a genuine no-charge QA order, an authorized native GetCourse UI owner must establish the two Order field IDs, their actual form/process population, provider-side unchecked-consent denial and the full correct Product→Training entitlement mapping. An owner-approved write-capable Import API secret must be installed in a server-private file (never sent in chat or site JS), tariff/limit checked, and any automatic order email restricted to an owner-controlled QA buyer.

After that, run ONE intentionally authorized unpaid order with 2 native Offers, independently read back BOTH positions and exact discounted order total in GetCourse. Only then test a 5-offer QA order, eventual payment method, fiscal receipt, all required AFTER_PAY 365-day rights and public release.

**No orders, payments, receipts, entitlements, GetCourse API requests or production changes happened in R131.**

**HOLD: real GetCourse writes / live checkout / owner approval and native readbacks unavailable.**
