# BF2026 R155 — Lot 12 trusted quote-only backend LIVE

**Deployment executed:** 19 November 2026, 15:41 UTC / 22:41 +07. Existing PR #17 base HEAD `379db7d7ccf070e832c76443eafc0b72b8c2516f`. This is a factual live-deployment record, not a claim of payment readiness.

## Production readback — working

- Public HTTPS `GET https://wf.tati-lar.ru/api/checkout/lot12/status` returned **200** with `catalog_choices:11`, `pricing_version:BF2026_LOT12_CUSTOM_SET_R153`, `public_release_allowed:false`, `checkout_url:null`.
- Real HTTPS POST `/api/checkout/lot12/plan`: server-recomputed verified 2/3/5/6/7-item set totals **6,000 / 16,990 / 21,570 / 36,710 / 39,150 RUB**; the final seven-set case is 71,180 BF subtotal, extra 45%, 39,150 total.
- Invalid client `total_rub` injection **422**; real HTTPS POST `/api/checkout/lot12/start` **503**, `checkout_url:null`. Legacy `/api/checkout/set/status` **200**, existing health **200**. **9/9 actual public HTTPS checks PASS; 0 failures.**
- Existing legacy health says `sales_ready:false`. No new native provider Deal, payment, email, receipt, grant or production DB migration occurred.
- Static site remains **R154 visual update with R153 set calculator**. The iframe/button was **NOT** altered. This is a live server quote endpoint, **NOT a working checkout or visible button integration**.

## Exact live files and reversible patch

Checkout container `bf2026-checkout-r2` bind-mounted read-only from `/srv/factory-scratch/bf2026-checkout-r2-20261119`.

Only two existing PR source modules were copied into `site-boundary-qa-r1/`:
- `r154-lot12-set.cjs`
- `r154-lot12-http.cjs`

In live `server.js`, added, without changing legacy handlers:
```js
const BF2026_R155_LOT12_QUOTE=require('./site-boundary-qa-r1/r154-lot12-http.cjs').createLot12Http();
```
below `BF2026_R131_SET_NATIVE_PLAN`; and within main HTTP handler before legacy set routes:
```js
if(path.startsWith('/api/checkout/lot12/'))return BF2026_R155_LOT12_QUOTE(req,res,path);
```

Stage reference: `/srv/factory-scratch/bf2026-r155-lot12-stage-20261119`; explicit CAS stage/live content equality tested before update. Live `server.js` SHA-256 **00516b205375b7988c4bba0be0048db2fbc3da8b4857af5861b42bd45e93e62d**. Exact backup: `/srv/factory-scratch/bf2026-checkout-r2-20261119/server.js.before-r155-20261119T154116Z.backup`. Exclusive lock `r155-deploy.lock` used. Container Node syntax and import checked before `docker restart -t 7 bf2026-checkout-r2`. Live server recovered, health 200.

Rollback if needed: acquire exclusive lock, copy saved `server.js.before-r155-20261119T154116Z.backup` back to live `server.js` atomically (after confirming no newer edits), restart *only* `bf2026-checkout-r2`, then check legacy HTTPS status and health. No static site or Caddyfile change was made.

## Actual provider gate, not hidden

An isolated, bounded read-only GetCourse probe against the currently provisioned server key returned:
```json
{"auth_state":"UNKNOWN","code":"R141_GETCOURSE_READONLY_FIELD_LOOKUP_UNAVAILABLE",
 "native_order_fields_readback_verified":false,"realtime_checkout_supported":false,
 "payment_link_supported":false}
```
This does **not** prove a 901 response or provider permission; it simply did not yield valid readback. LUCH Browser Companion currently returned `BROWSER_COMPANION_OFFLINE`. The earlier native QA Order #71994 (one bundle Offer 8935004) cannot prove an operational **two-to-seven multi-Offer** order for new Lot 12. No actual 7-line native Deal, its buyer/consent or trustworthy GetCourse `payment_link` has been observed. **No live customer order was attempted**, and no unsupported production writes were made. Repeating the old key/auth audit is not useful.

## What has *not* been released

- No `createLot12Coordinator` activated on live checkout; no R154 Postgres migration to production, external GetCourse import writes, payment-link transport, gift R145, callback grants or public `allowStart:true`.
- `POST /api/checkout/lot12/start` remains fail-closed 503 until real native multiple-Offer transaction, exact unpaid buyer/Deal/line totals, consent, 365-day Product→Training entitlements and genuine GetCourse payment URL are independently confirmed.
- No site CSS, typography, public checkout buttons, R153 calculator UI, GC UI forms, GetCourse orders or other worker files were edited.

## Next exact release sequence

1. GC UI owner / authorized provider operator must supply a **real, controlled QA buyer** and a one-order GetCourse 2–7 Offer capability (offers 8937776 and 8937784 included). Confirm actual unpaid Deal with exact line discounts, exact total, native legal consent, no unpaid grants, and native per-item 365d AFTER_PAY mappings. Obtain actual provider `payment_link` on trusted host and read back independently.
2. Backend adds approved real provider transport/native-readback in existing R154 coordinator and deploys isolated R154 nonce-unique ledger to approved production PostgreSQL, keeping `allowProviderWrites=false` until all preflight gates pass. Then perform one controlled end-to-end creation test, idempotent retry, unknown result hold, callback reconciliation and 365d entitlements after paid receipt; no manual payment charge without test approval.
3. **Only after** proven link/order, SITE owner bridges visible Lot 12 (underlying legacy `data-lot=10`) to `/api/checkout/lot12/{plan,start}` without changing site design, fonts, other lot buttons, or R153 static pricing. Owner authorizes final production release. Do not publish a fake `checkout_url`.

Current production is **LIVE QUOTE / PAYMENT HOLD**. This is a functional incremental deployment, not completion of sellable checkout.
