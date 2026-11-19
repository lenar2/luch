# BF2026 BACKEND R125 · actual R109 storefront CTA → R124 HTTP/PG · 2026-11-19

Existing PR **#17** in **lenar2/luch**, existing branch \`bf2026-r109-site-boundary-qa-r1-20261119\`. R125 was implemented in this PR and no new PR opened.

## Actual isolated frontend integration

**Real approved frontend source (untouched):**
\`/srv/factory-scratch/luch-public-site-v01/__white_friday_wf_checkout_r109_20261118_5b7f19/\`

**Independent staging copy, actually created:**
\`/srv/factory-scratch/bf2026-r125-frontend-isolated-20261119/www/\`

Verified SHA256 of original R109 \`index.html\` before AND after: \`89ca216804b3073092906c73b1362c1d07f54351295d7c0a1a4d3f65ee26e5a3\`. Original CSS, images, R109 cart and checkout bridge remain untouched.

**New committed source files:**
- \`r125-single-cta-preview.js\`: real browser behavior wired to the 10 EXISTING \`button.buy-lot\` CTA surfaces (lot 1–9 + lot 12, including source variant 2). Uses existing real R109 \`BF2026Cart.getSnapshot()\`, checks actual visible heading, button attributes, native pinned exact Offer/Widget/Product→Training/price and same-origin R124 \`inspect\` response. Appends only a local QA consent panel in the isolated cart. A checked consent box and marketing unchecked state are mandatory for the non-payable preview \`prepare\` route; no submitted checkbox is claimed as *native provider-side* consent proof. Existing public payment button stays disabled throughout, no redirect to GetCourse.
- \`patch-r125-isolated-site.py\`: exact-match, fail-closed copier of the real R109 frontend and patch of exactly ten original CTA buttons (append \`data-r125-*\` mapping attributes) and one defer script. The source path, approved title checks, and destination are pinned. It **refuses to patch production** or overwrite an existing preview.
- \`r125-preview-server.cjs\`: stage-only Node loopback static HTTP server and same-origin proxy for only R124 private \`status\`, \`inspect\`, \`prepare\` actions. Pinned upstream is **127.0.0.1:18770**. Existing private QA header loaded strictly on the server and never sent to the browser. Binds only **127.0.0.1:18771** when \`BF2026_R125_PREVIEW_ONLY=1\`; no public network listener. Rejects other proxies/paths/methods/origins, never returns a payment checkout URL or accepts native receipt/grant assertions as trusted.
- \`r125-actual-browser.e2e.cjs\`: **real headless Chromium** test launched in an independent disposable Docker container (separate from the GetCourse UI worker's Chrome). Drives original R109 Buy buttons, cart, Source radio variants, newly added preview consent panel, HTTP to R124 and real stage PostgreSQL. External network requests blocked before outgoing connection; GetCourse UI never opened.

**Real loopback HTTP evidence:** preview PID **1324131**, \`127.0.0.1:18771\`; R124 backend **127.0.0.1:18770**, both isolated, no Caddy or production site changes.

## Exact verified card bindings

These are actual native IDs already documented in #4112, not newly created Offers or simulated provider readbacks.

| Existing client card / variant | Staging native route | Offer | Widget | Products → Trainings | RUB |
|---|---|---:|---:|---|---:|
| Исцеление раны отвержения | single:rejection | 8934973 | 1686768 | 4555636→936016494 | 3333 |
| Исцеление раны обесценивания | single:devaluation | 8934925 | 1686753 | 4555642→936016504 | 3333 |
| Исцеление страха быть собой | single:self | 8934974 | 1686770 | 4557112→936016509 | 3333 |
| Исцеление чувства вины | single:guilt | 8934979 | 1686767 | 4557582→936016513 | 3333 |
| **Исцеление отвержения** | single:rejection_program | 8933492 | 1686693 | 4557988→936022301 | 6990 |
| Школа для девушек на выданье (ДНВ) | single:dnv | 8934207 | 1686740 | 4550894→583995140 | 7200 |
| Союз нового времени | single:union | 8919715 | 1686738 | 4550895→933861292 | 6000 |
| ИСТОЧНИК, 1 модуль | single:source:1 | 8934262 | 1686741 | 4550889→934905122 | 6000 |
| ИСТОЧНИК, 2 модуля | single:source:2 | 8934987 | 1686774 | 4550889→934905122 + 4550891→934905123 | 10000 |
| Личная работа, 3 Zoom-сессии | single:personal_zoom | 8934993 | 1686776 | 4559058→**no Training** | 80000 |

**Separate tenth visible Buy card:** «Тренер по отношениям», Offer8934247/Widget1686781/Product4550897/full Training935051957 incl. promotion/28000, stays **QA-only and blocked**; R124 has no published single-form binding for Trainer. It is not substituted with another Offer. The extra source variant accounts for ten native R124 individual form routes, while the UI contains ten Buy cards.

## Actual browser → HTTP → PostgreSQL E2E evidence

The test ran against real isolated R109 page DOM, not a mocked browser or GetCourse payment. Ephemeral independent Chromium image \`p004-skley-stable-chrome:manual-r1\` with entrypoint overridden to \`/usr/bin/node\`; no shared GUI session or GetCourse tab.

**Browser result: PASS**; complete ten supported native route variants. 10 existing Buy CTA elements found, 10 native binding inspections passed, real Buy/cart and consent clicks reached actual R124 \`/api/checkout/_qa/single-form/prepare\`, real PostgreSQL staging \`bfstage\`.

Negative scenarios passed:
- Unchecked oferta: browser QA button remains disabled; **zero** preview prepare request from the ordinary click.
- Deliberately bypassing browser validation with a direct same-origin HTTP submit: **422** for unchecked oferta, prechecked optional marketing, wrong consent field ID, forged paid=true and caller-supplied Offer ID.
- Marketing checkbox checked blocks the browser's QA prepare.
- Exact same idempotency key replay returns the same HOLD intent (no extra PG row); changed payload reuse rejected by R124.
- Trainer Buy card stays blocked (no R124 route).
- Tampered browser card Offer metadata blocks the stage review, no fallback to another native form.
- JavaScript page errors **0**; actual GetCourse network requests **0**; payment navigations **0**. Two unrelated external URL attempts were intercepted and blocked by Playwright before any network connection.

**Independent real PostgreSQL after browser run, BEFORE cleanup:** exactly **10** staging HOLD rows across the ten expected distinct \`route_key\` values. No customer personal data, paid status, actual consent proof, receipt or grant in this table. The request-key-scoped cleanup deleted only those 10 rows; **0** staging single-form intents remained. Native bundle verification, callback-hint and export-readback tables each **0** rows.

**Public hold re-read:** existing R124 \`GET /api/checkout/status\` still \`sales_ready=false\`, \`verified_sale_routes=0\`; \`GET /api/checkout/form?route=single:rejection\` = HTTP **404**. Not one real order/payment was created.

## Site engineer: minimal code pick, not deploy

From the **existing branch of lenar2/luch**, stage only the three R125 integration files (do not merge/delete any production pages or alter visuals):

\`\`\`bash
git fetch origin bf2026-r109-site-boundary-qa-r1-20261119
git restore --source=FETCH_HEAD -- \
  bf2026-checkout/site-boundary-qa-r1/r125-single-cta-preview.js \
  bf2026-checkout/site-boundary-qa-r1/patch-r125-isolated-site.py \
  bf2026-checkout/site-boundary-qa-r1/r125-preview-server.cjs
\`\`\`

The source \`patch-r125-isolated-site.py\` has **hard-pinned** input R109 and independent output R125 stage locations; it cannot modify the live R109/production frontend. The stage-only QA script checks localhost port 18771 and cannot run on \`wf.tati-lar.ru\`. Retain R124's native consent/receipt/entitlement gates and both Source products; do not ship a payment-unblocking public CTA. R124 #4112 handoff already supplies six missing Training ID metadata changes that the site engineer must coordinate independently with a current-version check.

## HOLD / outstanding REAL proof

This code validates stage-browser checkbox *input* and stage PostgreSQL contract only. It does **not** prove that GetCourse itself rejects an unchecked native oferta field; the separate sole UI worker is handling that. True paid-provider order, fiscal receipt and Purchase→Training grants (or Zoom booking fulfillment) remain unverified; GetCourse API credential still unavailable. Therefore any production release, real form redirect, live charge, receipt, access or marketing action is explicitly **not authorized** by this result. Existing live site was not changed.
