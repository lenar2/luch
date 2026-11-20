# BF2026 LOT10 R135 — prepayment GetCourse link connector

2026-11-19. Additive work only in existing lenar2/luch PR #17. Does not replace existing R130 order ledger, R131 idempotency or the public R132 cart bridge.

## Engineering deliverable

- `r135-set-payment-link.cjs`: uses R130's existing native Offer IDs and one `deal_number` for the GetCourse Import Deals API. Appends 2–5 offers separately (`system.multiple_offers=0,1,...,1`) and asks GetCourse for `system.return_payment_link=1` **only on the final position**. Each native line gets the exact server-discounted `deal_cost`, `deal_is_paid=0`. GetCourse official spec: https://getcourse.ru/help/api (sections Import Orders and Response JSON).
- Requires native final response `deal_id`, `deal_number`, `payment_link` on `https://study.shkola-dnv.com/...`; rejects any early, missing or foreign URL. Never retries ambiguous external writes.
- `releaseAfterNativeOrderReadback` checks only an **unpaid** native order's buyer identity, native positions, final total and separate native order-specific consent proof. **Does not require payment, receipt or actual access grant** to expose a verified pre-payment URL. Access intended 365 days after payment, not falsely claimed delivered.
- Default remote write state OFF: `allowProviderNetwork=false`, key must be supplied through server-only loader, no keys or customer identity in repo/browser.

## Tests

`node --test bf2026-checkout/site-boundary-qa-r1/r135-set-payment-link.test.cjs`

**5/5 PASS** on LUCH server: final-only return_payment_link, serial one-deal multi-offer payload, 5-line 37,820 RUB amount/365d mappings, invalid URL and wrong line/consent rejection, default-OFF credential/network, and 5 POSTs to a **local loopback HTTP test stub** (not GetCourse).

## Verified missing inputs / uncompleted steps

- GetCourse native admin UI **currently locked by sole active UI owner** (`/tmp/luch_bf2026_getcourse_tab.lock/owner.json` started 2026-11-19 10:14:55 UTC). Do not take the UI lock or alter that owner's tabs.
- `mcp__LUCH__getcourse_status`: credentialConfigured=false, mutationsEnabled=false. No owner-provisioned GetCourse Orders Import write key found in existing backend config.
- Actual PG readback of `bf2026_r129_order_fields`: BOTH `consent_nonce` and `offer_revision_sha256` remain `UNVERIFIED` with field_id NULL. `bf2026_r129_order_process`: process ID NULL/UNVERIFIED. `bf2026_r130_set_order_intents` has 0 rows.
- Public `GET /api/checkout/set/status` has `sale_ready=false`, live_provider_import_enabled=false, `checkout_url=null`; `POST /api/checkout/set/start` yields 503 `R130_GETCOURSE_ORDER_IMPORT_DISABLED`. No customer charged or GetCourse order created.
- Production/public API binding and frontend buyer email/contact/explicit consent input remain to implement; currently R130 router hardcodes 503. This R135 module alone **does not** turn on the buy button.

## Next precise actions

1. Sole authorized GC UI writer must create/provide a scoped **read/write Import API key** (server secret file only; never GitHub/chat), verify GetCourse **ORDER-level** numeric IDs for `BF2026 Consent Nonce` and `BF2026 Offer Revision SHA256` and the process/callback ID; **do not** substitute USER field 22204810. Grant an owner-approved order-process callback for native consent readback.
2. Bind R135 transport to existing R130 PG worker and deploy a validated customer start endpoint (email, order consent, one-use challenge, idempotency), with payment link stored/returned only after native **unpaid** order lines readback. GetCourse Import API is officially for imports, not high-throughput real-time transactional CRUD; check rate limits before mass public sale.
3. An owner-controlled **unpaid** 2-product GetCourse order is sufficient to validate actual creation, price, consent and a genuine payment URL. Do **not** require completion of a card payment to enable the pre-payment URL.

**Not done:** key, fields, live writer, public sale activation. Do not represent a local simulated GetCourse ACK as a live checkout.
