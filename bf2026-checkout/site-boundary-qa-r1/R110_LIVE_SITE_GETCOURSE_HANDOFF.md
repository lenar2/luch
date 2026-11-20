# BF2026 R110 live site + GetCourse order acceptance (19 November 2026)

## Already delivered on customer site

The live `https://wf.tati-lar.ru/` now serves **R110**. Public HTML and JS hashes match the independent on-server R110 deployment. The site includes `assets/vf110-cart.js` and `assets/vf110-checkout-bridge.js`, whose checkout flow supports 2–5 regular cart items and the existing set selection widget; the bridge calls server `/api/checkout/quote`. Current status is `BF2026_CHECKOUT_R2`, `set_configurations_server_calculated=265`, `sales_ready=false`, `verified_sale_routes=0`. This is real public site deployment, not a PR17 change.

GET site HTML SHA256: `26b428e736bda81255670ea90aa01f7b3cc1c518d1f676ac164704b8aea66101`. Public `vf110-checkout-bridge.js` SHA256: `628d99b89fbfb88c57ba8cbc3fc28065a887837f4a15f97b33ebe6838a729c12`. Public `vf110-cart.js` SHA256: `67c042e81dac2b9d6cf30f026600f0f5402e24ab435e26962c69aa4d80e04ba1`.

Actual `POST /api/checkout/quote` for `{"kind":"set","items":["rejection_program","union"]}` returned 200, subtotal **12990 RUB**, discount 10%/**1300 RUB**, total **11690 RUB**, `availability.ready=false`. No orders or payments were created. No need to redeploy the cart / run 265 price audit again.

## Actual GetCourse provider public form GET

Public HTTPS read-only GET (verified TLS; hostname forced to already verified address only to bypass intermittent DNS failures) returned HTTP 200:

- Widget **1686745**, one HTML `<form>`, native action ID **2263283894**, two unchecked independent `formParams[offer_id][]` checkbox positions: Союз Offer **8919715** at **6000 RUB**, Исцеление отвержения Offer **8933492** at **6990 RUB**. Their raw native base total remains **12990 RUB**. Does **not** prove two native order lines; there is no observed paid or unpaid order.
- Widget **1686753**, native action ID **2263284969**, now exactly one HTML `<form>` with only audio Offer **8934925** at **3333 RUB**, explicit oferta field visible, optional marketing unchecked. The previous extra Union form has been removed; this independently confirms the separate UI worker's native edit. **Important:** separate latest #4073 comment 6996568859 reports the serialized custom oferta field still `required:false`/`settings.is_important:false`, so the negative no-consent submit is NOT proven and public sales remain HOLD.

## Sole authorized GetCourse UI worker's immediate task

1. In test Widget **1686745** only, set the existing `Создать заявку/заказ` handler to **no fixed Offer** and retain native duplicate-order prevention, as GetCourse official documentation prescribes: https://getcourse.ru/blog/275862#zapretit-sozdanie-dublej-zakazov . Save/full reopen. Don't change existing fixed widgets.
2. On the existing authorized QA test customer, create **one controlled UNPAID order** with both checkboxes selected. Read back the native order ID and **both** exact native Offer/Product/Training line items and assert no unpaid grants. This test alone may produce **12990 RUB**, so do NOT make any real payment or expose the form.
3. Configure/test an exact **1300 RUB conditional discount** applying only to the pair, not either single, using the provider promo mechanism if supported. Negative test each standalone choice remains 6990/6000; positive combined order must be **11690** and contain both positions. Discount could apply only one line by default: inspect the native order itself.
4. Only after true native provider proof, authorized paid 11690 test must verify one captured payment, two 365d AFTER_PAY grants, receipt/tax, consent and duplicate suppression. Any weakness means `sales_ready=false`. GetCourse UI is locked to the active sole worker; backend does not touch it.

## Site engineer's next step

R110 public site already has the 265 combo pricing bridge. **Do not redeploy or replace with the older R109 or independent prototype.** Keep production `checkout/start` fail-closed. When genuine signed and independently reviewed provider evidence exists, integrate the correct native buyer form URL and order/grant mapping through the server registry/capability gates. Do not invent a query parameter or give out a 12990 form link for the approved 11690 pair.

## Evidence and tests

Machine-readable `r110-site-native-evidence.json` and deterministic `r110-site-native-evidence.test.cjs`, stored in existing PR #17. Public GET + read-only quote POST only. This does not claim execution of a native GetCourse purchase.