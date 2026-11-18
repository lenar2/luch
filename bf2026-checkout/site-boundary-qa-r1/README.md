# BF2026 live R109 to adapter boundary QA (isolated)

This branch is backend-only QA and a native boundary contract. It is not a production release.

## Exact run

    BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js \
    BF_R109_PRICING=/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json \
    node --test bf2026-checkout/site-boundary-qa-r1/site-boundary.test.cjs \
      bf2026-checkout/site-boundary-qa-r1/widget-1686693-inspection.test.cjs \
      bf2026-checkout/site-boundary-qa-r1/native-order-boundary-contract.test.cjs

Current captured suite: 10/10 PASS. The widget test is deterministic against the sanitized live GET snapshot. Refresh it with:

    node bf2026-checkout/site-boundary-qa-r1/inspect-widget-1686693.cjs

The refresh script performs public GETs only and redacts per-visitor session query values. It never submits the form.

## Fresh native mapping overlay
- Lot5 Offer 8933492 → Product 4557988 → Training 936022301, 6990 RUB, active/all buyers, 365d after pay (#4073 comment 6988661595).
- Union Offer 8919715 → Product 4550895 → Training 933861292, 6000 RUB, active/all buyers, 365d after pay (#4073 comment 6991630755).

This is an isolated QA overlay only. It does not modify the PR15 historical snapshot or production offer-registry.json. Adapter plan is complete for Lot5 + Union, but no verified multi-offer form route exists.

## Post-save public Widget 1686693
- Public embed: https://study.shkola-dnv.com/pl/lite/widget/script?id=1686693
- Public iframe: https://study.shkola-dnv.com/pl/lite/widget/widget?id=1686693
- Stable form action: POST https://study.shkola-dnv.com/pl/lite/block-public/process?id=2263265127
- Actual action adds per-visitor gcSession, gcVisitor, gcVisit and gcSessionHash; values are redacted and non-reusable.
- Button caption now reads Оформить заказ.
- Hidden formParams[setted_offer_id] remains empty; zero Offer position selectors. Embed query forwarding is not proof of query-to-Offer binding.
- Native handler readback is Lot5-only. This does not prove two-line selection transfer.
- Marketing checkbox remains checked by default and optional (required=false); required offer-terms consent is separate. UI worker should uncheck marketing opt-in by default.

## Live R109 start boundary after native saves
- Status before/after: sales_ready=false, verified_sale_routes=0.
- Lot5 start returns 503 GETCOURSE_OFFER_NOT_READY, no URL.
- Lot5 + Union start returns 503 GETCOURSE_OFFER_NOT_READY, no URL.
- Lot5 + Union quote remains subtotal 12990, 10%, final 11690 RUB.
- R109 start only resolves a verified form URL; it does not create a GetCourse order. No form/order/payment was created.

## Two-line native order contract
native-order-boundary-contract.json and .cjs contain exact native Offer/Product/Training mappings and a fail-closed validator for a future actual provider readback. A valid result must be one paid native order with exactly two actual lines, 11690 RUB paid, both 365d after-pay grants on the same paid event, receipt/tax, required offer-terms consent, duplicate guard and evidence references. Synthetic/test fixtures are explicitly rejected; no positive fake native order is included.

## Boundaries
- No GetCourse UI, lock, form submit, order or customer record is touched.
- No payment or email is attempted.
- No production registry, rollout or public site design is changed.
- ready_for_native_binding is mapping completeness only, not a checkout route or provider-order proof.
- Audio 3333 vs 3000 RUB remains unresolved and is not changed.

Post-save live start result is preserved in post-save-start-boundary-evidence.json (observed 2026-11-18T21:42:41.913Z): Lot5 and Lot5 + Union both return 503 GETCOURSE_OFFER_NOT_READY, with zero routes before/after and no order created.
