# BF2026 R142 · Lot10 buyer-form / GetCourse one-order gateway

Date: 2026-11-19. Owner screenshot confirms three selected programs: Школа для девушек на выданье + Союз нового времени + Тренер по отношениям; 15% discount, correct server total 35,020 RUB (7,200+6,000+28,000=41,200 minus 6,180). Public checkout button displays «Оформление заказа пока недоступно». Owner has explicitly decided **Lot10 remains OPEN FOR SALES**; never state that owner authorized closing Lot10.

## Verified root cause
- Public homepage includes assets/vf141-lot10-contact.js, R141 first-party form for the dynamic set.
- The UI requires GET /api/checkout/set/status with buyer_contact_bridge_ready=true, native unpaid order ready, and valid plan.
- Public status returns sale_ready=false, public_release_allowed=false, checkout_url=null; buyer_contact_bridge_ready is absent.
- R141 form sends POST /api/checkout/set/contact/start with selection, buyer: {name,email,phone}, offer_agreement, privacy_agreement, submission_id; existing live R137 router has no such path (HTTP404). UI cannot create a buyer order.
- Existing R130 and R136 assume one GetCourse order with 2-5 existing Offer IDs, one exact total, 365d access AFTER_PAY; R136 has no full buyer name/phone forwarding.

## Two key files are NOT interchangeable
- Older server secrets/getcourse_import.key: authenticated READ-ONLY /pl/api/account/fields returned HTTP200 success=true, 59 fields, both native deal custom fields 23331550 and 23331559, form_id 701330.
- Dedicated new BF2026 private/getcourse-import.key: native GetCourse returned HTTP200 success=false / previously verified 901 on BOTH study.shkola-dnv.com and singleladiesschool.getcourse.ru. This was reconfirmed this turn read-only, no secret displayed.
- Both protected 0600. NO GetCourse writing or QA orders attempted. A successful read-only query with the DIFFERENT older key does not prove new write key works.

## Implemented in existing PR #17, backend only
- r142-lot10-contact-gateway.cjs: the exact missing POST /api/checkout/set/contact/start handler matching R141 form. Validates full buyer details and BOTH consents, exact R130 native Offer-plan/price; derives a stable idempotency key and private consent nonce from server inputs (never client-supplied prices), enforces HTTPS GetCourse payment-link host, native one-order exact-total and buyer-contact/consent readback. No secrets or buyer PII logged.
- Requires a real owner-approved R136-derived coordinator with supportsBuyerContact=true, native order-fields/consent, and durable R130 idempotency. Default coordinator=null responds HTTP503 before reading PII; has no external writer.
- r142-lot10-contact-gateway.test.cjs: 7/7 PASS (local real HTTP + synthetic coordinator). Test success is NOT a GetCourse provider QA order.
- No public deployment, no front-end redesign, no GetCourse UI/mutex mutation, no orders, payments, receipts, access grants.

## Exact remaining tasks
1. Resolve dedicated GetCourse API key 901 in real authenticated account, confirm real write permission and permitted operational order creation (GetCourse Import Deals documentation explicitly disclaims realtime CRUD).
2. Native UI owner confirms true Process callback ID, order-level fields and legal consent, one unpaid QA order with all exact Offer lines and real provider payment_link.
3. Extend R136 worker to carry buyer first_name/last_name/phone from R141 first-party form to actual native User on first order write, while preserving R130 PostgreSQL idempotency and no auto-retry on unknown results.
4. Under safe deploy mutex and CAS, wire R142 into server.js, set status buyer_contact_bridge_ready=true ONLY when real provider readiness passes, and keep all native fixed CTAs/site design untouched. Do not conflate Lot10 multi-offer with fixed two-product bundle.
5. Owner may approve sales, but functional payment cannot be claimed until real provider URL and verified unpaid native order exist. No paid QA charge required merely to release a real prepayment URL.

Commercial Lot10 OPEN; technical live checkout NOT YET WORKING. Do not hide Lot10 product, fake provider URLs, create fictitious order or charge customers.
