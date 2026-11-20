# BF2026 BACKEND R129 · GetCourse Order-field binding and callback gate · 2026-11-19

Existing **lenar2/luch Draft PR #17**, branch `bf2026-r109-site-boundary-qa-r1-20261119`. **BACKEND ONLY.** No new PR, GetCourse UI, Mac tabs, mutex, new UI chat, production deploy, order, charge, fiscal receipt, access grant, provider request or mailing.

## What actually changed

New committed files in `bf2026-checkout/site-boundary-qa-r1/`:

- `r129-order-fields.sql` — repeatable PostgreSQL16 migration: exactly **two** order-field placeholders (`consent_nonce` and `offer_revision_sha256`) and one order Process callback placeholder. Every native numeric ID starts `NULL`, state `UNVERIFIED`; USER field `22204810` forbidden by DB CHECK. A distinct positive field ID, scope `order`, native evidence SHA-256 and owner signed payload hash are mandatory before a row can reach `OWNER_ATTESTED_QA_ONLY`. Unique index prevents both roles sharing an ID. All release flags constrained false.
- `r129-order-field-registry.cjs` — verifies **offline owner Ed25519 signature** over exact R128 Order-field + GetCourse Process configuration, owner key fingerprint, valid short expiry, two distinct native field IDs, original official Process variables, native form population evidence hashes, and a real native Process ID. On each callback/challenge checks that all owner-signed IDs, evidence digests and Process ID also match PostgreSQL. A signed owner statement is **not** GetCourse's digital signature and is **not** independent provider proof.
- `r129-order-fields.owner-signature.example.json` — owner configuration template. Both GetCourse **Order** numeric IDs, Process ID, signer and native readback hashes remain **unset**, not fabricated. The example's explanatory `notes` must be removed when creating a canonical signed envelope.
- `r129-register-owner-config.cjs` — one-shot, transaction-safe, idempotent stage-only registration CLI. Requires all three: explicit `BF2026_STAGE_ONLY=1`, `BF2026_R129_APPLY_OWNER_CONFIG=1`, and exact stage PostgreSQL module path. Reads only a genuine owner-private signed file; refuses null/unknown IDs, conflicting or partially attested records. Current execution **refuses registration** because no genuine config exists.
- `r129-order-field-gate-http.cjs` — fail-closed HTTP wrapper around existing R127 callback + R128 site preview consent challenge. Without matching signed config **and** PG records, `POST /api/checkout/_provider/getcourse/order-created` and `POST /api/checkout/consent/challenge` return **503** before forwarding a provider payload or issuing a nonce. Read-only authenticated `/api/checkout/_qa/order-fields/status` is 404 without QA key.
- `patch-r129-stage.py` — deployable one-shot source-anchored patch for exact isolated stage `/srv/factory-scratch/bf2026-r118-relay-stage-20261119/server.js`; rejects production paths and duplicate application; wraps callback and challenge. R127 bearer-secret initialization now also requires signed owner config. Backend public checkout remains on the existing HOLD policy.
- `r129-stage.env.example` — only owner-private absolute paths, no keys or IDs.
- `r129-order-field-registry.test.cjs` — signature, tamper, wrong key, wrong native field/process ID, expiry, USER-field rejection.
- `r129-field-registry.integration.test.cjs` — real PostgreSQL16 transaction, ephemeral **TEST-ONLY** owner key/field IDs, real loopback HTTP callback; identical payload replay idempotent (202 then 200 duplicate), changed payload 409, wrong Offer 409, invalid bearer 401 and client checkbox/user field injection 422. Every matching callback stays `ORDER_CALLBACK_MATCHED_HOLD`, never native payment/consent PASS. Synthetic attestation rolls back; test challenge rows are deleted.
- `r129-stage.integration.test.cjs` — actual patched staging server + real R128 frontend proxy + PostgreSQL16; 10 approved CTA selections refused with correct 503 until numeric native IDs verified, no callback accepted, no stage records created.
- `r129-browser-preview.e2e.cjs` — independent disposable headless Chromium, isolated from GetCourse UI, clicks all 10 existing R109 storefront CTA / Source variants → cart → R128 preview → actual R129 HTTP → real PostgreSQL HOLD. External browser requests blocked; no native provider requests/payment route.
  
Existing files updated **only for R129 integration**:
- `r128-cta-challenge-preview.js` — fixes MutationObserver recursion (exclude preview panel) and preserves server HOLD messages after click; updated in isolated preview only. R109 original HTML untouched.
- `r127-stage.integration.test.cjs` — accepts the **more restrictive R129 Order-field HOLD** before the older R127 callback-secret HOLD; never accepts success without native proof.

## Real stage and results

