# BF2026 BACKEND R124 · Existing PR #17 · 19.11.2026, 12:34+07 continuation

Scope: CONNECTED existing R123 native-widget adapter into real isolated **site server routes**, without new PR, production change, GetCourse UI, order, payment, fiscal receipt, Training grant, mailing or 265-case audit.

## Real changes, not mock deployment

Existing source: \`/srv/factory-scratch/bf2026-r118-relay-stage-20261119/server.js\`, backed up as \`server.js.before-r124-single.backup\`. Patched **only this stage file** using \`patch-r124-stage-single.py\`.

New files in the same PR branch:
- \`r124-stage-training-overlay.cjs\` — copy-on-read stage-only completion of six verified Training IDs, strict Offer/Widget/Product/title/rollout preconditions, zero source-file mutations.
- \`r124-single-form-stage-gate.cjs\` — actual site HTTP gate, using its real \`compute\`, \`checkoutKey\`, R123 \`examineSingle\`, and actual PostgreSQL pool. Stage-only, QA-authenticated. Rejects caller-supplied price, Offer, paid/receipt/grant flag, invalid quote, wrong product/training, unchecked oferta, prechecked marketing, wrong consent field, missing idempotency key, and wrong Origin.
- \`r124-single-intents.sql\` — additive, durable and constrained \`bf2026_single_checkout_qa_intents\` table in actual PostgreSQL16 staging \`bfstage\`.
- \`patch-r124-stage-single.py\` — exact-match, fail-closed patch of the site's **existing** \`GET /api/checkout/form\`, \`POST /api/checkout/start\`, plus private QA router.
- \`r124-single-stage.integration.test.cjs\` — calls the **actual isolated site server** over TCP, not an ephemeral imitation; writes only disposable non-payable staging QA intents; checks real PostgreSQL rows and cleans them.
- \`r124-stage-training-overlay.test.cjs\` — verifies all six copy-only IDs and tamper/cross-offer/global-release failures.

## Actual HTTP route mount and status

Final site staging server: loopback-only \`127.0.0.1:18770\`, PID \`1280818\`; startup says \`live_orders_enabled=false\`. Previous isolated processes, production Docker, and sole GetCourse UI engineer remained untouched.

The patched actual site checkout routes are:
- \`GET /api/checkout/form?route=single:rejection\` etc: **404**, no customer-facing checkout link.
- \`POST /api/checkout/start\` with a valid existing individual lot: **503 GETCOURSE_OFFER_NOT_READY**, no \`checkout_url\`.
- \`GET /api/checkout/_qa/single-form/status\`: existing QA auth required; **200**, 10 forms, full stage mapping, PostgreSQL ready, \`public_release_allowed=false\`; anonymous **404**.
- \`GET /api/checkout/_qa/single-form/inspect?route=single:source:2\` (and other exact existing keys): returns fixed Offer/Widget/price/Training mapping and legal/receipt/entitlement HOLD, never a purchase URL.
- \`POST /api/checkout/_qa/single-form/prepare\` requires existing QA key, \`X-BF2026-Idempotency-Key\` of exactly 32–64 lowercase hex, \`application/json\`, exact body:
\`\`\`json
{
  "selection": {"kind":"single","lot":1},
  "consent": {
    "oferta_custom_field_id":22204810,
    "oferta_checkbox_checked":true,
    "marketing_checkbox_checked":false
  }
}
\`\`\`
  Native Source variants use \`{"kind":"single","lot":9,"variant":"1"}\` or \`"2"\`. Return **202 HOLD** with sanitized immutable quote, never payment/receipt/grant evidence; exact replay returns \`duplicate:true\`, changed intent with same key returns **409**. Checked consent is only client-supplied *input*, NOT GetCourse-side negative-submit validation or legal proof. Zoom three sessions have **no Training**, booking remains pending.

There is no live API key configured; no native readback, real charge, receipt, grant, customer/order PII or checkout redirect claimed.

## Exact 10 existing native form contracts (no duplicates)

| Key | Offer | Widget | Product → Training | ₽ |
|---|---:|---:|---|---:|
| single:rejection | 8934973 | 1686768 | 4555636 → 936016494 | 3,333 |
| single:devaluation | 8934925 | 1686753 | 4555642 → 936016504 | 3,333 |
| single:self | 8934974 | 1686770 | 4557112 → 936016509 | 3,333 |
| single:guilt | 8934979 | 1686767 | 4557582 → 936016513 | 3,333 |
| single:rejection_program | 8933492 | 1686693 | 4557988 → 936022301 | 6,990 |
| single:dnv | 8934207 | 1686740 | 4550894 → 583995140 | 7,200 |
| single:union | 8919715 | 1686738 | 4550895 → 933861292 | 6,000 |
| single:source:1 | 8934262 | 1686741 | 4550889 → 934905122 | 6,000 |
| single:source:2 | 8934987 | 1686774 | 4550889→934905122 + 4550891→934905123 | 10,000 |
| single:personal_zoom | 8934993 | 1686776 | 4559058 → no Training; 3 Zoom sessions service | 80,000 |

Lot 5 title remains **«Исцеление отвержения»**. Source II is **one existing Offer with two Products**, not duplicate Offers. Trainer **935051957** including promotion remains a separate QA-only candidate; 11,690 bundle **Offer 8935004 / Widget 1686790** remains a separate QA-only bundle, not one of these 10 single-form mappings.

## Exact six missing Training IDs for site engineer

A **fresh read-only inspection** of actual site \`/srv/factory-scratch/bf2026-checkout-r2-20261119/catalog-r110.json\` and \`offer-registry.json\` still found **NULL** Training IDs in BOTH files for the same six existing bindings. Confirmed native IDs in issue #4112 comment 6999798652:

1. \`single:rejection\` Product4555636 → Training**936016494**
2. \`single:devaluation\` Product4555642 → Training**936016504**
3. \`single:self\` Product4557112 → Training**936016509**
4. \`single:guilt\` Product4557582 → Training**936016513**
5. \`single:dnv\` Product4550894 → Training**583995140**
6. \`single:source:1\` Product4550889 → Training**934905122**

The R124 overlay populated these six IDs **in memory on isolated stage only**; SHA checks verified the original stage catalog and registry were unchanged. The site engineer should perform an independent CAS/readback before making any eventual **metadata-only** site change; this backend engineer made **zero production file writes**. The stage expects the unchanged remaining mapped IDs, including full two-Product Source variant and service with no training.

## Real tests / database

**10/10 targeted R124 tests PASS:** 8 real HTTP + PostgreSQL test results (one suite with 7 specific HTTP/DB subtests) and 2 stage-only overlay/tamper tests. Real staging calls covered exact 10 keys and price/offer/widget/product/training identifiers, 10 public form 404s, 10 public start 503s, wrong/missing consent, forced marketing opt-in, incorrect origin/extra amount/forged paid fields, exact replay, concurrent same-key requests and changed-key conflicts.

Final real PostgreSQL readback after test cleanup:
- \`bf2026_single_checkout_qa_intents\`: **0 rows**.
- \`bf2026_native_bundle_verification\`: **0 rows**.
- \`bf2026_getcourse_callback_hints\`: **0 rows**.

Final real HTTP readback on port 18770 independently verified Zoom no-Training contract and two-product Source II contract, all \`public_release_allowed=false\`. The actual production registry still has \`rollout_enabled=false\` and zero public checkout bindings.

## Unfinished, deliberately HOLD

- The native GetCourse oferta field \`customField-22204810\` may be configured as required in the editor; **a real negative no-consent provider-side submission has not been proven**, so the browser or QA input cannot substitute for that evidence.
- A paid order, independently verified fiscal receipt, native Purchase/Training grant readbacks (or three Zoom session booking fulfillment) remain unverified. No release token, customer checkout URL or payment link generated.
- GetCourse API secret is absent; no real provider backend readback performed here.
- Public site remains HOLD until the **separate site engineer** applies only evidence-backed metadata and an independent owner-approved paid/receipt/access/consent E2E exists. Do not use staging tests as a real payment receipt.
