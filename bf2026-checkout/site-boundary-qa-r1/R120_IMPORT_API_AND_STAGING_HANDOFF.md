# BF2026 R120 — staging relay + provider import idempotency

**Scope:** backend-only, isolated actual site staging (bfstage PostgreSQL + R112/R115 server). No production changes, no GetCourse UI, no API credentials, no provider API calls, no payment/grant actions.

## What was verified in this run

1. The existing R115 event inbox migration is present in the isolated bfstage database: bf2026_native_event_inbox.
2. R115 route is mounted in the existing staging server at 127.0.0.1:18765; a request without authentication is rejected (401) and produces no payment/grant.
3. R115 handler was exercised through a real local HTTP server with the real PostgreSQL inbox. A one-time in-memory test-only relay HMAC key was generated for this integration test; it is not a GetCourse credential and was not persisted.
   - signed event: 202 ACCEPTED_PENDING_READBACK
   - exact replay: 202 DUPLICATE_PENDING_READBACK
   - forged HMAC: 401 RELAY_SIGNATURE_INVALID
   - changed body with same event ID: 422 RELAY_EVENT_ID_REPLAY_CONFLICT
   - extra PII or spoofed source field: 422 RELAY_HINT_FIELDS_INVALID
   - only one primary row persisted, state PENDING_PROVIDER_READBACK, then our test row was deleted.
4. Applied additive r120-import-ledger.sql to the same isolated PostgreSQL database. The table bf2026_getcourse_import_ledger was verified by catalog readback.
5. Real PostgreSQL state-machine test:
   - same idempotency key is reserved once; duplicate gets IN_PROGRESS;
   - ambiguous provider timeout becomes PROVIDER_OUTCOME_UNKNOWN and blocks automatic retry;
   - successful synthetic response fixture only follows STEP_0_CONFIRMED → ORDER_CREATED;
   - exact repeated commit returns REPLAY; duplicate reservation returns COMMITTED;
   - same key with a different customer identity HMAC returns CONFLICT;
   - all R120 import-ledger test rows were deleted after the run.
6. Unit tests: R119 4/4 + R120 9/9; actual PostgreSQL/HTTP integration suite 5/5.

## Files

- ../r119-import.cjs, ../r119-import.test.cjs: existing sequential Import API candidate. Explicitly live_enabled=false; no network call. Two lines are allocated from R107 quote: Offer8933492 = 6,290 RUB; Offer8919715 = 5,400 RUB; total 11,690. deal_currency=RUB, deal_status=new, deal_is_paid=0.
- r120-import-state-machine.cjs: validates each request before sending; validates exact HTTPS account host, TLS/no redirects, response action/result, provider deal ID/number/user ID; requires same deal identity across the second append; requires a same-account HTTPS payment link. Does not implement a fetch/network client.
- r120-import-ledger.sql: durable idempotency/step ledger, customer identity stored as HMAC only (not email).
- r120-import-state-machine.test.cjs: request, response, identity, transport and failure-path tests.
- r120-stage-postgres.integration.test.cjs: explicit opt-in real staging test; requires BF2026_STAGE_ONLY=1 and a pool module at BF2026_STAGE_PG_POOL_MODULE.
- R120_STAGING_INTEGRATION_EVIDENCE.json: sanitized result summary.

## Provider identity and signature truth

GetCourse API v1 docs describe a secret key parameter in POST body and JSON response fields (deal_id, deal_number, user_id, payment_link). They do not document a cryptographic signature on Import API responses. The official docs explicitly warn Import API is for data import, not operational real-time control, and impose monthly object-creation limits. See https://getcourse.ru/help/api.

Therefore:
- TLS + exact host + provider-returned deal/user identifiers are validated by R120.
- provider_response_signature is explicitly NOT_DOCUMENTED_BY_GETCOURSE; do not call it signed.
- R115 HMAC authenticates only our internal relay hop, not GetCourse itself.
- The real provider paid state must still come from independently read-back native order/payment/receipt/grants, with a separate trusted site-engineer/QA evidence attestation.
- Import API is a candidate only. It is not approved or enabled for live checkout.

## Exact staging acceptance command

    cd /srv/factory-scratch/bf2026-r118-relay-stage-20261119
    BF_R109_SERVER=/srv/factory-scratch/bf2026-r118-relay-stage-20261119/server.js node --test site-boundary-qa-r1/r120-import-state-machine.test.cjs r119-import.test.cjs
    BF2026_STAGE_ONLY=1 BF2026_STAGE_PG_POOL_MODULE=/srv/factory-scratch/bf2026-r118-relay-stage-20261119/stage-pool-module.cjs BF_R109_SERVER=/srv/factory-scratch/bf2026-r118-relay-stage-20261119/server.js node --test site-boundary-qa-r1/r120-stage-postgres.integration.test.cjs

The opt-in integration test asserts the pool is 127.0.0.1:55439, database bfstage, and refuses to run without BF2026_STAGE_ONLY=1.

## One UI evidence request

Requested exactly one read-only evidence bundle for the existing Order #71994 / Deal 924624456 in #4112 comment 6998399122. It asks for fresh order, payment/receipt, purchase-grant, and actual callback configuration readbacks; no new order, payment, status change, PII, or secret. Existing order #71994 is one inactive QA Offer8935004 with two Products, not a two-Offer order.

## Release boundary

https://wf.tati-lar.ru/api/checkout/status remains sales_ready=false, verified_sale_routes=0. No R120 production deploy, no GetCourse Import API call, no new provider credential, no order, no payment, no grant, no marketing. Do not turn an HMAC relay hint or synthetic response fixture into paid proof.
