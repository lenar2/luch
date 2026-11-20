# BF2026 Lot10 R133 — GetCourse callback inbox / idempotency

Date: 2026-11-19. Existing PR only: lenar2/luch#17.

## Deliverable

- r133-lot10-order-callback.cjs: server-side POST router at
  /api/checkout/_provider/getcourse/lot10-order-created.
- r133-lot10-order-callback.sql: durable PostgreSQL inbox with unique event,
  deal ID, deal number and one-use consent nonce constraints.
- r133-lot10-order-callback.integration.test.cjs: real isolated HTTP +
  PostgreSQL integration suite.
- This handoff.

The callback is accepted only when a pre-existing R130 intent matches the
GetCourse deal number, SHA256 of the order nonce, offer-revision SHA256,
ordered native Offer IDs, and exact order total. It accepts 2–5 unique Offers.
The callback payload is restricted to the exact nine R128 Process variables.
created_at must be ISO-8601 with timezone; status must be new.

Bearer authorization is compared in constant time. A stable event key and
PostgreSQL unique constraints make retries idempotent: exact replay returns
200 without another row; a changed payload for the same order conflicts 409;
concurrent exact callbacks produce one inbox row. PII is reduced to a SHA256
of user ID; raw email and nonce are not stored in this inbox.

## Explicit trust boundary

GetCourse Process Bearer authentication is a shared secret, NOT a vendor
digital signature. This inbox does not establish:
- native GetCourse field catalog/readback or form population;
- the actual native multi-offer line-item readback or fiscal total;
- accepted legal consent or the unchecked-submit negative test;
- payment, fiscal receipt, or paid 365-day access grants.

The callback never creates or updates a GetCourse order, sends an Import API
request, changes payment status, retries uncertain writes, or releases a
payment link. All trust/release flags are constrained false in PostgreSQL.
It does not modify R130 intents; it is a separate reconciliation inbox.

## Verification performed

Stage PostgreSQL migration applied only to the isolated stage database.
Command:

    BF2026_STAGE_ONLY=1 \
    BF2026_R133_STAGE_POOL_MODULE=/srv/factory-scratch/bf2026-r118-relay-stage-20261119/stage-pool-module.cjs \
    node --test r133-lot10-order-callback.integration.test.cjs

Result: **15/15 PASS**, 0 skipped. Covered valid event, exact replay, altered
replay conflict, concurrent duplicate, wrong/missing bearer, missing secret,
wrong content type, nonce mismatch, revision mismatch, offer mismatch, total
mismatch, non-new status, timezone-less timestamp, extra client field,
unknown intent, and browser-origin denial. Tests use only synthetic local
fixtures in isolated PostgreSQL and a local HTTP server. Fixtures are removed
after tests. No GetCourse API or account UI calls were made.

## Native field IDs remain unverified

The owner supplied candidate Order custom-field IDs:
- Consent Nonce: 23331550
- Offer Revision SHA256: 23331559

These values were **not** written into the native registry and are not treated
as verified. Fresh isolated PostgreSQL readback still reports both R129
field_id values NULL, state=UNVERIFIED, no native readback evidence; native
Order Process ID is also NULL/UNVERIFIED. The private credentials directory
has no provisioned GetCourse API key or R127 callback secret, and the stage
process environment exposes only its database/stage settings, not a GetCourse
key. Thus no authenticated native field-catalog lookup can honestly be
claimed. The official GetCourse API documents the field directory at
POST https://study.shkola-dnv.com/pl/api/account/fields with action=get
and an account API secret key:
https://getcourse.ru/help/api

The callback Process is also not natively configured/read back. The proposed
Lot10 endpoint and its offers, cost_money_value, and timezone-bearing
created_at serialization must be verified from one owner-authorized,
unpaid QA event before relying on it. No GetCourse UI was touched.

## Release state

CALLBACK_MODULE_CODED_AND_STAGE_TESTED; NATIVE_FIELDS_NOT_VERIFIED;
NATIVE_PROCESS_NOT_VERIFIED; GETCOURSE_WRITE_KEY_NOT_PROVISIONED;
PROVIDER_SIGNATURE_NOT_SUPPORTED; NATIVE_ORDER_LINES_NOT_READ_BACK;
PAYMENT_RECEIPT_GRANTS_NOT_VERIFIED; PUBLIC_RELEASE_ALLOWED=false.

Do not enable public set checkout or call Import API until the native
field catalog, form population, callback Process, consent enforcement,
provider path, owner-authorized write credential and downstream order/payment/
receipt/grant readbacks are independently verified. GetCourse documents
Import API as data import, not real-time checkout; prefer a proven native
multi-offer checkout if the account's native cart can enforce the exact
R107 quantity discount and consent.
