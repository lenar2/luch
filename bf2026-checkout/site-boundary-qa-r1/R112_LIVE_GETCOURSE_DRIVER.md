# BF2026 R112 — live GetCourse native widget connection (QA only)

Deployment completed 2026-11-19 02:23:40 UTC. This is real server-to-GetCourse HTTPS connectivity from the running checkout Docker service. It is **not** a native-order POST or payment release.

## Actual production QA API

Existing authenticated endpoint: POST `https://wf.tati-lar.ru/api/checkout/_qa/native-order/provider-check`. Body is exactly `{"kind":"set","items":["rejection_program","union"]}` with the existing server-side `x-bf2026-qa-key`. It reads native Widget 1686745 via HTTPS GET, validates host/path/TLS, its single native POST form and selected Offer IDs, strips browser session values and returns only stable metadata. It does not send buyer data, submit the form, create an order, pay or grant access.

Verified result: GetCourse HTTP200, one form, GetCourse form action ID `2263283894`, native Offers 8919715/6,000 ₽ and 8933492/6,990 ₽, actual native base **12,990 ₽**, expected site price **11,690 ₽**. Current public hidden `formParams[willCreatePaidDeal]` value is **0**. This is a real observation, not proof that the native handler cannot create an order. The required next step is a controlled unpaid QA order after correcting the pricing mechanism.

The authenticated API reports `checkout_ready:false`, `checkout_url:null`, native_order_readback_verified:false and a reason code. Anonymous requests return 404. The public `checkout/start` remains 503 with no payment URL, and `sales_ready=false`, `verified_sale_routes=0`. Public catalog/design/registry unchanged.

## Code

- `native-getcourse-widget-driver.cjs` — actual vendor widget HTTPS GET + structure/action/Offer/price check. No arbitrary URLs, no cookies, no POST, no browser session leakage.
- `native-getcourse-widget-driver.test.cjs` — six deterministic tests, including 0/1 native handler hidden-field distinction, tamper rejection and no form submission.
- `native-order-site-qa-http.cjs` — extended existing deployed private QA router with `provider-check`; no public sale path changed.
- `upgrade-r112-live-native-widget-driver.py` — atomic deploy under site-register lock, CommonJS preflight, container restart, live smoke and rollback.
- `r112-live-getcourse-driver-evidence.json` — real HTTP result and provider form status.

Focused combined native/HTTP regression **85/85 PASS** (after a transient earlier concurrent test run); no repeated 265-price audit. The upgraded live checkout service and the original private QA routes were retested.

## Real native creation path to complete

GetCourse officially supports both selected Offer checkboxes in one form with a single `Создать заявку/заказ` handler without a fixed Offer (https://getcourse.ru/blog/275862). Native Widget 1686745 has that form composition. The native price remains 12,990. GetCourse promotion docs (https://getcourse.ru/blog/276084) specifically say to disable **«Только для одной позиции в заказе»** to apply a promotion to all eligible positions; 10% alone produces 11,691, not the approved rounded 11,690. QA engineer must configure offer-specific net discount 700 for 8933492 and 600 for 8919715, or use a single priced bundle Offer 11,690 with two existing products/365d after payment (https://getcourse.ru/blog/1218294). Do not apply unscoped discounts to single-product orders.

The real supported customer checkout flow is **customer browser submits GetCourse's native form**. A server-side POST emulating its session-specific `gcSession/gcVisitor` data is not a documented supported API and has deliberately NOT been implemented. The site must only redirect/embed that native form after its 11,690 native pricing and legal fields are correct.

## Safety and next gate

No confirmed native order, payment, receipt or access grant exists from this backend job. Because the widget currently shows a different sum and its handler hidden field is 0, the current customer checkout remains blocked. GetCourse UI worker controls the separate exclusive edit tab; no parallel admin edits were attempted by backend.
