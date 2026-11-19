# BF2026 BACKEND R130 · versioned 12-entry site-offer manifest · 2026-11-19

Existing `lenar2/luch` Draft PR **#17**, branch `bf2026-r109-site-boundary-qa-r1-20261119`. This extends R127/R128/R129; it does not duplicate R127's Ed25519 signer or claim native GetCourse evidence.

## R130 scope and why this is new

R127 already has an owner-signed Ed25519 revision manifest for the **10 individual CTA routes**. R128 has the exact **12 site entries**: those 10 routes plus the Trainer and bundle QA-only entries. What was missing was a **versioned, persistent catalog-level manifest** that binds every one of those 12 exact entries to its Offer revision SHA, R128 native map and the R127 route revisions, with a database anti-rollback head and nonce linkage.

R130 adds that missing layer. The 12 records mean 12 mapped **site entries**, not 12 unique Product IDs; multi-product Source II and bundle preserve their exact native Product→Training pairs. No 265-price/combinations audit was repeated.

## New files

- `r130-versioned-manifest.cjs`
  - Versioned Ed25519 envelope, pinned owner key ID and strict schema.
  - Exactly 12 entry keys from R128; exactly 10 individual CTA route keys; two entries remain explicitly QA-only and never become routable.
  - Each entry pins exact site lot/variant, route key, Widget ID, Offer ID, amount, customer title/fulfillment, Product→Training pairs, offer `revision_sha256`, native readback flag/time and evidence SHA256.
  - Pins the exact R128 entry map SHA256: **`f4e5d8505e74952e09d9a7f5d1d098eb4d4425d0a17b378ab68f4ba9d9d010b6`**.
  - All 10 route revisions/evidence/timestamps must match the independently verified R127 signed 10-route manifest. All 12 entries require native Offer readback evidence. No unsigned manifest or synthetic fixture can activate the production scope.
  - Maximum manifest lifetime 7 days; readback freshness 30 days; route-manifest expiry is rechecked at runtime.
  - Runtime readback checks the persisted head against maximum history version so a lower head cannot silently be treated as current.
- `r130-versioned-manifest.sql`
  - PostgreSQL16 append-only-by-contract manifest history and persistent high-water head.
  - Unique version/hash history and FK-protected current head.
  - Adds four R130 linkage columns to the R127 nonce row: registry scope, manifest version, manifest SHA256 and site-entry key. The DB CHECK requires all four NULL or all four valid; the FK pins the nonce to an existing signed-manifest history row.
  - Public-release columns are hard constrained false.
- `r130-versioned-manifest.example.json`
  - 12-entry owner manifest template with the exact map hash and correct 10 route keys.
  - All 12 revision SHA256 values, evidence hashes, native-readback flags/timestamps, key ID and signature are deliberately unset/false. The `notes` member must be removed from a future canonical envelope. **This template is not a signature or native readback.**
- `r130-register-versioned-manifest.cjs`
  - Explicit one-shot staging-only registration CLI. Requires `BF2026_STAGE_ONLY=1`, `BF2026_R130_APPLY_MANIFEST=1`, exact stage DB pool path, owner-private R130 public key + signed 12-entry manifest, and independently verified R127 route manifest.
  - Genesis version 1 requires null previous hash. Later versions must be exactly previous+1, carry the exact current previous-manifest hash, and have strictly increasing issue time. Exact same-version/same-hash retry is idempotent; same/lower version with a different hash, skipped version or wrong previous hash is rejected.
- `r130-stage.env.example`
  - Owner-private paths only; apply disabled. Optional native-consent observer is explicitly OFF.
- `r130-native-consent-observer.cjs`
  - Optional R127-compatible verifier backed only by a fixed-path, owner-private, audited read-only transport. It requires two fresh Ed25519-signed readbacks bound to the same R127 nonce, order, Offer, Widget and revision: native SYSTEM offer-checkbox acceptance, plus a separate previously executed unchecked-submit negative-test report showing rejection before order creation. It never submits a form, creates an order, calls GetCourse directly, or accepts USER field 22204810 as proof. Observer signature authenticates the owner observer, **not GetCourse**. Any missing/invalid/expired response returns null and leaves consent HOLD.
- `r130-native-consent-observer.test.cjs`
  - Six unit tests: valid R127-compatible attestation, wrong order/Offer/revision, missing or false native consent, USER-field substitution, missing/failed unchecked-submit report, wrong key/tamper, stale evidence, nonce replay, mutable transport rejection and default-off behavior.
