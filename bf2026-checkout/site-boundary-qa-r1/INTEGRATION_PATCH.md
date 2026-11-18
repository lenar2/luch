# BF2026 R109 site-boundary QA patch — isolated integration handoff

## Scope
Backend-only, read-only QA patch based on PR #16. Includes live quote boundary, post-save native Widget 1686693 inspection, fresh Lot5 + Union mapping overlay, and a fail-closed two-line native order contract. No production, design, GetCourse UI or order/payment path changes.

## Branch ancestry
- PR #16 base commit: c7b3e5c860760f604a54df55a4ca157261f9d7dd
- Branch: bf2026-r109-site-boundary-qa-r1-20261119
- Integrate only into the site engineer's isolated checkout branch already containing PR #15 and PR #16.

## Minimal merge and tests
    git fetch origin bf2026-r109-site-boundary-qa-r1-20261119
    git merge --no-ff FETCH_HEAD

Then run:
    BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js \
    BF_R109_PRICING=/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json \
    node --test bf2026-checkout/site-boundary-qa-r1/site-boundary.test.cjs \
      bf2026-checkout/site-boundary-qa-r1/widget-1686693-inspection.test.cjs \
      bf2026-checkout/site-boundary-qa-r1/native-order-boundary-contract.test.cjs

Current captured suite: 10/10 PASS. Refresh public widget snapshot with node bf2026-checkout/site-boundary-qa-r1/inspect-widget-1686693.cjs.

## Current verified native mapping (QA overlay only)
- Lot5 Offer 8933492 → Product 4557988 → Training 936022301, 6990 RUB, active/all buyers, 365d after pay; #4073 comment 6988661595.
- Union Offer 8919715 → Product 4550895 → Training 933861292, 6000 RUB, active/all buyers, 365d after pay; #4073 comment 6991630755.

The adapter's two-line plan is complete with exact IDs and 365d grants. This does not prove the public form can transfer both lines.

## Fresh public form result
- Embed URL: https://study.shkola-dnv.com/pl/lite/widget/script?id=1686693 (HTTP 200).
- Iframe URL: https://study.shkola-dnv.com/pl/lite/widget/widget?id=1686693 (HTTP 200).
- Button caption Оформить заказ is persisted.
- Stable form action: POST https://study.shkola-dnv.com/pl/lite/block-public/process?id=2263265127. Actual per-visitor action adds gcSession, gcVisitor, gcVisit and gcSessionHash; values are redacted and non-reusable.
- Hidden formParams[setted_offer_id] has no value attribute; no form-position-input or other Offer selector controls. Embed query forwarding is not proof of query-to-Offer binding.
- Native handler readback still binds this widget to Lot5 Offer 8933492 only.
- Marketing consent is enabled and checked by default, while isMailingCheckboxRequired=false. UI worker should make it unchecked by default; required offer-terms consent remains separate.

## Current live R109 start result
GET /api/checkout/status before/after: sales_ready=false, verified_sale_routes=0.
POST /api/checkout/start: Lot5 → 503 GETCOURSE_OFFER_NOT_READY, no URL; Lot5 + Union → 503 GETCOURSE_OFFER_NOT_READY, no URL.
The source handler only resolves a verified native form URL and returns it; when no route exists it exits 503. It does not create an order. No form was submitted and no provider order/payment was created.

## Two-line native order contract
See native-order-boundary-contract.json and .cjs. It requires one actual paid native provider order with exactly:
- 8933492 / 4557988 / 936022301 / 6990 RUB;
- 8919715 / 4550895 / 933861292 / 6000 RUB;
- subtotal 12990, 10% discount, paid total 11690 RUB;
- both 365d after-pay grants tied to the same paid event;
- fiscal receipt/tax, required offer-terms consent, duplicate guard and native evidence references.

The validator refuses missing, synthetic, test-fixture or unattested order evidence. It contains no positive synthetic order and is not a payment certification.

## Release gates
1. UI worker supplies a native public multi-offer selection mechanism that demonstrably carries both Offer IDs into two actual provider order lines. Do not invent URL parameters or reuse the Lot5-only widget as a two-line cart.
2. UI worker provides exact public buyer URL and saved/reopened form readback. Marketing opt-in must be unchecked by default.
3. Site engineer integrates selection transfer and durable idempotency on their isolated branch.
4. Independent native paid-order/grants/receipt/consent/duplicate QA and owner release.
5. Only then consider a production registry change. Do not merge this QA branch to production or enable rollout from quote/mapping parity alone.

Post-save live start result is preserved in post-save-start-boundary-evidence.json (observed 2026-11-18T21:42:41.913Z): Lot5 and Lot5 + Union both return 503 GETCOURSE_OFFER_NOT_READY, with zero routes before/after and no order created.
