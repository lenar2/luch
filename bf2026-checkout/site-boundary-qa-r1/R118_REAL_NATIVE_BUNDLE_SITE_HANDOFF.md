# BF2026 R118 — native one-Offer/two-Products sale path: actual unpaid order + signed site bridge

## Real GetCourse evidence (not a synthetic order)

**Existing QA native Order #71994**, internal Deal **924624456**, created at GetCourse by the sole authorized UI worker on 19 Nov 2026. It consists of ONE native Offer **8935004** (`Исцеление отвержения + Союз нового времени`) for **11,690 RUB**, which internally contains BOTH existing Products **4557988** (Training **936022301**) and **4550895** (Training **933861292**), configured limited 365 days AFTER_PAY. Order status is **Новый (unpaid)**; independent GetCourse userProduct readback by the UI worker confirmed NO new access to either product while unpaid. This is ONE OFFER with TWO PRODUCTS, not TWO Offer lines.

Authoritative original UI worker reports:
- https://github.com/lenar2/ai-factory-evidence/issues/4112#issuecomment-6997884393
- https://github.com/lenar2/ai-factory-evidence/issues/4112#issuecomment-6997903834

Backend direct independent **public HTTPS GET** `https://study.shkola-dnv.com/pl/lite/widget/widget?id=1686790` returned HTTP 200, valid TLS, one native POST form/action **2263285969**, one default-selected radio Offer **8935004**, data-price **11690**, visible offer legal text, marketing not prechecked. Raw session/visitor parameters must never be committed or reused. This independent GET does **not** show internal Offer activation status or paid-grant success.

**The native QA Offer remains `Неактуален`** at last authenticated admin readback; the test widget is not a public sale route. No native customer form submission/payment was done by the backend. The order is from GetCourse admin QA flow, not proof that the public widget would create an order while inactive.

## New executable artifacts in existing PR #17

- `native-bundle-qa.cjs`: exact bundle/native form parser, HMAC-signed server-internal one-Offer/two-Product selection, no client price/Offer overrides, actual unpaid QA order contract and paid receipt/grant validation, no external grant writes, expiration.
- `native-bundle-real-order-evidence.json`: literal native QA order report with source issue refs and explicit non-attestation limitations. No buyer email or user ID.
- `native-bundle-qa.test.cjs`: 11 deterministic tests; read-only public HTML snapshot validated when present; paid fixture is **TEST_ONLY**, never provider PASS.
- `native-bundle-site-qa-http.cjs`: separate QA-only HTTP routes for `prepare`, `verify`, `preview`, `start`. The preview embeds **GetCourse's actual widget script** `https://study.shkola-dnv.com/pl/lite/widget/script?id=1686790`, not an invented API endpoint. All routes require the existing private QA authorization, and public `/api/checkout/start` is unaffected.
- `native-bundle-site-qa-http.test.cjs`: 5 actual loopback HTTP tests on an isolated copy of the CURRENT R112/R115 server, catalog, registry and QA secret, verifying no public access, 11,690 signed quote, two Products/Trainings, 503 on start, no production changes.

### Exact isolated acceptance command

```sh
cd /srv/factory-scratch/bf2026-dynamic-checkout-worker2-r1-20261119
NODE_ENV=test BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js \
BF_R109_PRICING=/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json \
node --test \
  bf2026-checkout/site-boundary-qa-r1/native-bundle-qa.test.cjs \
  bf2026-checkout/site-boundary-qa-r1/native-bundle-site-qa-http.test.cjs
```

## Existing LIVE site route already works

Existing authorized POST `/api/checkout/_qa/native-order/bundle-check` on `https://wf.tati-lar.ru` independently produced HTTP 200 with one-Offer/two-Products mechanism, Widget1686790/Offer8935004, native action2263285969, correct **11690 RUB**, Products 4557988+4550895, Trainings 936022301+933861292. It reports `QA_INACTIVE_AT_LAST_NATIVE_READBACK`, `checkout_ready=false` and no buyer checkout link. Do not overwrite the running live provider driver or upgrade script implemented by the parallel backend engineer.

## Smallest site integration

Use GetCourse's **real native buyer widget**, not the unproven two-Offer import driver: the server selects/canonically quotes exactly `set:rejection_program|union`, binds it to Offer8935004, then shows the original GetCourse Widget1686790. A customer submission from that widget (once activated and cleared) is handled natively by GetCourse, so the site MUST NOT create another order or issue grants itself.

To add this private QA page to the site engineer's isolated checkout branch (do not replace the existing provider-check driver):

```js
const {createNativeBundleQARouter}=require('./site-boundary-qa-r1/native-bundle-site-qa-http.cjs');
const qaBundle=createNativeBundleQARouter({quoteFn:compute,manifest,qaAuthorized,
 secretHex:crypto.createHmac('sha256',Buffer.from(qaSecret))
  .update('bf2026:r117:bundle:qa-hmac-v1').digest('hex')});
// Inside checkout HTTP server, before other API routing:
if(path.startsWith('/api/checkout/_qa/native-bundle/'))return qaBundle(req,res,path);
```

Private GET `.../_qa/native-bundle/preview` loads the actual GetCourse widget in a QA-only HTML page. Private POST `prepare` accepts ONLY the approved two-program set plus a stable 32-hex checkout idempotency key; `verify` checks the signed payload. `start` intentionally returns 503 `NATIVE_BUNDLE_QA_INACTIVE` until native offer active, customer flow and paid receipt/grants verified. This patch was **tested in an isolated HTTP process** but not deployed by this R118 branch; public production remains unchanged.

## Next remaining native action

The exclusive GetCourse UI engineer can activate QA Offer8935004 only after confirming the intended authorization/preview workflow, then run the existing buyer widget under controlled QA, verifying the exact native order total 11,690 before payment. The current admin-created unpaid Order71994 already proves one Offer→two Products and no early grants. A paid test must independently confirm one 11,690 captured event, receipt/tax, exactly two 365-day native grants, legally required consent, and native duplicate protection. Once verified, site engineer can register **one** approved bundle route in the existing R112/R115 registry without touching the other 264 set prices. Current 265 quote audit is not repeated.

## Truth and safety

Current status **HOLD**: inactive native bundle Offer, no paid order/receipt/grant evidence, public consent negative test not completed, no owner release. Signing a QA intent does not create a native provider order, and idempotency of the site intent does not by itself establish GetCourse's duplicate-order behavior. No live buyer charges, grants or external messages were executed by this backend task.
