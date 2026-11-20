# BF2026 · provider-supported fallback / site engineer handoff (backend-only)

**Existing PR #17, no production change.** Latest native evidence #4073 comment 6994570558 / #4112 comment 6994573333: Widget 1686745 has two selectable Offers (8933492 and 8919715), but native sum is **12990 ₽** and its Create order action retains **one** Offer. It is not a valid 11690 ₽ route. Site engineer ACK in #4112 remains absent. No third PeerBus delivery.

## Supported vendor routes — ranked

1. **GetCourse one Offer with two existing Products**: officially documented (https://getcourse.ru/blog/1218294#predlozhenie-iz-neskolkih-produktov). Candidate for **one new QA-only bundled Offer**, not 265 Offers. Save one Offer priced **11690 ₽**, containing both existing Products; explicitly configure product allocated price; full-reopen/readback needed. Do not alter existing Offers or Products.
2. **GetCourse native cart**: officially documented multiple products to one order (https://getcourse.ru/blog/275826). Its ability to apply approved R109 10% plus nearest-ten rounding to exactly **11690 ₽** is **unverified**. 12990 is not acceptable.
3. **Sequential GetCourse Import Deals API**: official documentation (https://getcourse.ru/help/api) describes one Offer per request, updating **same** deal_number with `system.multiple_offers=1`, and per-line `deal_cost`. It explicitly warns import is **not for operational object management**. This is an isolated non-executable dry-run contingency only. No live API requests, credentials or payment link.

## Exact native bundle candidate for exclusive UI worker

| Existing Offer provenance | Existing Product | Training | Base | Discount | Allocation | Grant |
|---|---:|---:|---:|---:|---:|---|
| 8933492 | 4557988 | 936022301 | 6990 | 700 | **6290** | 365d AFTER_PAY |
| 8919715 | 4550895 | 933861292 | 6000 | 600 | **5400** | 365d AFTER_PAY |

Subtotal 12990, discount 1300, **one payment 11690 ₽**. The additional 1 ₽ beyond raw 10% discount is attributed to R109 rounding and assigned to the larger item. Do not leave product allocations blank. No invented bundle Offer ID: UI worker must create/reopen and report the actual native ID only with authorized exclusive GC access.

## Implemented backend boundary

- `provider-supported-fallback.cjs`: server-recomputed R109 provenance, fixed allocation and three-way vendor decision; structural native bundle validation; exact one-payment / two-grant rules; staged Import API dry-run with hold-on-timeout and no payment link.
- `fallback-site-bridge.cjs`: isolated site adapter. `quote({kind:'set',items:['rejection_program','union']})` returns 11690 with exact lines. `start(...)` returns **503** and null payment link for **all** paths until real independently signed provider evidence and owner release. No network write methods.
- `fallback-decision-evidence.json`: checked facts and explicit gate state.
- `provider-supported-fallback.test.cjs` and `fallback-site-bridge.test.cjs`: deterministic contract tests (imaginary bundled ID, TEST_ONLY order fixtures; never provider PASS).

Minimal isolated-branch usage:

```js
const {createFallbackBoundary}=require('./bf2026-checkout/site-boundary-qa-r1/fallback-site-bridge.cjs');
const f=createFallbackBoundary({adapter:trustedR109Adapter});
const input={kind:'set',items:['rejection_program','union']};
const quote=f.quote(input); // 11690, server-derived
const result=f.start(input); // 503, no checkout_url, no payment
```

## Release evidence required, NOT currently available

1. Actual native bundled Offer ID / full-reopen readback: single Offer with exactly Products 4557988 and 4550895, allocations 6290/5400, both native 365d AFTER_PAY access paths, correct VAT/receipt/offer consent.
2. Public buyer form bound to that single bundle Offer (not admin URL, not widget 1686745 two-checkbox preview).
3. Genuine unpaid GetCourse order: one bundled Offer, exactly two underlying Product purchases, 11690 due, zero grants before pay.
4. Authorized paid QA: exactly **one** 11690 captured payment, exactly two distinct native Training grants 936022301 and 933861292 each once and both bound to the same paid event/order, receipt/tax, consent and duplicate-submit negative test. **No external/manual grants.**
5. Independent authenticated/signature-attested evidence; a fake source string, screenshot label or TEST_ONLY fixture never qualifies. PR #17's existing signed two-Offer evidence verifier needs bundle-specific extension before a real release is considered.
6. Only after site-engineer ACK and independent QA can production registry/route change be discussed. Preserve approved site design.

## Import-only fallback (NOT approved checkout)

`createImportDraft(plan)` specifies first item Offer 8933492, `deal_cost=6290`, `system.multiple_offers=0`, `return_deal_number=1`, `return_payment_link=0`; second item Offer 8919715, `deal_cost=5400`, **same verified native deal number**, `system.multiple_offers=1`, `return_payment_link=0`. Both unpaid. Import API docs do NOT authorize real-time public checkout. No native sender is implemented. Timeout => UNKNOWN_NEEDS_RECONCILIATION, automatic retry prohibited. Must not create charges or grants until both lines verified.

## Reproduce

```sh
cd /srv/factory-scratch/bf2026-dynamic-checkout-worker2-r1-20261119
BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js \
BF_R109_PRICING=/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json \
node --test bf2026-checkout/site-boundary-qa-r1/provider-supported-fallback.test.cjs \
bf2026-checkout/site-boundary-qa-r1/fallback-site-bridge.test.cjs
```

These are isolated tests, not provider-native checkout certification. **Production sales_ready=false, verified_sale_routes=0; do not enable sale.**


## LIVE public fixed-widget preflight — 19.11.2026 07:55 Altai

New read-only native iframe check: `native-fixed-widget-preflight.cjs` and `native-fixed-widget-preflight.test.cjs`. Tests **6/6 PASS**; current live readback **4 of 5 fixed widgets structurally PASS**, **1 HOLD**. This does **not** establish public paid E2E or increase production sale routes.

- 1686693 → Offer 8933492, 6990: exactly one native form/Offer, explicit oferta and optional unchecked mailing; structural PASS.
- 1686738 → Offer 8919715, 6000: same, structural PASS.
- 1686740 → Offer 8934207, 7200: same, structural PASS.
- 1686741 → Offer 8934262, 6000: same, structural PASS.
- **1686753 → expected audio Offer 8934925, 3333: FAIL**. Public HTML currently contains **TWO separate native forms**: first Offer 8934925 at 3333 but **without explicit oferta**; second copied Union Offer 8919715 at 6000 with oferta. This is a real wrong-item and consent failure, not just a test fixture.

**UI worker action:** in existing Widget 1686753 remove the copied second Union native FORM (do not delete Offer 8919715), add the explicit required oferta inside the first intended audio form; keep only selected Offer 8934925 at 3333, optional unchecked marketing. Save+full reopen; rerun the exact read-only preflight. Never publish 1686753 before passing structural check and native unpaid/paid receipts/access QA. Existing products/offers must be reused.

**Site engineer action:** enforce the exact one-form/one-Offer check before adding any fixed widget to site. Example: `node bf2026-checkout/site-boundary-qa-r1/native-fixed-widget-preflight.cjs`. The machine-readable report is `native-fixed-widget-preflight-evidence.json` (observed 2026-11-19T00:55:44.941Z). The correct sale status for all these widgets is still HOLD without real payment/receipt/grant E2E.
