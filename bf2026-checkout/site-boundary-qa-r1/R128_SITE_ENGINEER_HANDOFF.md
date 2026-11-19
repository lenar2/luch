# BF2026 BACKEND R128 — existing native CTA map + R127 consent/order-field bridge

Date: 2026-11-19. Existing Draft PR #17 in lenar2/luch, branch bf2026-r109-site-boundary-qa-r1-20261119. No new PR. This is an isolated staging and site-engineer integration patch; production and GetCourse UI were not changed.

## R128 deliverables

- r128-native-cta-map.json + r128-native-cta-map.cjs: exact 12 already-existing GetCourse widgets, 10 individual R123 routes, 2 explicit QA-only holds. Each row pins native Widget, Offer, price, Product→Training pairs and the already-saved client JavaScript guard block ID. The 22204810 checkbox remains explicitly USER scope and client-only.
- r128-consent-bridge-http.cjs: same-origin, rate-limited, no-store /api/checkout/consent/{status,session,challenge} bridge. The server creates an HttpOnly/Secure/SameSite session. The challenge endpoint accepts only the server's native single selection {kind:"single",lot} or Source variant {kind:"single",lot:9,variant:"1"|"2"}. It recomputes the quote, resolves the existing native CTA map, checks exact Offer/Widget/price/Product→Training metadata, then calls R127. It never accepts caller-supplied route_key, Offer ID, price, nonce, revision, consent_checked or provider_consent_verified.
- r128-order-callback-contract.example.json + r128-order-callback-contract.cjs: fail-closed contract for two distinct Order additional fields and the documented GetCourse Process callback. It rejects user-scope fields, field 22204810, duplicate IDs, missing native readbacks, unverified form population, wrong process variables/endpoint and an unverified timestamp format. Runtime reads only an owner-private 0600 file at BF2026_R128_ORDER_CALLBACK_CONFIG_FILE.
- patch-r128-stage-site.py: one-shot patch for the exact isolated staging server.js. It mounts R128 and additionally gates R127 callback-secret loading on a verified owner-readback Order-field/Process config. It refuses non-stage paths and duplicate patching.
- patch-r128-frontend-stage.py + r128-cta-challenge-preview.js + r128-cta-preview-server.cjs: copy the approved R109 frontend into a new isolated preview, annotate its ten existing Buy buttons with the exact native CTA map, and provide a loopback-only browser preview. The preview asks the R128 server for a challenge only; it does not submit a GetCourse form, create an order, issue a payment, or enable the site's payment button.
- Tests: r128-native-cta-map.test.cjs, r128-order-callback-contract.test.cjs, r128-consent-bridge.integration.test.cjs, r128-stage.integration.test.cjs.

Existing R123/R124/R127 modules are reused. No R121–R127 audit or 265-combination recalculation was repeated.

## Exact confirmed native CTA mapping

Native widget + saved client guard IDs are from #4112 comment 7001395021. Product→Training IDs are from #4112 comment 6999798652. Trainer full-course and bundle restrictions are cross-checked against #4112 comments 7000281666 and 7000377508.

| Site item / route | Widget | Offer | Product → Training | RUB | Saved client guard block |
|---|---:|---:|---|---:|---:|
| Audio 1 · single:rejection | 1686768 | 8934973 | 4555636 → 936016494 | 3,333 | 2263300143 |
| Audio 2 · single:devaluation | 1686753 | 8934925 | 4555642 → 936016504 | 3,333 | 2263300584 |
| Audio 3 · single:self | 1686770 | 8934974 | 4557112 → 936016509 | 3,333 | 2263300881 |
| Audio 4 · single:guilt | 1686767 | 8934979 | 4557582 → 936016513 | 3,333 | 2263301182 |
| Исцеление отвержения · single:rejection_program | 1686693 | 8933492 | 4557988 → 936022301 | 6,990 | 2263299065 |
| ДНВ · single:dnv | 1686740 | 8934207 | 4550894 → 583995140 | 7,200 | 2263299929 |
| Союз · single:union | 1686738 | 8919715 | 4550895 → 933861292 | 6,000 | 2263299843 |
| Источник I · single:source:1 | 1686741 | 8934262 | 4550889 → 934905122 | 6,000 | 2263300014 |
| Источник I+II · single:source:2 | 1686774 | 8934987 | 4550889 → 934905122; 4550891 → 934905123 | 10,000 | 2263301667 |
| Личная работа Zoom · single:personal_zoom | 1686776 | 8934993 | 4559058 → no Training | 80,000 | 2263298821 |
| Trainer · QA-only, not in individual allowlist | 1686781 | 8934247 | 4550897 → 935051957 full course with promotion | 28,000 | 2263302397 |
| Bundle · QA-only, not in individual allowlist | 1686790 | 8935004 | 4557988 → 936022301; 4550895 → 933861292 | 11,690 | 2263297893 |