- `patch-r130-native-consent-observer.py`
  - One-shot patch for the exact R130 staging server to wire the optional verifier into R127. With the flag unset or owner-private files absent, loader returns null. No live provider call is made.
- `patch-r130-stage.py`
  - One-shot source-anchored patch for only `/srv/factory-scratch/bf2026-r118-relay-stage-20261119/server.js`. Refuses production/other paths and duplicate patching.
- `r130-versioned-manifest.test.cjs`
  - Unit tests for all 12 exact entries/10 routes, map pin, product/training/offer/widget/price mismatches, missing entry, bad route set, bad revision SHA, unsigned/tampered/wrong-key, expiry, stale readback and scope/map drift.
- `r130-versioned-manifest.integration.test.cjs`
  - Actual PostgreSQL16 + loopback HTTP test with explicitly isolated `BF2026_R130_TEST` scope and ephemeral **TEST-ONLY** Ed25519 key/manifest. Tests persistent version 1→2 hash chain, idempotent exact manifest replay, same-version altered replay rejection, wrong previous hash rejection, challenge→nonce→manifest row binding, wrong revision 409, missing nonce/revision 422, stale callback 409, identical callback 200 duplicate, changed replay 409, and old nonce rejection after manifest rotation. A fresh Node process with a fresh PG pool verifies version 2 survives restart/readback. Test rows are deleted after completion.
- `r130-stage.integration.test.cjs`
  - Actual patched 18774 HTTP + PostgreSQL readback: no owner manifest/key means challenge and callback stay 503; QA status is private; public sales remain HOLD.

## Existing modules extended

- `r127-consent-boundary.cjs`: optional R130 manifest binding is inserted into the **same** R127 challenge row as the nonce. R130 callback guard runs **inside the existing R127 PostgreSQL callback transaction** after `SELECT … FOR UPDATE`; it locks the current manifest head `FOR SHARE` and requires exact current version/hash, site entry, route, Offer, Widget, amount and revision SHA. Old-manifest nonce callbacks are stale after a version rotation. Legacy R127 tests without an R130 binding remain supported.
- `r127-consent-http.cjs`: stale R130 nonce linkage maps to HTTP 409.
- `patch-r130-stage.py`: fresh R129 stage patch now wires the optional native-consent verifier loader, default OFF.
- `r127-stage.integration.test.cjs`, `r129-stage.integration.test.cjs`, `r129-browser-preview.e2e.cjs`: regressions now expect the stricter R130 manifest HOLD before R129 field/callback gates.

## HTTP order of enforcement

1. R130 requires the currently persisted, unexpired, correctly signed 12-entry manifest before the site challenge, provider callback or private R127 QA session/challenge can pass.
2. R129 still independently requires the two native GetCourse **Order** fields and the native Process mapping to be owner-attested and match PostgreSQL.
3. R127 binds the nonce to the exact route Offer revision and provider order callback; callback guard verifies the nonce's R130 manifest binding is still current inside the transaction.
4. R127 native consent verification is still **unconfigured**. An authenticated order callback is not GetCourse's digital signature and is not proof that GetCourse rejects an unchecked consent form. A matched callback remains `ORDER_CALLBACK_MATCHED_HOLD`; payment/receipt/grants/owner release remain separate gates.

The 12 entries are:
- 10 individual routes: four audio products, Lot 5 «Исцеление отвержения», ДНВ, Союз, Source I, Source I+II, and 3 Zoom sessions.
- Two non-routable QA-only entries: full «Тренер по отношениям» and the 11,690 ₽ bundle.
- Trainer keeps full Training **935051957**. Zoom keeps no Training. Source II and bundle preserve both Product→Training pairs.
- User custom field **22204810** remains USER-scope client UI only and is never accepted as order consent proof.

## Actual staging work and evidence

