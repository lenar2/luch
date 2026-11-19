# BF2026 Lot 10 · GetCourse multi-offer single-order integration — 2026-11-19

Existing `lenar2/luch` PR **#17**, branch `bf2026-r109-site-boundary-qa-r1-20261119`. Separate Lot10-only backend work; no new PR and **no GetCourse UI**, no production writes, no payment, no live order, no mailing. This work deliberately coexists with the separate R130 signed-manifest worker: the stage patch has a distinct name, root and port.

## Official provider method — important limitation

Official GetCourse documentation: https://getcourse.ru/help/api, section **Импорт заказов**.

GetCourse documents `POST https://{account_name}.getcourse.ru/pl/api/deals` with `action=add` and `params=base64(JSON)`. To create one order with several Offer positions, send **one Offer per API request**, retaining the **same `deal_number`**, with `system.multiple_offers=0` for the first and `=1` for the following. The same API supports `deal.offer_id`, `deal.deal_cost` (overrides the line price), `deal.addfields` (additional ORDER fields), and `system.return_payment_link`.

**Limitations not to conceal:** GetCourse explicitly calls this an **Import API for data import**, not a real-time checkout API. Import creation is subject to account plan/limits, and no authenticated real Import test has occurred. A read-only Export API key from prior R123 cannot write orders. Until native account authorization and operational suitability are verified, this is a **staging-ready adapter**, not a public sales-ready checkout.

## New committed code in existing PR #17

All paths are under `bf2026-checkout/site-boundary-qa-r1/`:

- `r130-set-lines.cjs`: one-order plan built from the **existing R107 authoritative server quote**. Supports any valid 2–5 products, 10%/15%/25%/35% discount, rounding once to nearest 10 RUB. Distributes the final price exactly across existing GetCourse Offer lines using deterministic integer largest-remainder allocation. Rejects invalid/duplicate items, third standalone audio, conflicting audio+program, and invalid Source tariff. Includes exact Product→Training expected entitlements.
- `r130-getcourse-import.cjs`: strictly follows the official one-Offer-per-request `add` and `multiple_offers` contract. Uses **one** server-generated unique numeric `deal_number` for all lines. Sends `deal_status:"new"`, `deal_is_paid:0`, `quantity:1`, per-line `deal_cost`, and two order-specific fields `BF2026 Consent Nonce` / `BF2026 Offer Revision SHA256`. **`return_payment_link:0` at every step.** No client-controlled amount/Offer, no auto-paid flags. Strictly verifies real response schema, deal number and ID; missing/malformed response becomes UNKNOWN/HOLD.
- `r130-set-orders.sql`: staging PostgreSQL16 tables `bf2026_r130_set_order_intents` and `bf2026_r130_set_order_steps`. One immutable idempotency key / quote digest / buyer hash / single GetCourse order number; distinct step states; no persisted payment URL; DB constraints make `public_release_allowed`, payment, receipt and grants flags **permanently false** in this ledger.
- `r130-set-order-worker.cjs`: durable sequential writer with PostgreSQL advisory lock and committed `SEND_UNCERTAIN` **before** each import request. After a confirmed ACK, advances exactly one step. Identical replay returns cached state without re-sending; changed idempotency body is rejected; failure/timeout freezes to `PROVIDER_UNKNOWN_MANUAL_RECONCILIATION` and **never auto-retries** an uncertain external write. Import ACKs alone yield `ALL_IMPORT_ACKED_HOLD_NATIVE_READBACK`, not a payment URL.
- `r130-native-order-readback.cjs`: independent fail-closed verification contract for exact GetCourse native `deal_id`, `deal_number`, buyer, all Offer positions, each discounted RUB amount and total, actual paid fiscal receipt and **all native product/training access grants** (365 days after payment). Source II retains both Training IDs, Trainer retains the full Training ID. Missing/mismatching evidence produces HOLD; even fully matching synthetic fixture evidence never releases public checkout without owner approval.
- `r130-write-provider-config.cjs` + `r130-lot10.env.example`: private owner-approved **write** credential, deliberately separate from R123 read-only Export credential. The transport is **network-disabled by default even if a key were supplied**; no key has been created/read/stored.
- `r130-set-http.cjs`: existing-site read-only, same-origin routes `GET /api/checkout/set/status`, `POST /api/checkout/set/plan` plus private QA equivalents. Input allows only canonical selection keys, never caller price/Offer/consent claims. Returns existing native Offer IDs, each precise discount amount, expected Product→Training grants, one-order plan and **`checkout_url:null` / HOLD**. No public write endpoint is activated.
- `patch-r130-lot10-stage.py`: one-shot route patch for exact separate isolated `/srv/factory-scratch/bf2026-r130-lot10-stage-20261119/server.js`; preserves concurrently deployed R130 versioned-manifest routes in the source staging server. No production/shared stage source rewrite.
- `r130-lot10-preview.js`, `patch-r130-lot10-preview.py`, `r130-lot10-preview-server.cjs`: existing visible Lot10 2–5 product iframe on a separate isolated copy of the R128 storefront. The “Собрать свой сет” button asks the real staging server to recompute a one-order plan; shows the actual server total but **does not create a GetCourse order or open payment**.
- Tests: `r130-set-lines.test.cjs`, `r130-native-order-readback.test.cjs`, `r130-set-order-worker.integration.test.cjs`, `r130-lot10-stage.integration.test.cjs`, `r130-lot10-browser.e2e.cjs`.

