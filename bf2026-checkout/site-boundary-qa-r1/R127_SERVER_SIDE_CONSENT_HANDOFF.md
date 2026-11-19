# BF2026 BACKEND R127 — server-side consent boundary handoff

Date: 2026-11-19. Existing PR #17, branch **bf2026-r109-site-boundary-qa-r1-20261119**. No new PR. This is an isolated QA/staging implementation, not a production release.

## Verified current code and actual stage

PR HEAD before this handoff: **3bec9f76fb2d52767f6b711e268847b03e000b51** (will advance when this document is committed).

New files:
- **r127-consent-boundary.sql** — PostgreSQL ledger for single-use challenges and provider order callbacks.
- **r127-consent-boundary.cjs** — exact route/Offer/revision challenge issuance, 32-byte nonce, HttpOnly-session binding, timestamp window, strict GetCourse order callback matching, transactional replay prevention, and fail-closed native-consent attestation validator.
- **r127-consent-http.cjs** — QA-only session/challenge/inspect routes and a separate bearer-authenticated GetCourse process callback route.
- **patch-r127-stage-consent.py** — one-shot patch for the exact isolated staging server.js; refuses production paths and duplicate patching.
- **r127-offer-revisions.example.json** — ten Offer IDs with approved=false and no fabricated revision hashes.
- **r127-consent-boundary.env.example** — private file paths only, no secret values.
- **r127-consent-boundary.integration.test.cjs** — real PostgreSQL16 + HTTP protocol E2E with test-only fixture revision and test-only bearer secret.
- **r127-stage.integration.test.cjs** — actual patched site HTTP + PostgreSQL E2E with no revision manifest or callback secret.

Actual execution:
- SQL migration applied to isolated database **bfstage**; table **bf2026_r127_consent_challenges** exists.
- Actual copied site server patched only under **/srv/factory-scratch/bf2026-r118-relay-stage-20261119/server.js**, with backup **server.js.before-r127-consent.backup**.
- R127 server runs on loopback only: **127.0.0.1:18774**, PID **1793815**. R126 remains on **127.0.0.1:18773**, PID **1738222**.
- **15/15 targeted test results PASS**: 9 real PG+HTTP protocol checks, 6 actual site-stage checks. These validate the callback contract and fail-closed behavior; they do NOT claim a real GetCourse callback or native consent PASS.
- Actual R127 QA status: HTTP200 with QA key, approved_offer_revisions=0, callback_shared_secret_configured=false, provider_native_consent_verifier_configured=false, provider_native_unchecked_submit_negative_test_verified=false. Anonymous QA access is 404.
- Challenge route returns 503 R127_OFFER_REVISION_NOT_OWNER_VERIFIED; callback route returns 503 HOLD_PROVIDER_CALLBACK_SECRET_NOT_CONFIGURED.
- A valid direct multi-item POST /api/checkout/start is rejected by R127 with HTTP503 R127_PROVIDER_NATIVE_CONSENT_HOLD; forged client consent booleans/nonces do not grant access. Single routes remain independently blocked by R124/R126.
- PostgreSQL after tests: R127 challenges 0; R124 QA intents 0; R123 Export readbacks 0; native bundle verifications 0; callback hints 0. GetCourse Export budget 0; outstanding Export NULL. No GetCourse API call, UI operation, order, payment, receipt, Purchase grant, mailing or production mutation occurred.

## Security model

**The browser checkbox and JavaScript are not trusted.** The R127 callback schema does not accept consent, consent_checked, provider_consent_verified, or any client assertion of consent. An unexpected field is rejected.

The 12 existing widget JS guards and custom field **22204810** are not provider-side proof. Native UI handoff #4112 comment **7001395021** identifies customField-22204810 as the existing user custom field. It is deliberately excluded as legal evidence: a user profile field is not a per-order system consent record.

A challenge is issued only from server-owned route metadata:
- fixed route key → exact existing Offer, Widget and amount;
- an owner-approved per-Offer terms revision SHA-256 (none approved yet);
- server issued_at, expires_at (10 minutes), and a cryptographically random 32-byte nonce;
- a server-created __Host session cookie with Secure/HttpOnly/SameSite=Strict. Only the hash of session and nonce is stored in PostgreSQL.

The documented GetCourse order-created process callback is authenticated by a **server-to-server static Bearer shared secret** (not a GetCourse digital signature). It must return exact order ID/number, buyer ID, Offer IDs, amount, status, provider-created timestamp, the nonce and the pinned terms revision. R127 checks exact Offer/amount/revision, nonce, timestamp window, single-use order binding, and exact duplicate payload. Same-payload callback replay is idempotent; changed payload replay, second order reuse, stale timestamp, wrong Offer or wrong revision is rejected.

A matching order callback produces only **ORDER_CALLBACK_MATCHED_HOLD**. It is **not proof that the provider rejected an unchecked legal checkbox**. The callback contains no documented GetCourse built-in legal-checkbox variable. The native consent verifier is explicitly null in the actual stage. Even if a future independently trusted native verifier attests consent, public_release_allowed remains false pending R126 payment/receipt/grants and owner-release gates.

## Documented GetCourse integration contract — not yet configured