- R130 migration applied successfully to the existing isolated PostgreSQL16.
- R130 one-shot stage patch applied to the existing isolated R129 server; backup: `server.js.before-r130-stage.backup`.
- R130 site server restarted after the optional adapter hook was wired: **127.0.0.1:18774**, PID **2802941**. Observer enable flag is absent/OFF.
- Existing isolated R128 storefront preview remains **127.0.0.1:18775**, PID **2299919**. Independent R126 stage remains **127.0.0.1:18773**, PID **1738222**.
- Actual runtime has **no** R130 manifest public key/file, R127 signed route manifest/key, R129 owner config/key, R130 native-consent observer public key or fixed-path observer transport. `BF2026_R130_NATIVE_CONSENT_OBSERVER_ENABLED` is absent/OFF; loader returns null. Private-file checks confirmed all corresponding files absent.
- Actual R130 PostgreSQL scope `BF2026_SITE`: no head/history row. Test scope `BF2026_R130_TEST`: no head/history row after cleanup. R127 challenges **0**, R124 intents **0**, R123 readbacks **0**, native bundle verifications **0**, callback hints **0**. GetCourse Export budget **0**, outstanding export NULL.
- R129 fields remain `consent_nonce.field_id=NULL`, `offer_revision_sha256.field_id=NULL`, state `UNVERIFIED`; native Process ID NULL/UNVERIFIED.
- Actual `/api/checkout/consent/status`: challenge issuance false, callback contract false, provider signature false, provider unchecked-consent negative test false, public release false.
- Actual `/api/checkout/status`: `sales_ready=false`, `verified_sale_routes=0`.
- Original approved R109 homepage SHA256 remains **`89ca216804b3073092906c73b1362c1d07f54351295d7c0a1a4d3f65ee26e5a3`**; production files were not modified.
- Registration CLI was intentionally attempted with missing trust files and exited nonzero with **`R130_OWNER_TRUST_OR_SIGNED_ROUTE_MANIFEST_UNAVAILABLE`**. No signed manifest was generated or registered.

## Tests actually run

**37/37 Node tests PASS**:
- R130 unit: 5/5.
- R130 PG16 + real loopback HTTP + fresh-process persistence: 1/1.
- R130 actual 18774 stage HTTP/PG: 1/1 (re-run after optional observer wiring).
- R130 native-consent observer adapter: 6/6.
- R127 actual stage regression: 6/6.
- R129 actual site + preview + PG regression: 7/7 (re-run after optional observer wiring).
- R127 real PG/HTTP protocol regression: 10/10.
- R128 ten-route challenge/callback regression: 1/1.

**Separate disposable headless Chromium:** 10/10 actual R109 Buy CTA clicks through cart → R128 preview → actual R130 HTTP HOLD. Both Source variants included. Two negative browser cases PASS (Trainer remains QA-only; preview cannot proxy provider callback). `native_provider_requests=0`, orders=0, payments=0, public payment navigations=0. This browser was separate from the GetCourse UI browser; external network requests were blocked.

## Apply / registration (only after separate owner-authorized native UI readbacks)

Do not apply the owner template as-is. A separate owner-authorized UI owner must first establish actual GetCourse Offer readbacks for **all 12 mapped entries**, and the 10 route readbacks must agree exactly with R127. Then the owner can sign the canonical R130 envelope offline with a separately pinned Ed25519 key. No keypair or signature is generated by this code.

For a fresh isolated R129 stage only:

```bash
# 1. Apply r130-versioned-manifest.sql to the isolated PostgreSQL16.
# 2. Patch the exact isolated server once:
python3 bf2026-checkout/site-boundary-qa-r1/patch-r130-stage.py \
  /srv/factory-scratch/bf2026-r118-relay-stage-20261119/server.js
node --check /srv/factory-scratch/bf2026-r118-relay-stage-20261119/server.js
# 3. After independent owner-native readbacks and offline signatures exist:
BF2026_STAGE_ONLY=1 BF2026_R130_APPLY_MANIFEST=1 \
BF2026_R115_DB_POOL_MODULE=/srv/factory-scratch/bf2026-r118-relay-stage-20261119/stage-pool-module.cjs \
node bf2026-checkout/site-boundary-qa-r1/r130-register-versioned-manifest.cjs
```

The command above remains blocked until the owner-private signed R130 manifest, pinned R130 public key and independently signed R127 route manifest actually exist. Even successful stage registration is metadata attestation only, not native consent/payment/receipt/grants PASS and **does not enable public sales**. R129 Order-field IDs and Process ID must also be independently verified before the next gate can pass.

**Final state: R130 implementation and staging QA PASS; production and public sales HOLD. No GetCourse UI, tab, mutex, production deploy, real order, payment, receipt, access grant or mailing was touched.**