## Canonical native Offer → access mapping, no 265 Offers

Source of confirmed IDs: prior #4112 GetCourse UI readbacks. Every selected position below uses **one existing Offer**; the buyer's custom selection uses only 2–5 of them.

| Set choice | Offer ID | Baseline RUB | Native Product → Training |
|---|---:|---:|---|
| Аудио: рана отвержения | 8934973 | 3,333 | 4555636 → 936016494 |
| Аудио: обесценивание | 8934925 | 3,333 | 4555642 → 936016504 |
| Аудио: страх быть собой | 8934974 | 3,333 | 4557112 → 936016509 |
| Аудио: вина | 8934979 | 3,333 | 4557582 → 936016513 |
| **Исцеление отвержения** | 8933492 | 6,990 | 4557988 → 936022301 |
| ДНВ | 8934207 | 7,200 | 4550894 → 583995140 |
| Союз | 8919715 | 6,000 | 4550895 → 933861292 |
| Тренер по отношениям **FULL incl. promotion** | 8934247 | 28,000 | 4550897 → **935051957**, not 935051848 |
| Источник I | 8934262 | 6,000 | 4550889 → 934905122 |
| Источник I+II | 8934987 | 10,000 | 4550889 → 934905122 **and** 4550891 → 934905123 |

The existing R107 calculator also enforces no standalone audio together with the inclusive rejection program, no more than two individual audios, 2–5 distinct products, and an explicit Source I / I+II choice.

## Actually executed E2E and preserved state

Dedicated localhost stage server: **127.0.0.1:18776, PID 2519772**. Actual isolated storefront copy: **127.0.0.1:18777, PID 2659603**. The original shared R129/R130 stage, public site, GetCourse UI tabs/mutex and production remain untouched.

- **7/7 Node unit tests PASS** (price allocation, official API request shape, unpaid order, Source II two rights, Trainer full right, missing proof).
- **1/1 real PostgreSQL16 + local HTTP Import response test PASS**. Five synthetic provider line writes use one identical deal number and `multiple_offers` sequence **0,1,1,1,1**; exact discounted total **37,820 ₽**. Replaying after successful acknowledgment sends **zero** extra writes. A provider failure on step two freezes to UNKNOWN with **zero** automatic retries. This is a local HTTP fixture, not a GetCourse order.
- **7/7 actual site staging HTTP + PostgreSQL tests PASS**, including direct forged price/Offer/checkbox and wrong Origin denial. PostgreSQL remains with **0 actual set intents, 0 steps** after tests.
- **Real disposable Chromium iframe E2E PASS**, four complete selections through visible UI controls → existing Lot10 quote → R130 staging HTTP. Results:
  - 2 products: **8,400 ₽**, existing Offers 8934973 + 8919715
  - 3 products: **14,050 ₽**, Offers 8934973 + 8934207 + 8919715
  - 4 products: **35,240 ₽**, Offers 8933492 + 8919715 + 8934247 + 8934262
  - 5 products: **37,820 ₽**, Offers 8933492 + 8934207 + 8919715 + 8934247 + 8934987
