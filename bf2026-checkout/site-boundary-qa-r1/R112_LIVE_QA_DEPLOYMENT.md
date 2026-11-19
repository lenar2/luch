# BF2026 R112 — private native-order QA HTTP bridge: live deployment

**Applied 19 November 2026, 02:05:29 UTC, on the already-running checkout R2 service** at `https://wf.tati-lar.ru`. This is an owner-authorized QA-only server deployment. Public cart, 12 cards, 265 backend quote combinations, catalog and registry were not changed.

Deployment script: `deploy-r112-native-qa-live.py`. It takes an exclusive advisory lock on the existing site-registration lock, copies only necessary JS modules, preserves the exact prior server.js backup, adds a private QA handler, validates syntax and full CommonJS loading inside the Docker container before restart, restarts **only** `bf2026-checkout-r2`, and rolls back/restarts automatically on an unhealthy or invalid response.

### Actual live verification

- Existing public GET `/api/checkout/status`: HTTP 200, `sales_ready=false`, `verified_sale_routes=0`.
- Public `POST /api/checkout/quote` for `{"kind":"set","items":["rejection_program","union"]}`: HTTP 200, subtotal 12,990 ₽, discount 1,300 ₽, total **11,690 ₽**.
- Private `POST /api/checkout/_qa/native-order/prepare`: HTTP 200 with the exact Offer IDs 8933492 and 8919715, signed internal order payload, stable idempotency key, no external order.
- Private `POST /api/checkout/_qa/native-order/verify`: HTTP 200, exact Offer/Product/Training and two `AFTER_PAY` 365-day grant mappings.
- Private `POST /api/checkout/_qa/native-order/start`: HTTP 503 `NATIVE_PROVIDER_CAPABILITY_HOLD` — does **not** create an order or return a payment link.
- Same private prepare endpoint **without** QA authorization: HTTP 404.
- Public `POST /api/checkout/start`: HTTP 503, approved quote 11,690 ₽, no checkout URL.

All seven live HTTP checks passed. Machine evidence: `r112-live-qa-deployment-evidence.json`. The checkout container started normally. No buyer data, native GetCourse form submission, payment, external grant, email or mailing was sent.

### Native GetCourse order method — what is truly available

GetCourse officially supports **one native form containing multiple Offer checkbox parts**, followed by one `Создать заявку/заказ` handler with no fixed Offer. Existing QA Widget **1686745** has exactly that handler arrangement as of native editor readback #4112 comment 6997504552. Its native form still totals **12,990 ₽**. A buyer who used it today would not get the approved **11,690 ₽** price. Do not link it publicly.

GetCourse also officially supports one Offer containing multiple existing Products, each with its own after-payment period (https://getcourse.ru/blog/1218294). For the present pair, the simplest native checkout if the dynamic promo is not reliable is **one new bundle Offer** priced exactly **11,690 ₽**, containing only Product 4557988→Training 936022301 and Product 4550895→Training 933861292, each 365 days after payment. The existing standalone Offers 8933492 and 8919715 remain unchanged. Native Widget 1686745 can be repointed to the newly created bundle Offer once the sole authorized GetCourse UI worker completes the first Offer readback; avoid creating another duplicate widget. The server will need to accept a native **single Offer, two Products** capability for this path (existing `provider-supported-fallback.cjs` models that), instead of pretending one native order necessarily contains two Offer lines.

Alternative promotion path: official GetCourse documentation says its promotion option `Только для одной позиции в заказе` is ON by default; to give discounts to **all** order lines, turn it OFF (https://getcourse.ru/blog/276084). Because 10% of 12,990 is 1,299, a direct 10% promotion yields 11,691, **not** the approved 11,690. A QA-only offer-specific 700 ₽ discount on Lot5 and 600 ₽ discount on Union may reconcile the exact total if the promotion can be scoped to both selected items, with single-item negative tests. This must not be enabled globally or assumed correct without native order readback.

**Important:** No production GetCourse `createNativeOrder` driver is connected. The vendor's native browser/widget form is the supported order mechanism. The server's QA API currently signs and validates the order intent, but it does not fabricate an API endpoint for creating GetCourse orders. Do not claim a paid-order PASS.

### Security and rollback

- Private QA requests require the existing server-only `x-bf2026-qa-key`; the order-signing key is domain-separated via HMAC-SHA256 from that server secret and is never written into GitHub or response text.
- The private handler returns no payment link. The public checkout route is unmodified and remains blocked.
- Original server.js backup is saved at the explicit path in machine evidence. If a later rollback is required, deploy only under `site-register.lock`, replace the current source with that backup after reconciling any newer site-engineer edits, then restart the checkout container.
- Do not blindly use the backup after unrelated site changes; it would overwrite more recent work.


## Second upgrade (live GetCourse)

See R112_LIVE_GETCOURSE_DRIVER.md. Direct private QA GET of native Widget 1686745 is active; 85/85 focused regression PASS. No actual purchase released.
