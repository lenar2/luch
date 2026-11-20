# BF2026 R122 · backend continuation and real staging evidence
Date: 2026-11-19 (+07)  
Existing PR: #17 — https://github.com/lenar2/luch/pull/17  
Branch: \`bf2026-r109-site-boundary-qa-r1-20261119\`  
No new PR. No 265-combination audit. No GetCourse UI/browser editing, no production mutation.

## Exact native bundle identity and latest native evidence
- QA user: **524210421**.
- Order **#71994**, Deal **924624456**, position **942536770**, quantity 1.
- One native Offer **8935004**, Widget **1686790**, **11,690 RUB**.
- Offer contains Product **4557988 → Training 936022301** and Product **4550895 → Training 933861292**. Both native rights: limited, AFTER_PAY, 365 days, no partial-payment access.
- Native readback #4112 comment **6998321115**: Order New, Payment expected, paid total 0, no payment/receipt, no new purchases/grants.
- Later native UI save #4112 comment **6998925733**: Offer8935004 is active **QA-only**, with \`access_type=not_show\`, \`access_hide_not_accessible=true\`, exact built-in buyer rule \`idsrule=524210421\`, tester count 1. This is not public-sale authorization and does not change the unpaid order.
- No duplicate order, no payment attempt, no grant, no mailing.

## GetCourse backend capability readback — actual, current
LUCH \`getcourse_status\` on paired Mac:
- Host observed: \`study.shkola-dnv.com\`; API account name unknown.
- API credential slot \`getcourse/study.shkola-dnv.com\`: **credentialConfigured=false**.
- API account name known: **false**.
- Browser probe: \`BROWSER_PROBE_FAILED / GETCOURSE_PROBE_TARGET_UNAVAILABLE\`.
- No UI work attempted by this backend worker. Sole UI engineer remains undisturbed.

Official GetCourse docs:
- Export API is read-only periodic export for users/groups/deals/payments; it requires the API secret in the \`key\` parameter, has one outstanding export stream, and allows 100 requests per 2 hours.
- Deal export supports \`user_id\`; payment export supports date/status filters. The driver reserves 30 calls and caps itself at **70 per 2 hours**.
- Process “Call URL” supports POST headers and JSON body. Official docs do not document a cryptographic provider-signature header. Therefore a shared-secret header is labelled as such and never represented as a provider signature.
- Docs: https://getcourse.ru/help/api and https://getcourse.ru/blog/276215

## R122 code added to existing PR #17
1. \`getcourse-export-readback.cjs\`
   - HTTPS GET only, allowlisted host, redirect=error, no API-key logging.
   - Fixed QA scope: buyer 524210421, Order71994 / Deal924624456, Offer8935004, amount 11690 RUB.
   - Reads Deals export first; only if status is payed does it request a one-day Payments export and require a matching accepted payment record for this exact deal and amount.
   - Never calls Import API or changes any GetCourse object.
   - It deliberately reports \`receipt_verified=false\` and \`grants_verified=false\`: this Export API path does not independently prove the fiscal receipt or native purchase-level Training entitlement.
2. \`getcourse-export-budget.sql\` + \`getcourse-export-budget.integration.test.cjs\`
   - PostgreSQL account-wide lease, 70 calls/2h, one outstanding export, no concurrent export jobs.
3. \`getcourse-callback-hint.cjs\`, \`getcourse-callback-hint-http.cjs\`, \`getcourse-callback-hints.sql\`
   - Strict callback identity: expected account host, exact deal/order/offer/amount; no PII fields.
   - Auth is a bearer shared secret configured in a GetCourse process header. Canonical event identity deduplicates replays.
   - Stored event is **only a hint**. \`provider_signature_verified=false\`, \`payment_verified=false\`, \`receipt_verified=false\`, \`grants_verified=false\`, \`grant_writes=0\`.
   - No callback secret was generated/stored in GitHub, and no GetCourse process/UI was changed.
4. \`r121-bundle-qa-http.cjs\` now has private POST \`/api/checkout/_qa/native-bundle-readback/export-readback\`.
   - It accepts only an empty JSON object, uses a server-owned export reader, sanitizes user/email fields, and never accepts caller-supplied IDs/filters.
   - \`patch-r122-stage-export-route.py\` wires an optional API-key environment secret into the read-only driver; no key means the route fails closed with 503.
5. Tests: \`getcourse-export-readback.test.cjs\`, \`getcourse-callback-hint.test.cjs\`, \`r122-export-readback-http.test.cjs\`.

## Actual staging state
Isolated R118 staging host:
- PostgreSQL 16: \`127.0.0.1:55439\`, database \`bfstage\`.
- Existing stage server process **18765** was not restarted; its authorized R121 status request still returns 404 because the process loaded the pre-R121 in-memory server code.
- Attempt to restart that existing process was blocked by the tool safety layer: “This tool call was blocked by OpenAI's safety checks. Please double check what you are sending.” No bypass or forced kill attempted.
- Instead, isolated loopback-only candidates were started from the patched stage copy:
  - \`127.0.0.1:18766\` (R121 route candidate)
  - \`127.0.0.1:18767\` (R121 + optional Export API readback route candidate)
- Candidate startup log explicitly reports \`live_orders_enabled=false\`; both listeners bind only to \`127.0.0.1\`, not public interfaces.
- On 18767, repeated authenticated GET \`/api/checkout/_qa/native-bundle-readback/status\` → HTTP503 with \`postgres_ledger_ready=true\`, \`export_budget_ready=true\`, \`provider_reader_configured=false\`, \`export_reader_configured=false\`, \`payment_verified=false\`.
- Unauthenticated status → 404. Authenticated POST \`export-readback\` → 503 \`GETCOURSE_API_KEY_NOT_CONFIGURED\`. Authenticated POST \`reconcile\` → 503 \`HOLD_PROVIDER_READBACK_UNCONFIGURED\`.
- Thus the R121 route is active and repeatably readable on the isolated candidate; the native readback is correctly held because no provider credentials/reader are configured. The original 18765 process is unchanged.

## Test results — actual targeted run
**36/36 PASS**:
- R122 Export API driver unit: 4/4.
- R122 Export API budget on actual staging PostgreSQL: 1/1.
- R122 shared-secret callback unit: 3/3.
- R122 callback actual staging PostgreSQL + HTTP: 1/1.
- R122 export-readback HTTP boundary: 2/2.
- R121 bundle actual staging PostgreSQL + HTTP: 7/7.
- R119/R120 deterministic tests: 13/13.
- R120 actual staging PostgreSQL + HTTP regression: 5/5.

After test cleanup, actual PostgreSQL readback:
- \`bf2026_native_bundle_verification\`: 0 rows.
- \`bf2026_getcourse_callback_hints\`: 0 rows.
- \`bf2026_getcourse_export_budget\`: request_count 0, outstanding_export_id NULL.
No test order, payment, receipt, or access grant was created.

## Still blocked — do not claim paid E2E
- No GetCourse API key in the LUCH credential slot, no known API account name, no authenticated browser target. Therefore no live Export API request was sent and no fresh backend-native order/payment/receipt/access readback was obtained.
- No provider-signed callback contract was found in the official callback docs. The R122 shared-secret callback authenticates possession of a configured secret only; it is not a provider signature.
- Current native evidence still says Order71994 is New / unpaid, no receipt and no new grants. QA-only Offer activation does not imply payment or release.
- Public checkout remains HOLD; do not issue a charge, change status to payed, create a new order, grant access, or send mail.

## Next concrete step
Provision the existing GetCourse API key securely into the LUCH credential slot (and confirm the account/API host) or the approved stage secret environment; do not paste it into chat or GitHub. Then call the private Export readback route for exact QA buyer 524210421, verify current Deal/Order/Offer and any accepted payment record. If a payment exists, obtain independent fiscal receipt and native Purchase/Training entitlement evidence for both products before any release. If callback delivery is chosen, the sole UI engineer must configure the documented POST JSON body and bearer shared-secret header; backend accepts it only as a hint until native readback reconciles it.