Counts: 12 native widgets in the map; 10 individually mapped route keys; 2 separately represented QA-only widgets (Trainer and bundle). Source I and Source I+II are two distinct native routes on the existing Source card. Trainer remains on the full Training 935051957, never the partial 935051848. Zoom is a three-session service with no Training grant. The bundle is not silently converted to a single-item route.

The saved guard block IDs prove only that client-side code was saved/read back. They are not provider-side consent proof. The native user checkbox 22204810 is deliberately never accepted as a per-order receipt.

## Order-specific field and callback contract

The callback contract requires two separate custom fields created in GetCourse's Orders section:

1. Title BF2026 Consent Nonce — opaque server-issued, single-use nonce.
2. Title BF2026 Offer Revision SHA256 — the pinned Offer terms revision hash.

Their numeric IDs are unknown and intentionally null in the repository template. Their native readback and population on the actual native order form are both unverified. Do not substitute user field 22204810. These values are correlation only, not proof of consent.

The official GetCourse docs state that Process “Вызвать URL” supports POST JSON and process variables; order custom fields are referenced by their full field title, e.g. {object.FIELD_TITLE}. Field titles used in process variables must not contain dots. User and Order fields are distinct object scopes. Callback operation failures enter the process “Ошибка” branch:
- https://getcourse.ru/blog/276215
- https://getcourse.ru/blog/1183639

After (and only after) the UI owner creates both Order fields and independently reads back their IDs, form population and Process configuration, the owner-private config file must record those readbacks. The runtime validator requires:
- both fields have scope="order", exact titles, distinct positive IDs other than 22204810, native readback=true, form population=true and SHA-256 evidence hashes;
- an Orders Process operation “Вызвать URL”, POST JSON, exact endpoint, exact nine variable mappings below, private Authorization secret configured, an error branch, and readback evidence;
- {object.created_at} actually emits ISO-8601 with timezone. This output format is not assumed from the docs; it must be observed in a controlled callback before the config can pass.

The documented callback payload template is:

    POST https://wf.tati-lar.ru/api/checkout/_provider/getcourse/order-created
    Content-Type: application/json
    Authorization: Bearer <secret from owner-private 0600 file>

    {
      "deal_id": "{object.id}",
      "deal_number": "{object.number}",
      "user_id": "{object.user.id}",
      "offers": "{object.offers}",
      "cost_money_value": "{object.cost_money_value}",
      "status": "{object.status}",
      "created_at": "{object.created_at}",
      "consent_nonce": "{object.BF2026 Consent Nonce}",
      "offer_revision_sha256": "{object.BF2026 Offer Revision SHA256}"
    }

This is a shared Bearer secret, not a GetCourse digital signature. No vendor signature API is invented. The exact nine-key body matches the existing R127 callback parser. A malformed timestamp, missing order field, wrong Offer, wrong amount, wrong revision, reused nonce or changed replay is rejected. An identical callback replay is idempotent.

patch-r128-stage-site.py only loads the R127 callback secret when r128-order-callback-contract.cjs validates the owner-private Order-field/Process readback file. Missing config or secret keeps the callback at HTTP503. The challenge endpoint is also disabled until that config, the secret and the owner-signed R127 Offer revision manifest are all present.

Even a matched callback remains ORDER_CALLBACK_MATCHED_HOLD while the independent GetCourse native consent verifier and server-side unchecked-submit negative test are absent. A callback correlation value does not prove the built-in legal checkbox was enforced.

## Actual staging execution

- R128 site server patch applied only to /srv/factory-scratch/bf2026-r118-relay-stage-20261119/server.js; backup: server.js.before-r128-site-patch.backup.
- R128 site server: loopback 127.0.0.1:18774, PID 2290769.
- Existing R126 read-only stage remains 127.0.0.1:18773, PID 1738222.
- Isolated R109 frontend copy: /srv/factory-scratch/bf2026-r128-frontend-isolated-20261119/www/; preview server 127.0.0.1:18775, PID 2299919.
- Approved original R109 index.html SHA-256 remained 89ca216804b3073092906c73b1362c1d07f54351295d7c0a1a4d3f65ee26e5a3; isolated annotated preview SHA-256 93b09b03d650620ef742a1a1b… (see R128_FRONTEND_PATCH_EVIDENCE.json on the paired stage).
- Preview HTTP smoke: homepage 200, preview JS 200, consent status 200, session 201 with Secure/HttpOnly/SameSite=Strict cookie; challenge returns the expected HTTP503 R128_ORDER_CALLBACK_CONTRACT_NOT_VERIFIED. No native fields or callback config were fabricated.

