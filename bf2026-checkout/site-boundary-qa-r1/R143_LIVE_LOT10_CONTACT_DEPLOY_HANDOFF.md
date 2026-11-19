# BF2026 R143 — live Lot10 contact endpoint deployed, provider payment still unverified

Date: 2026-11-19; existing PR #17 only.

## Owner instruction
Lot10 «Собери свой сет» is OPEN FOR SALES by explicit owner decision. Do not remove the cart, replace its design, hide its card or disable other native GetCourse purchase links. This is a backend limitation report, not a decision to suspend the lot.

## Actual production delivery
- The existing R142 handler `r142-lot10-contact-gateway.cjs` was installed under `/srv/factory-scratch/bf2026-checkout-r2-20261119/site-boundary-qa-r1/`.
- Modified ONLY production checkout backend `server.js` under exclusive `flock` and SHA256 CAS (old `e83f5b5f68ef63cfe9af71776633556e9b91da740ef28c015fb3c5ad2a3e9ced`). Added constructor call for R142 with canonical `compute`, and routed `POST /api/checkout/set/contact/start` BEFORE the existing `/set/*` handler. No website HTML/CSS/JS changes and no GetCourse UI work.
- Backup: `server.js.before-r142-lot10-contact.20261119.backup`. New backend SHA256: **`b7938d627c512c21bbef658f407c1b8af45044f5e28c4da2b1ecee3d2adbf906`**.
- Restared only Docker `bf2026-checkout-r2`. Verified public HTTPS:
  * `POST /api/checkout/set/contact/start` now HTTP **503 R142_NATIVE_LOT10_BUYER_ORDER_BRIDGE_NOT_READY** (previously 404); this explicitly refuses PII before provider readiness and returns `checkout_url:null`.
  * `POST /api/checkout/set/plan` for `{kind:"set",items:["dnv","union","trainer"]}` HTTP 200, exactly **35,020 RUB**, 15% discount, existing Offer IDs `8934207`, `8919715`, `8934247`.
  * `GET /api/checkout/set/status` still `sale_ready:false`, `checkout_url:null` — honest pending provider verification.
  * `GET /api/checkout/status` still `native_direct_available_count:9`.
  * `POST /api/checkout/start` for fixed Lot5 continues HTTP200, native Widget1686693 link and 6,990 RUB intact.
- Real local HTTP stage R142 gateway 7/7 PASS; no real GetCourse order/payment created.

## R143 new backend deliverable
Added `r143-lot10-contact-coordinator.cjs` and test. This wraps existing R130 durable PostgreSQL worker and R136 final-payment coordinator with AsyncLocalStorage buyer isolation. For each separate GetCourse Import Deals step for ONE deal, adds buyer `first_name`, `last_name`, `phone`, `email` on the true native `user` payload; after R136 native unpaid-order/total/consent confirmation, an additional independent authenticated buyer-contact readback must exactly match GetCourse deal, user ID, name, email, phone and native consent. Only then sets `buyer_contact_native_verified:true`, enabling R142 to return a prepayment link. No extra import orders or price/offer mutations.

R143 tests: **6/6 PASS** on staging with simulated transport/native readbacks: 3 original Offer IDs and 35,020 total, native contact propagation, denial on wrong contact/consent, and default network disabled. These are NOT live provider tests. Module plus original R130 worker and R136 coordinator copied additively (0600) to production backend module directory, **NOT wired to live external provider or service constructor**. Real provider writes remain OFF.

## Actual blocker
Two different private 0600 credentials exist:
1. `secrets/getcourse_import.key` successfully authenticated READ-ONLY `/pl/api/account/fields`, returning 59 fields including order/deal fields 23331550 and 23331559; this does NOT prove write scope.
2. Dedicated owner-created key `private/getcourse-import.key` was independently observed with GetCourse HTTP200 `success:false` / 901 Unauthorized even though UI showed read/write permission. Do not print, copy, overwrite, switch or reissue secrets without native resolution.

There is still no independently verified GetCourse native **Process ID/order callback**, no operational write path, no single unpaid 3-position order with exact total 35,020, and no genuine provider payment_link. Official GetCourse Import Deals API explicitly says it is for importing data, not operational real-time checkout (https://getcourse.ru/help/api). Provider-supported native multi-offer form + promotional rules may be a candidate (https://getcourse.ru/blog/275862 and https://getcourse.ru/blog/276084), BUT exact R107 discount rules across selections and native consent must be verified; do not invent a coupon or misprice the customer. No new Offer(s) per combination, no 265-audit.

## Next authorized step
Sole GetCourse UI worker (using own mutex) resolve 901, independently verify a supported real-time native one-Deal 2–5 Offer order path, mandatory native consent, one approved unpaid QA buyer/order and exact payment URL, no card charge. Backend then wire real readback/transport and release `buyer_contact_bridge_ready` only on authenticated live readiness. Do not show `sale_ready:true` on mocked provider events. Preserve nine fixed native routes and existing site design.
