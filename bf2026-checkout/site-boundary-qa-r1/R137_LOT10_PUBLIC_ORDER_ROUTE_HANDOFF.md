# BF2026 LOT10 R136/R137 — native unpaid one-order creation coordinator and HTTP route

2026-11-19, existing PR #17. All changes additive. Related R135 predecessor: commit `4beb460b3df455dbe56996438097b31596baaef6`.

## New modules

- `r136-lot10-order-coordinator.cjs`: plugs existing R130 durable PostgreSQL `createSetOrderWorker` and R135 GetCourse Import transport together. Crucially, legacy R130 sets `return_payment_link=0` for every Offer: coordinator intercepts the worker's final canonical Offer and sets `return_payment_link=1` there ONLY; first call is `multiple_offers=0`, remaining 2–5 calls append with `multiple_offers=1` into SAME native deal_number. Captures final ACK within per-request `AsyncLocalStorage`, safe for simultaneous buyers; no duplicate post on uncertain write. Verifies *unpaid* native GetCourse positions/buyer/amount and native GetCourse order-scoped consent before releasing exact HTTPS payment link. No paid transaction, receipt, or grant verification demanded for **prepayment URL**. Requires owner-approved write credential and independently verified Order custom fields and callback proof, plus one unpaid QA order evidence. Network default OFF.
- `r136-lot10-order-coordinator.test.cjs`: 6/6 PASS. All native replies simulated; concurrent buyers have separate order payment links; malformed consent, mismatched totals and default-OFF deny. Tests use `createImportStep` from actual R130 whose last-step flag is **0**, thereby verifying the R136 adapter repair.
- `r137-lot10-public-router.cjs`: production-loadable HTTP module `GET /api/checkout/set/status`, `POST /api/checkout/set/plan`, `POST /api/checkout/set/start`. Uses R130 quote and native Offer IDs, strict request shape, original HTTPS origin, body limits and per-client rate limit. No hardcoded paid receipt E2E gating. Default `coordinator=null` returns unavailable (503) and `sale_ready:false`; when a REAL owner-authenticated coordinator is injected, native *unpaid* order/consent/price proof is required before a real payment URL may be returned.
- `r137-lot10-public-router.test.cjs`: 4/4 PASS on real local HTTP loopback; default HOLD status and exact five-offer quote, simulated release without paid receipt, foreign URLs/altered prices/consent denial, origin/anonymous QA guard.

## Real current blockers (NOT resolved by simulated tests)

- Live GetCourse Import write API credential **not provisioned**. Independent GetCourse connector: `credentialConfigured:false`, mutations disabled. The sole native UI writer has the GetCourse tab mutex; backend did not alter it.
- R129 order-scoped `consent_nonce`, `offer_revision_sha256` field IDs are NULL, process ID NULL, all `UNVERIFIED` in PostgreSQL. Native GetCourse readback/callback transport for these arbitrary set orders not configured. R130 PG set-order intent table 0 rows.
- Public `/api/checkout/set/start` **still HTTP503**, `GET /set/status sale_ready:false`; the public R132 JS currently incorrectly requires `native_receipt_verified` and `grants_verified` before enabling the *prepayment* button and has no buyer email/consent form. These must be changed **only** with the real GetCourse connector and buyer form, not used to claim SALE READY.

## Required deployment next

1. Native UI owner configure separate scoped GetCourse Import read/write key in server-only secret and verify two Order fields/Process ID. Do not paste keys in issue, logs, GitHub or browser assets. Obtain native **unpaid** 2-product QA order price/link and GetCourse order consent before public enable; no test card charge required.
2. Factory serving `bf2026-checkout-r2` Docker uses bind-mounted `/app`; mount the new R137 router with a real `coordinator` assembled from R130 `createSetOrderWorker`, owner-approved `r135` write transport and R129 validated callbacks. Beware R130 SQL currently forbids persistence of public link; R136's same-request capture returns no URL on ambiguous retry and requires manual reconciliation. Integrate buyer email + one-use challenge/session in on-site cart; do not take buyer email on URL.
3. Switch the R132 client set gate from *paid receipt/grants* to **authenticated native unpaid-order readiness and order-specific consent**, but never to global single-product readiness. Then verify actual GetCourse native Order amount/lines with one unpaid QA buyer; only after that release real checkout.

Current result: **11 tests PASS across R135/R136/R137**, order/link orchestration code prepared, **not** deployed as a live GetCourse seller. No provider orders, money, emails or purchases generated.