## Test results

- R128 mapping + callback-contract unit tests: 8/8 PASS.
- R128 actual patched site HTTP/PostgreSQL16 E2E: 7/7 PASS. It confirms exact route metadata, secure session, challenge HOLD without owner-readback fields/config, Trainer/set rejection, callback-secret HOLD, and direct /api/checkout/start remains HTTP503 with no checkout URL.
- R128 protocol E2E: all 10 individual route mappings exercised through actual server quote logic → HTTP challenge → synthetic nine-field callback → PostgreSQL16. Each callback was stored only as ORDER_CALLBACK_MATCHED_HOLD; identical replay returned 200 duplicate; changed replay returned 409. These are local test fixtures, not actual GetCourse callbacks or orders.
- R127 regression against the R128-patched site: 6/6 PASS.
- Total Node test results across the four suites: 22 PASS, 0 FAIL (plus the ten-route loop above).

Post-test PostgreSQL readback: R127 challenges 0; R124 intents 0; R123 Export readbacks 0; native bundle verifications 0; callback hints 0. GetCourse Export budget 0, outstanding Export NULL. No provider requests, native form submits, orders, payments, receipts, grants or mailings were made.

## Exact site-engineer integration pick

Fetch the existing branch and restore only these R128 files plus the updated R127 env example:

    git fetch origin bf2026-r109-site-boundary-qa-r1-20261119
    git restore --source=FETCH_HEAD -- \
      bf2026-checkout/site-boundary-qa-r1/r128-native-cta-map.json \
      bf2026-checkout/site-boundary-qa-r1/r128-native-cta-map.cjs \
      bf2026-checkout/site-boundary-qa-r1/r128-order-callback-contract.example.json \
      bf2026-checkout/site-boundary-qa-r1/r128-order-callback-contract.cjs \
      bf2026-checkout/site-boundary-qa-r1/r128-consent-bridge-http.cjs \
      bf2026-checkout/site-boundary-qa-r1/patch-r128-stage-site.py \
      bf2026-checkout/site-boundary-qa-r1/patch-r128-frontend-stage.py \
      bf2026-checkout/site-boundary-qa-r1/r128-cta-challenge-preview.js \
      bf2026-checkout/site-boundary-qa-r1/r128-cta-preview-server.cjs \
      bf2026-checkout/site-boundary-qa-r1/r128-native-cta-map.test.cjs \
      bf2026-checkout/site-boundary-qa-r1/r128-order-callback-contract.test.cjs \
      bf2026-checkout/site-boundary-qa-r1/r128-consent-bridge.integration.test.cjs \
      bf2026-checkout/site-boundary-qa-r1/r128-stage.integration.test.cjs \
      bf2026-checkout/site-boundary-qa-r1/r127-consent-boundary.env.example

On the exact isolated site stage only:

    python3 bf2026-checkout/site-boundary-qa-r1/patch-r128-stage-site.py \
      /srv/factory-scratch/bf2026-r118-relay-stage-20261119/server.js
    node --check /srv/factory-scratch/bf2026-r118-relay-stage-20261119/server.js

For a separate R109 frontend preview only:

    python3 bf2026-checkout/site-boundary-qa-r1/patch-r128-frontend-stage.py \
      bf2026-checkout/site-boundary-qa-r1/r128-cta-challenge-preview.js
    BF2026_R128_PREVIEW_ONLY=1 node \
      bf2026-checkout/site-boundary-qa-r1/r128-cta-preview-server.cjs

Do not apply either patch to production. The backend server patch intentionally leaves POST /api/checkout/start, public native form routes and sales_ready blocked. No GetCourse UI or mutex access is part of this backend handoff.

## Current release state / remaining gates

HOLD — sales_ready=false, verified_sale_routes=0.

Remaining external/UI evidence:
1. Create and independently read back the two distinct GetCourse Order fields; verify how each value is populated on the existing native order form. IDs and population mechanism are not assumed.
2. Configure/read back the documented Orders Process callback and prove its created_at output is ISO-8601 with timezone. Store callback secret only in owner-private 0600 file.
3. Provide owner-signed native Offer revision manifest + pinned public key for R127.
4. Separately prove provider-side unchecked legal checkbox rejection and supply independent native consent evidence. Existing 12 saved JS blocks remain client-only.
5. Independently verify real payment, fiscal receipt and actual entitlements/Zoom fulfillment under the separate R126 gates.

No production deployment, GetCourse UI/tab/lock action, real order, payment, receipt, grant, email or broadcast occurred.