- Browser refused a forged Offer/price/consent assertion (HTTP422), blocked external requests and recorded **0 GetCourse provider calls, 0 orders, 0 payments, 0 payment redirects**.
- Post-test real PostgreSQL: `bf2026_r130_set_order_intents=0`, `bf2026_r130_set_order_steps=0`, `bf2026_r127_consent_challenges=0`, `bf2026_getcourse_readback_once=0`, GetCourse Export budget 0 with outstanding NULL.
- Public website original R109 HTML SHA256 remained **89ca216804b3073092906c73b1362c1d07f54351295d7c0a1a4d3f65ee26e5a3**. The separate Lot10 preview iframe SHA256 is **0b501703f8fe5a2fc38151542800b6447cd888c23ade345bc4578665fae5b43f**.

## Exact site engineer apply contract

Keep all work in the **existing PR #17**. Copy only the above `r130-set-*`, `r130-getcourse-import.cjs`, `r130-native-order-readback.cjs`, `r130-write-provider-config.cjs`, `r130-lot10-*` files. Do **NOT** overwrite the separate signed-manifest worker's `patch-r130-stage.py` or touch GetCourse UI.

Existing stage server requires prior R123/R124/R127/R128/R129 infrastructure. For an isolated copy named `/srv/factory-scratch/bf2026-r130-lot10-stage-20261119`, apply:

    python3 bf2026-checkout/site-boundary-qa-r1/patch-r130-lot10-stage.py \
      /srv/factory-scratch/bf2026-r130-lot10-stage-20261119/server.js

For the separate R128 storefront copy, place `r130-lot10-preview.js` in the script root and apply:

    python3 bf2026-checkout/site-boundary-qa-r1/patch-r130-lot10-preview.py \
      /srv/factory-scratch/bf2026-r130-lot10-frontend-20261119/www/assets/lot10-set/index.html

The functions are one-shot and refuse duplicate/non-isolated paths. The output contains **no write credentials**, and no GetCourse payment link. The Import API code is an adapter and step-ledger, **not an enabled checkout route**.

## Actual missing live prerequisites (do not fabricate)

1. Owner-approved GetCourse **read/write** API key, in a server-only 0600 file; the old R123 read-only key cannot create orders. No such key exists in this stage. Paid GetCourse account must support Import API and sufficient quotas; official docs warn Import API is not intended for real-time control.
2. Native Order-level IDs for `BF2026 Consent Nonce` and `BF2026 Offer Revision SHA256` remain **NULL/UNVERIFIED** from R129; no native process/readback has confirmed values. This is not the user field 22204810.
3. Real GetCourse **provider-side unchecked-offer-consent rejection** and a confirmed, order-specific accepted agreement must precede an actual order. An unchecked/forged client checkbox is NOT consent proof.
4. The existing 10 Offer IDs and Product→Training mapping are known, but native **multi-line imported order**, exact provider-discounted price, payment-link safety, fiscal receipt and actual paid access grants for every selected product (including FULL Trainer / dual Source II) have **never** been verified from GetCourse.
5. Owner-controlled activation, limited staging with a no-charge authorized buyer, live payment/receipt/grants QA and rollout approval must happen **before** public activation. If Import API proves unsuitable for real-time checkout, use GetCourse's documented native multi-Offer cart/form as the alternative, with a separately proven native tier-discount contract; do not create 265 separate Offers.

**Release status: HOLD.** Checkout URL, payment/receipt/access proof and production writes remain absent by design. Dynamic one-order planning code and staging/browser tests are complete, but **live GetCourse checkout is not yet connected**.
