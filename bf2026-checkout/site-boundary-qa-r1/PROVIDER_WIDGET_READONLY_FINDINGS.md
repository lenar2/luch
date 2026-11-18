# BF2026 — post-save public Widget 1686693 and native multi-offer boundary

Fresh public GET observation: 2026-11-18T21:36:58.948Z (2026-11-19 04:36:58 Asia/Barnaul), after the UI worker's save/full-reopen checkpoint in #4073 comment 6991630755. No form submit, buyer data, order, payment, GetCourse UI or lock was used.

## Native facts incorporated
- Lot5: Offer 8933492 → Product 4557988 → Training 936022301; 6990 RUB; active/all buyers; 365 days after payment. Source: #4073 comment 6988661595.
- Union: Offer 8919715 → Product 4550895 → Training 933861292; 6000 RUB; active/all buyers; 365 days after payment. Source: #4073 comment 6991630755.
- Both mappings are in the isolated QA overlay only. Production registry is unchanged.

## Exact public endpoints and form boundary
- Embed script: https://study.shkola-dnv.com/pl/lite/widget/script?id=1686693 → HTTP 200, 2893 bytes.
- Public iframe: https://study.shkola-dnv.com/pl/lite/widget/widget?id=1686693 → HTTP 200, 25931 bytes.
- Stable form action: POST https://study.shkola-dnv.com/pl/lite/block-public/process?id=2263265127.
- Actual per-visitor action adds gcSession, gcVisitor, gcVisit and gcSessionHash. Their values are dynamic and redacted; they are not reusable buyer parameters.
- Form method POST; data-open-new-window=0; data-sequential-request=1.
- Embed forwards the parent query string, id=1686693, referrer, location and optional clrtQueryData. The rendered form does not map that query string to an Offer ID.
- Hidden fields: formParams[setted_offer_id] is present but has no value attribute; formParams[willCreatePaidDeal]=1; formParams[in_widget]=1.
- Buyer fields: formParams[email], formParams[full_name], formParams[phone].
- Button caption is now Оформить заказ; persisted change confirmed by public iframe.
- Zero form-position-input controls and zero other Offer selector controls.
- Native handler remains Lot5-only per UI worker readback. Empty hidden offer_id is a missing dynamic selection-transfer proof; it does not negate the separately read-back server-side Lot5 handler.
- Offer/privacy terms enabled (globalCheckboxEnabled=true, persodataConfirm=true). Marketing checkbox remains enabled and prechecked (checkboxMailingChecked=true), while isMailingCheckboxRequired=false. Keep marketing opt-in optional and unchecked by default; retain required offer-terms consent separately.

## Live R109 order-start boundary after native saves
Read-only GET /api/checkout/status and POST /api/checkout/start were used. R109 start only resolves a verified native form URL from the registry; it does not create a provider order. If no verified binding exists, it returns 503 before returning a URL.
- Status before and after: sales_ready=false, verified_sale_routes=0, WAITING_FOR_VERIFIED_OFFERS.
- Lot5 start: HTTP 503 GETCOURSE_OFFER_NOT_READY, no checkout URL.
- Lot5 + Union start: HTTP 503 GETCOURSE_OFFER_NOT_READY, no checkout URL.
- Two-item quote: subtotal 12990, 10% discount, final 11690 RUB.
- No form was submitted; no provider order, payment or buyer record was created.

## Isolated adapter result
The QA-only native mapping overlay now records both saved active Offers. Adapter planning is ready for both lines: Lot5 8933492/4557988/936022301/6990 RUB/365d after pay; Union 8919715/4550895/933861292/6000 RUB/365d after pay.
This is mapping completeness only. It does not prove the public widget transfers both selected items or that a two-line native order exists. Production remains fail-closed.

## Two-line native order contract
native-order-boundary-contract.json and native-order-boundary-contract.cjs encode the exact two real native mappings and required evidence: one paid provider order, exactly two actual provider lines, 11690 RUB, both 365-day after-pay grants on the same paid event, receipt/tax, required offer-terms consent, duplicate guard and native UI evidence references. The validator rejects missing, synthetic, fixture or unattested order data. No positive fake provider-order fixture is included.

## Next actions
1. UI worker: keep the saved Lot5-only widget as-is; provide a separate native multi-offer form/selection mechanism whose actual provider readback carries both Offer IDs and two order lines. Do not invent URL parameters. Make marketing opt-in unchecked by default while retaining required offer-terms consent.
2. UI worker: save/reopen, then provide the exact public buyer URL and read-only evidence of actual two-line selection transfer.
3. Site engineer: use the new overlay and contract on the isolated branch; keep R109 /start blocked until provider-side selection transfer, paid order/grants/receipt/consent/dedupe evidence and owner release exist.