Official GetCourse documentation:
- Callback “Вызвать URL” is a Process operation and supports POST JSON or x-www-form-urlencoded, custom headers and body variables: https://getcourse.ru/blog/276215
- For order processes, documented variables include {object.id}, {object.number}, {object.offers}, {object.cost_money_value}, {object.status}, {object.created_at ...}, and additional **order** fields. The docs also distinguish {object.user...} for user fields: https://getcourse.ru/blog/276215
- GetCourse separates additional fields for Users and Orders, and forms have distinct “Поле пользователя” / “Поле заказа” elements: https://getcourse.ru/blog/1183639

The existing 22204810 is a **user field**, not an order-level nonce or a native per-order consent receipt. Do not map it into the callback as consent proof.

To connect the documented callback in a later, separately approved GetCourse UI task, the owner/UI engineer must first create and verify two **order-level** additional fields and expose them to the order callback:
1. **BF2026 Consent Nonce** — opaque nonce copied from the server challenge into the native order as a correlation value only.
2. **BF2026 Offer Revision SHA256** — pinned revision digest copied from the server challenge into the native order as a correlation value only.

These two fields do not prove consent by themselves; they are untrusted client-carried correlation values checked against the server-issued challenge. The actual native system offer checkbox must be separately proven to be mandatory on the GetCourse server. Do not use customField-22204810 as a substitute.

After those order fields exist and the process is owner-approved, the GetCourse Process “Вызвать URL” configuration should use:
- POST JSON to https://wf.tati-lar.ru/api/checkout/_provider/getcourse/order-created;
- static header Authorization: Bearer <separate random secret> (same secret stored only in an owner-private server file, mode 0600);
- Content-Type: application/json;
- body keys exactly as accepted by R127:
  - deal_id ← {object.id}
  - deal_number ← {object.number}
  - user_id ← {object.user.id}
  - offers ← {object.offers}
  - cost_money_value ← {object.cost_money_value}
  - status ← {object.status}
  - created_at ← the documented order creation timestamp formatted as ISO-8601 **with timezone**; the exact GetCourse format output must be verified in a controlled no-charge callback before enabling. R127 rejects date-only or timezone-free timestamps.
  - consent_nonce ← {object.BF2026 Consent Nonce}
  - offer_revision_sha256 ← {object.BF2026 Offer Revision SHA256}

R127 accepts only those nine fields. The callback secret is a shared bearer secret; it does not create a vendor-signed message. Keep the secret out of GitHub, browser JS, URL query strings, chat, and logs. GetCourse callback operation errors must go to an operator/error branch; GetCourse documents that a failed URL call enters the process “Ошибка” branch.

**Critical provider-side blocker:** the current GetCourse documentation lists order variables and additional order fields but does not document a built-in legal consent result or a cryptographic callback signature. Therefore the callback can correlate an order, but cannot independently establish that the system offer checkbox was accepted. A future nativeConsentVerifier must obtain a separately authenticated native readback and a real controlled provider-side negative test proving that an unchecked submission creates **no order**. Its attestation must be bound to the same order, Offer and revision, explicitly use SYSTEM_OFFER_CHECKBOX, and include a hashed negative-test report. The validator rejects user-field 22204810 and rejects missing/old negative-test evidence. No such verifier or evidence is currently available.

## Exact minimal site-engineer integration

Cherry-pick only these files from the existing branch:

    git fetch origin bf2026-r109-site-boundary-qa-r1-20261119
    git restore --source=FETCH_HEAD -- \
      bf2026-checkout/site-boundary-qa-r1/r127-consent-boundary.sql \
      bf2026-checkout/site-boundary-qa-r1/r127-consent-boundary.cjs \
      bf2026-checkout/site-boundary-qa-r1/r127-consent-http.cjs \
      bf2026-checkout/site-boundary-qa-r1/patch-r127-stage-consent.py \
      bf2026-checkout/site-boundary-qa-r1/r127-offer-revisions.example.json \
      bf2026-checkout/site-boundary-qa-r1/r127-consent-boundary.env.example

Then in an **isolated stage only**, after confirming the R123/R124/R126 prerequisites and current file version:

    psql "$BF2026_STAGE_DATABASE_URL" -v ON_ERROR_STOP=1 \
      -f bf2026-checkout/site-boundary-qa-r1/r127-consent-boundary.sql

    python3 bf2026-checkout/site-boundary-qa-r1/patch-r127-stage-consent.py \
      /srv/factory-scratch/bf2026-r118-relay-stage-20261119/server.js

Keep both R127 paths unset until the owner supplies a genuine approved revision manifest and a private callback secret. The example manifest is intentionally approved=false, has no hashes, and must not be edited to “approved” without native read-only Offer/terms readback. The callback route must remain disabled without its private secret. No production deployment, native GetCourse UI edit, order, payment, email, or grant is part of this handoff.

## Release status

**HOLD.** Server-side provider consent is not proven. There is no configured GetCourse callback secret, no approved native Offer revision manifest, no order-level nonce/revision fields, no provider-side unchecked-submit negative test, and no independent native consent readback. R127 is an executable fail-closed boundary and E2E-tested integration contract, not a sales-ready implementation.
