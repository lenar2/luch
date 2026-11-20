# BF2026 R112 — trusted native order integration for Lot5 + Союз

## Scope and truth

This is an isolated integration component added to existing Draft PR #17. It is intended for the existing R112 site checkout service; it is NOT deployed and does not change the public site, catalog, registry, UI or design.

Current target quote is server-authoritative:

- Selection: set:rejection_program|union.
- Existing native Offer/Product/Training lines:
  - Lot5 «Исцеление отвержения»: Offer 8933492, Product 4557988, Training 936022301, 6,990 ₽.
  - «Союз нового времени»: Offer 8919715, Product 4550895, Training 933861292, 6,000 ₽.
- R109 server quote: subtotal 12,990 ₽, 10% discount 1,300 ₽, amount due **11,690 ₽**.
- Internal reconciliation allocation only: 700 ₽ discount to Lot5 (6,290 ₽ net), 600 ₽ to Союз (5,400 ₽ net). The provider request remains an **order-level conditional 10% discount**; do not send these allocations as provider line prices unless GetCourse's actual verified mechanism explicitly requires and supports that.
- Both native grants are AFTER_PAY, 365 days, triggered by the same confirmed provider paid event. No external grant writes.

Latest site state in #4112: R112 site prep and 265 server-calculated combinations exist; public set checkout remains HOLD / verified_sale_routes=0. The public test widget with two Offer checkboxes still does not prove a native 11,690 ₽ two-line order. This code intentionally cannot promote that form to a provider capability by itself.

## New files

- native-order-site-integration.cjs — server-only R109 recomputation, exact two-line payload, HMAC envelope, separate Ed25519 independent-review gate, provider-driver boundary, native unpaid/paid readback, and Postgres store adapter.
- native-order-site-integration.test.cjs — deterministic tests for exact payload, HMAC/tamper/expiry, independent reviewer signature, no-capability HOLD, Postgres idempotency and paid-event dedupe.
- native-order-site-integration.sql — additive migration for payload hash binding and unique paid-event evidence. **Not deployed.**

## Site engineer wiring (isolated R112 branch only)

Create the integration once at server startup; never construct trust stores from request JSON.

    const {
      createNativeOrderPostgresStore,
      createNativeOrderSiteIntegration
    } = require('./site-boundary-qa-r1/native-order-site-integration.cjs');

    const nativeOrderStore = createNativeOrderPostgresStore(pgPool);
    const nativeLot5Union = createNativeOrderSiteIntegration({
      adapter: trustedR109Adapter,                 // server-side compute + verified mapping
      secret: process.env.BF2026_ORDER_HMAC_KEY,  // Buffer >= 32 bytes, server secret
      store: nativeOrderStore,
      provider: getcourseNativeDriver,             // MUST be real, independently tested; currently absent
      capabilityConfig: {
        evidenceBundle: nativeCapabilityBundle,   // pinned, signed live native evidence
        evidenceArtifacts: nativeCapabilityArtifacts,
        providerKeys: SITE_ENGINEER_PINNED_KEYS,   // server config only
        independentReview: nativeIndependentReview,
        reviewerKeys: INDEPENDENT_QA_PINNED_KEYS  // separate server config only
      }
    });

### Prepare endpoint

For the exact set only, accept selection keys and a stable 32-hex idempotency key. Do not accept totals, discount, Offer IDs, Product IDs, Training IDs, grants or promo codes from the client.

    const { checkout_idempotency_key, ...selection } = await collect(req);
    const prepared = nativeLot5Union.prepare(selection, {
      checkoutIdempotencyKey: checkout_idempotency_key
    });
    return reply(res, 200, {
      ok: true,
      signed_order_payload: prepared.signed_order_payload,
      idempotency_key: prepared.checkout_idempotency_key,
      quote: prepared.quote,
      provider_order_status: 'NOT_CREATED'
    });

The browser must reuse the same idempotency key for retries of the same logical cart. The signed payload is an internal server-to-provider token with a maximum five-minute lifetime; do not put it in analytics, URLs, or public logs.

### Start / provider driver

The start endpoint passes only the signed token to nativeLot5Union.start({signedOrderPayload}). The integration returns NATIVE_PROVIDER_CAPABILITY_HOLD until the server has both:

1. a real GetCourse-signed native form + unpaid 11,690 ₽ two-line order evidence bundle, and
2. a separately pinned Ed25519 independent QA review, bound to that exact bundle, widget/action/order ID and including successful legal-consent and duplicate-negative tests.

Only then can a real getcourseNativeDriver.createNativeOrder({orderPayload, capability, idempotency_key}) be invoked. No GetCourse direct API is assumed or implemented here. The driver must use the exact provider-supported native mechanism proved by the evidence; do not synthesize a POST endpoint, concatenate values from separate widgets, or submit two separate offers and call them one order.

After the driver call, the module requires a new signed native order readback with exactly two lines and the exact 11,690 ₽ amount due. Any timeout, malformed response, wrong amount or uncertain outcome transitions the durable key to PROVIDER_OUTCOME_UNKNOWN; never retry blindly. Reconcile through a fresh provider order-detail readback first.

The integration deliberately returns no customer payment URL. It is an unpaid-order creation/reconciliation boundary, not a public sale release.

### Paid readback and grants

After an independently attested native PAID order readback, call nativeLot5Union.verifyPaid(...) with the signed evidence bundle and its artifacts. The module verifies:

- same provider order ID; exactly two correct Offer/Product/Training lines;
- 12,990 ₽ subtotal, 1,300 ₽ discount, 11,690 ₽ captured;
- exactly two 365-day AFTER_PAY grants, same order ID and same paid-event ID;
- fiscal receipt/tax readback, accepted offer terms and duplicate negative test;
- separate independent reviewer signature.

It records a unique (provider_order_id, paid_event_id) in Postgres and returns grant_writes: 0. GetCourse remains the grant authority; this module does not issue or duplicate access grants.

## Migration and acceptance

Apply native-order-site-integration.sql only to an isolated R112 database after site-owner approval. It is additive; it is NOT deployed to production.

Run:

    cd /srv/factory-scratch/bf2026-dynamic-checkout-worker2-r1-20261119
    NODE_ENV=test \
    BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js \
    BF_R109_PRICING=/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json \
    node --test \
      bf2026-checkout/site-boundary-qa-r1/native-order-site-integration.test.cjs \
      bf2026-checkout/site-boundary-qa-r1/native-order-execution-contract.test.cjs \
      bf2026-checkout/site-boundary-qa-r1/native-provider-evidence.contract.test.cjs

## QA evidence

The focused existing native-order/site-boundary regression suite passed **73/73** tests. The exhaustive 265-vector audit was not rerun. Machine-readable run record: native-order-site-integration-evidence.json. Test fixtures validate code paths only and do not represent a GetCourse order.

## Explicit blockers / no false PASS

- Current public form/widget readbacks are not an attested proof of a single 11,690 ₽ native two-line order.
- No production GetCourse native multi-offer driver is available in this PR.
- No production provider/reviewer trust keys are configured in this branch.
- No Postgres migration has been applied; the included fake-pool tests verify SQL state-machine behavior only.
- No real native order, payment, receipt, grant, consent-negative test, mailing or production write was performed.
- Keep sales_ready=false, verified_sale_routes=0, and the public checkout/start route fail-closed until real provider evidence, paid/receipt/access QA and owner release exist.