- R129 server: `127.0.0.1:18774` PID **2345022**, actual patched stage server.js; backup `server.js.before-r129-stage.backup`.
- R128 existing isolated storefront preview: `127.0.0.1:18775` PID **2299919** (serves the updated isolated preview script).
- R126 independent stage remains `127.0.0.1:18773` PID **1738222**. Production never touched.
- Original approved R109 HTML SHA-256 **89ca216804b3073092906c73b1362c1d07f54351295d7c0a1a4d3f65ee26e5a3**, unchanged; isolated R128 HTML SHA-256 **93b09b03d650620df610a400963c787dbec7d625e32ed845c6cf28df18c48937**, isolated preview script after R129 fix SHA-256 **88f19da8b13097733a6d245a7b9743dc21d8da8e1375ce368e9ecbcdb7333bde**.
- Real staging SQL rows: `consent_nonce.field_id=NULL`, `offer_revision_sha256.field_id=NULL`, `process_id=NULL`, all three `UNVERIFIED`. No private owner key, owner-signed config, GetCourse API key or provider callback secret was provisioned.
- Actual staging HTTP: `order_callback_contract_verified=false`, `challenge_issuance_enabled=false`, `sales_ready=false`, `verified_sale_routes=0`; direct checkout stays blocked.
- Focused Node test results: **4/4 unit + 1/1 real PG/HTTP fixture + 7/7 actual stage/preview/PG + 6/6 R127 compatibility = 18/18 PASS**.
- Disposable Chromium **10/10 existing CTA routes** plus two negative scenarios (Trainer QA-only, provider callback proxy not exposed) PASS; **0 GetCourse requests, 0 orders/payments, 0 payment navigations**.
- Post-test PostgreSQL ledger: R127 challenges 0, R124 intents 0, R123 readbacks 0, native bundle verification 0, callback hints 0, GetCourse Export budget 0 with outstanding NULL. Test-only signed field IDs/process ID were **never committed** to PostgreSQL.
- Explicit CLI check with absent signed config: **`R129_NO_VERIFIED_NATIVE_GETCOURSE_ORDER_FIELD_OWNER_CONFIG`**, nonzero exit; no registration.

## Exact GetCourse Order-level contract (no UI executed)

The two **Orders-section** custom fields have these exact titles:

1. `BF2026 Consent Nonce` — native **Order** field numeric ID **UNKNOWN / NULL**. A single-use server challenge nonce for order-specific correlation, not a checkbox proof.
2. `BF2026 Offer Revision SHA256` — native **Order** field numeric ID **UNKNOWN / NULL**. Owner-approved native offer terms revision hash, not a checkbox proof.

An actual existing GetCourse **Orders Process** must expose a documented `Вызвать URL` operation: POST JSON, owner-private Bearer header, exact nine-variable payload, verified timezone-qualified `{object.created_at}`, and an error branch. The numeric Process ID is **UNKNOWN / NULL**. Official docs cited in R128 handoff: https://getcourse.ru/blog/276215 and https://getcourse.ru/blog/1183639. No unsupported GetCourse API is invented. Current field `22204810` is **USER scope** and must never be used as the per-order nonce/revision/consent evidence.

After separate owner-authorized UI work has confirmed actual native IDs/field population and Process properties, the owner prepares an offline Ed25519-signed manifest in a private stage file, with a pinned owner public key. Only then may the explicitly gated stage registration CLI be used; its resulting state is **OWNER_ATTESTED_QA_ONLY**, not paid/consent/receipt/grant PASS. Public sales require independent GetCourse server-side unchecked-consent negative test, verified real native payment + fiscal receipt + entitlements or Zoom fulfillment, and explicit owner release.

## Minimal site-engineer restore/apply (isolated stage ONLY)

```bash
git fetch origin bf2026-r109-site-boundary-qa-r1-20261119
git restore --source=FETCH_HEAD -- \
  bf2026-checkout/site-boundary-qa-r1/r129-order-fields.sql \
  bf2026-checkout/site-boundary-qa-r1/r129-order-field-registry.cjs \
  bf2026-checkout/site-boundary-qa-r1/r129-order-fields.owner-signature.example.json \
  bf2026-checkout/site-boundary-qa-r1/r129-register-owner-config.cjs \
  bf2026-checkout/site-boundary-qa-r1/r129-order-field-gate-http.cjs \
  bf2026-checkout/site-boundary-qa-r1/patch-r129-stage.py \
  bf2026-checkout/site-boundary-qa-r1/r129-stage.env.example \
  bf2026-checkout/site-boundary-qa-r1/r129-order-field-registry.test.cjs \
  bf2026-checkout/site-boundary-qa-r1/r129-field-registry.integration.test.cjs \
  bf2026-checkout/site-boundary-qa-r1/r129-stage.integration.test.cjs \
  bf2026-checkout/site-boundary-qa-r1/r129-browser-preview.e2e.cjs \
  bf2026-checkout/site-boundary-qa-r1/r128-cta-challenge-preview.js \
  bf2026-checkout/site-boundary-qa-r1/r127-stage.integration.test.cjs
```

For a **fresh isolated stage that already has R128** (do not run twice on the R129 stage already patched):

```bash
# Apply r129-order-fields.sql to the isolated staging PostgreSQL16 only.
# Then:
python3 bf2026-checkout/site-boundary-qa-r1/patch-r129-stage.py \
  /srv/factory-scratch/bf2026-r118-relay-stage-20261119/server.js
node --check /srv/factory-scratch/bf2026-r118-relay-stage-20261119/server.js
```

Existing `r129-stage.env.example` is a **template only**, not a command to install secrets. Signed config and provider fields are absent, so do not run `r129-register-owner-config.cjs` with approval flags or turn on public checkout. The UI worker «Название лота» has hit ChatGPT max length; a **separate owner-authorized UI chat** is required for any eventual native UI work. Backend did not create or assume that chat.

**Final state: HOLD. No GetCourse native order-field ID, callback process ID, provider consent, authentic payment, receipt or access grants verified.**
