# BF2026 R123 · existing PR #17 · backend + independent native form adapter

Date: 2026-11-19. This is a continuation on the EXISTING PR #17 and branch \`bf2026-r109-site-boundary-qa-r1-20261119\`. No new PR and no repeated 265-case audit. No GetCourse UI, order write, production site write, payment, receipt, entitlement or mailing action.

## 1. Actual R123 backend changes

### Read-only GetCourse Export driver: strict source and identity
File: \`getcourse-export-readback.cjs\`

- For the R123 strict staging mode only, exported order must independently contain exact **account_host=study.shkola-dnv.com**, QA buyer **524210421**, native Deal **924624456**, Order **71994**, sole Offer **8935004**, amount **11,690 RUB**, and both Product→Training pairs:
  - Product **4557988** → Training **936022301**;
  - Product **4550895** → Training **933861292**.
- Missing Product→Training pairs return \`PARTIAL_PRODUCT_MAPPING_UNAVAILABLE\` instead of structural PASS. Explicitly wrong or missing account/buyer/offer/order/product/training/amount fails closed.
- The fixed GetCourse Export API path is read-only, sequential and budgeted; it never calls Import API to create orders.
- A fake GetCourse *paid* order+payment export does not establish a fiscal receipt, actual Purchase rights, Training access or a release. All those fields remain false.
- **Live provider limitation:** neither the GetCourse API key nor a real Export response schema has yet been observed. Tests use synthetic fixtures. If the actual export omits Product→Training pairs, the strict adapter deliberately remains PARTIAL instead of inventing provider data.

### Safe secret-provider interface (no key committed)
File: \`r123-secret-provider.cjs\`

- \`createStageSecretProvider()\` reads only the *path* in \`BF2026_GETCOURSE_SECRET_FILE\`, never a raw key environment variable. Allowed directory: \`/srv/factory-scratch/bf2026-r118-relay-stage-20261119/private-credentials/\`.
- Secret file must be a regular non-symlink file owned by the running user, with mode **0600**; directory must be owner-controlled/non-group-writable. Exact private JSON keys: \`account_host\`, \`api_account_name\`, \`key\`.
- The account host must be \`study.shkola-dnv.com\` and the account name must be explicitly supplied. No placeholder account name was inserted into a real credentials file.
- Neither file content, real key nor consumer identifiers are written to GitHub, staging logs or HTTP response. Existing LUCH credential slot remains **unconfigured**.

### PostgreSQL idempotency and sanitized HTTP boundary
Files: \`r123-readback-once.cjs\`, \`r123-readback-once.sql\`, updated \`r121-bundle-qa-http.cjs\`, \`patch-r123-stage.py\`.

- A fixed identity digest plus 32–64 lowercase hex \`X-BF2026-Idempotency-Key\` is mandatory for R123 calls to the existing private \`POST /api/checkout/_qa/native-bundle-readback/export-readback\` endpoint.
- Unique PG insert starts the export at most once per key; exact replay returns the cached sanitized result; concurrent duplicates do not trigger a second provider request.
- Crash/timeout/ambiguous readback produces a durable \`UNKNOWN\` and **never automatically retries with the same key**.
- No request JSON may contain caller-supplied buyer/order/Offer/product IDs: only \`{}\` is accepted. All identity values are server-pinned.
- API response exposes no buyer email, credential, pay link or provider key. \`provider_signature_verified=false\`, \`fiscal_receipt_verified=false\`, \`actual_grants_verified=false\`, \`release_allowed=false\`.
- Existing R122 shared-secret callback is tested as a *hint only*; GetCourse native cryptographic callback signature is NOT documented/proven. The callback does not write payments, receipts or grants.

## 2. Real isolated staging and HTTP readback

Host: the owner-authorized LUCH paired server. Stage files only at:
\`/srv/factory-scratch/bf2026-r118-relay-stage-20261119/\`.

- Additive \`bf2026_getcourse_readback_once\` migration applied in **real PostgreSQL16** staging DB \`bfstage\` on \`127.0.0.1:55439\`.
- \`server.js\` stage copy patched with a backup; \`node --check\` PASS.
- Persistent separate Node candidate PID **1214641** bound to **127.0.0.1:18768**; no public listener, original staging 18765 and production Docker site untouched.
- Fresh repeated HTTP with existing staging QA header:
  - Anonymous GET QA status: **404**.
  - Authenticated GET QA status (twice): **503** with \`postgres_ledger_ready=true\`, \`export_budget_ready=true\`, \`export_reader_configured=false\`, \`provider_reader_configured=false\`, \`release_allowed=false\`.
  - Authenticated POST Export readback \`{}\`: **503** \`GETCOURSE_READBACK_SECRET_OR_LEDGER_UNCONFIGURED\`.
  - Unauthenticated POST Export readback: **404**.
- No actual credential present, so the new persistent stage does NOT call GetCourse.
- After all real PG/HTTP tests: **0** readback-once rows, **0** native-bundle verification rows, **0** callback-hint rows; export budget request_count **0**, outstanding_export_id **NULL**.

## 3. Actual tests: 21/21 PASS

Targeted tests on the paired staging server:
- \`getcourse-export-readback.test.cjs\`: **4/4**.
- Updated \`r122-export-readback-http.test.cjs\`: **2/2**.
- \`r123-secret-provider.test.cjs\`: **1/1** (secret file permission, owner, symlink, path escape, account/schema failures).
- \`r123-single-widget-adapter.test.cjs\`: **4/4**, includes reading the actual site catalog and offer registry WITHOUT writing them.
- \`r123-stage-e2e.integration.test.cjs\`: **10/10** on actual PostgreSQL16 + localhost HTTP. The GetCourse network is a TEST_ONLY fetch stub. Scenarios: QA auth/idempotency before any call; exact unpaid 11,690 + two correct product/training pairs; concurrent and sequential duplicate delivery; missing product evidence; synthetic paid deal+accepted payment yet no fiscal receipt/access proof; wrong account/QA user/deal/offer/product/training/price; shared-secret callback authenticated hint + replay/spoof rejection; timeout UNKNOWN no retry; clean ledgers/no secret leak.

This is **staging transport/database E2E with fake provider responses**, NOT actual provider/order/payment/receipt/grant E2E.

## 4. Independent site engineer adapter (no site writes)

Files: \`r123-single-widget-adapter.cjs\` and \`r123-single-widget-adapter.test.cjs\`.

Stable interface:
\`\`\`js
const {createSiteEngineerPlan}=require('./r123-single-widget-adapter.cjs');
const plan=createSiteEngineerPlan({catalog,registry});
// QA-only diagnostic; never gives checkout_url or public release
\`\`\`

It reconciles **10 existing native GetCourse widget bindings** using native Product/Training IDs already documented by the sole UI engineer in #4112 comment **6999798652**. It validates immutable Offer/widget/price/primary product, rejects a wrong Lot 5 title, refuses Trainer and Bundle as public single forms, and never changes the site. Site Engineer must retain the global \`rollout_enabled=false\` and all \`public_release_allowed=false\` flags.

**Actual read-only site findings on 2026-11-19:** 10 existing bindings, **6 missing Training ID metadata** in \`catalog-r110.json\` / \`offer-registry.json\`. Proposed precise metadata-only values:
- \`single:rejection\`: Product4555636 → Training **936016494**.
- \`single:devaluation\`: Product4555642 → Training **936016504**.
- \`single:self\`: Product4557112 → Training **936016509**.
- \`single:guilt\`: Product4557582 → Training **936016513**.
- \`single:dnv\`: Product4550894 → Training **583995140**.
- \`single:source:1\`: Product4550889 → Training **934905122**.

The combined Source II binding has already been provided as an actual two-product ID mapping in the current registry (\`missing_multi_product=0\`); do NOT flatten or create a duplicate Offer. Zoom service Product4559058 has **no Training** (0 native); do not invent one.

These are QA metadata proposals for the separate site engineer, **not saved to production by this backend worker**. Keep public consent-negative test and paid E2E HOLD; the sole UI worker's latest comment reports native builder consent required while public/client enforcement remains incomplete.

## 5. Unfinished prerequisite / next step

1. Securely provision a real GetCourse API credential in the stage-only private 0600 JSON file; bind the correct API account name/host, and configure only its path through \`BF2026_GETCOURSE_SECRET_FILE\`. Do not paste the secret into chat or GitHub.
2. Restart or launch a fresh isolated stage process with that file path and perform a **real read-only** GetCourse Export API call for the pre-existing QA Order71994. Strict identity checks may return PARTIAL if the real provider export lacks product/training pairs.
3. Independently obtain GetCourse-native fiscal receipt and actual two 365d AFTER_PAY grant readbacks; these are NOT available from a signed/tested callback hint or the generic Export API alone.
4. The site engineer can apply only six verified missing Training IDs after current-version/CAS checks, preserving approved design, prices, existing Offer/widget IDs and all public checkout HOLD flags. Actual consent-negative server test and paid QA E2E still required before public sale.

Existing PR #17 only, no new PR, no production writes, no GetCourse UI or browser touched, no 265 permutations reaudited.
