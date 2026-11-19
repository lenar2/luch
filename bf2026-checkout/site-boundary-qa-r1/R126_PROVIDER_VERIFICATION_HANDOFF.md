# BF2026 BACKEND R126 · real read-only provider verification handoff

Date: 2026-11-19. EXISTING PR #17 / branch \`bf2026-r109-site-boundary-qa-r1-20261119\` in \`lenar2/luch\`. **Not** a production rollout, GetCourse UI edit, native order, payment, fiscal receipt, grant, mailing or synthetic provider PASS. No new PR created.

## What actually changed

R126 adds a **QA-only production-grade verification boundary**, disabled by default, to the real BF2026 site server staging copy:

1. \`r126-provider-verification.cjs\` pins one and only one existing QA native bundle subject:
   - Account TLS host \`study.shkola-dnv.com\`; QA buyer \`524210421\`.
   - **Order #71994**, **Deal 924624456**, **Offer 8935004**, exact **11,690 RUB**.
   - Exactly two required **native Purchase→Training** mappings: Product **4557988** → Training **936022301**, Product **4550895** → Training **933861292**; both **365 days AFTER_PAY**, separately verified.
   - It reads only PostgreSQL rows created by the earlier R123 **read-only GetCourse Export driver** (\`bf2026_getcourse_readback_once\`), anchored by R123's \`SUBJECT_SHA\` and exact native identity, without accepting a browser-supplied payment/receipt/grants JSON body. A genuine Export Payment match can establish at most export payment data, **never** a fiscal receipt or actual entitlement.
   - Distinct independent native-observer contracts require an actually registered fiscal receipt with receipt identifier, precise amount, account, buyer/order/deal/offer and no refund, AND exactly two real active Purchase grants bound to the same native order/account/buyer/offer with correct Product/Training IDs, native purchase IDs, after-pay 365-day period and unexpired access.
   - **Provider-side no-consent rejection** and separate **owner release approval** are also mandatory. The known 12 native widget client consent guards documented in #4112 comment 7001395021 are **client-only PASS**, not server-side negative proof.

2. \`r126-signed-native-observer.cjs\` and \`r126-approved-observer-loader.cjs\` define the future **owner-approved authenticated read-only native observer** interface (not installed or active). It uses Ed25519 signed, short-lived nonce-bound envelopes, one pinned public-key SHA-256 fingerprint, five-minute freshness, exact account/subject binding, maximum response size and nonpublic audited source module. This **verifies the approved observer's signature, not a GetCourse vendor cryptographic signature**. Any observer asserting anonymous, browser-supplied, old, unauthenticated or mismatched data is rejected.
   - Owner-created server-only transport path is fixed: \`/srv/factory-scratch/bf2026-r118-relay-stage-20261119/private-credentials/observer-transport-approved.cjs\`; must be independently source-reviewed for **read-only** operations before installation. No such transport is currently provisioned.
   - Owner-created Ed25519 public key path is specified ONLY through \`BF2026_R126_OBSERVER_PUBLIC_KEY_FILE\`; file and parent directory must be owner-private, no symlinks. No keypair is created/committed by R126. A signed owner-attested claim is not automatically a real GetCourse receipt or grant; real authenticated native source evidence must be available for source review.

3. \`r126-provider-verification-http.cjs\` is a private server-side bridge. It allows only:
   - \`GET /api/checkout/_qa/provider-verification/status\`
   - \`GET /api/checkout/_qa/provider-verification/bundle\`
   - \`GET /api/checkout/_qa/provider-verification/routes\`
   - \`GET /api/checkout/_qa/provider-verification/cta?route=single:rejection\` and the nine other fixed R123/R124 single-form route keys
   - \`POST /api/checkout/_qa/provider-verification/refresh\` with a 32–64 lowercase hex **X-BF2026-Idempotency-Key** and **NO body**. This calls only the existing R123 \`readOnce\` → GET Export driver (70-call/2h PostgreSQL budget) **if** the owner explicitly enables verification AND a valid owner-private GetCourse key is configured; otherwise it returns HOLD without requesting the native API.
   - All require existing site **X-BF2026-QA-KEY**, wrong origin denied, unknown paths/IDs rejected, no arbitrary native result upload/URL/cookie/token/customer identity, no live GetCourse API credentials exposed.
   - **No API writes**, orders, payment attempts, receipt/grant writes, mailing, checkout URL, public activate, or new GetCourse Offer/Widget creation.

4. \`patch-r126-stage-provider.py\` mounts the above inside the **actual isolated** site \`server.js\` and adds a second per-CTA public release check after the existing R124 gate. It refuses production paths and duplicate stage patching; the public checkout and R124 guard remain HOLD. \`r126-provider-verify.env.example\` documents **flags and private file paths only**, no secrets.

5. \`r126-provider-verification.test.cjs\` and \`r126-real-stage.integration.test.cjs\` cover the unsigned/tampered/unconfigured native-evidence failures, signed-observer nonce/Ed25519 protocol, unknown CTA keys/feature flags, and actual PostgreSQL+localhost HTTP no-provider HOLD. No fake native paid proof is used to claim a real PASS.

## Exact ten existing individual CTA feature flags

The source of truth for stable IDs remains \`r123-single-widget-adapter.cjs\`; R126 revalidates it against the actual R124 in-memory site overlay:

| CTA key | Offer | Widget | Products → Trainings | RUB |
|---|---:|---:|---|---:|
| \`single:rejection\` | 8934973 | 1686768 | 4555636 → 936016494 | 3,333 |
| \`single:devaluation\` | 8934925 | 1686753 | 4555642 → 936016504 | 3,333 |
| \`single:self\` | 8934974 | 1686770 | 4557112 → 936016509 | 3,333 |
| \`single:guilt\` | 8934979 | 1686767 | 4557582 → 936016513 | 3,333 |
| \`single:rejection_program\` | 8933492 | 1686693 | 4557988 → 936022301 | 6,990 |
| \`single:dnv\` | 8934207 | 1686740 | 4550894 → 583995140 | 7,200 |
| \`single:union\` | 8919715 | 1686738 | 4550895 → 933861292 | 6,000 |
| \`single:source:1\` | 8934262 | 1686741 | 4550889 → 934905122 | 6,000 |
| \`single:source:2\` | 8934987 | 1686774 | 4550889→934905122 **and** 4550891→934905123 | 10,000 |
| \`single:personal_zoom\` | 8934993 | 1686776 | 4559058 → **no Training**, 3 Zoom sessions | 80,000 |

**Excluded from the ten single routes:** Trainer Offer8934247 / Widget1686781 / Product4550897 → full Training935051957 with promotion, 28,000 RUB, and the separate QA-only two-product bundle Offer8935004 / Widget1686790, 11,690 RUB. These cannot be substituted into one of the 10 single forms. The actual visible page has 10 Buy cards, whereas the native single route list contains two Source variants and excludes the still-QA-only Trainer card.

Each CTA requires **two independent layers of authorization** to become eligible for a future release:
- \`BF2026_R126_PROVIDER_VERIFY_ENABLED=1\` AND its exact key present once in \`BF2026_R126_CTA_KEYS\`.
- Native provider-owned offer and payment, actual independently inspected receipt, actual per-product grant or Zoom-service fulfillment, negative no-consent **server-side** test and explicit route-specific owner release approval. **R126 does not set any of these second-layer proofs and always responds \`public_release_allowed:false\`.** Merely enabling an environment flag does not turn on a sale.

## Live staging that was actually executed

- Exact isolated backend stage root: \`/srv/factory-scratch/bf2026-r118-relay-stage-20261119/\`.
- The real \`server.js\` had a pre-R126 backup. R126 installed into this isolated file (no production site files changed).
- First independent R126 stage: **127.0.0.1:18772**, later final loader-wired candidate **127.0.0.1:18773**, PID **1738222**. Both are localhost-only. \`live_orders_enabled=false\` on startup.
- **15/15 targeted tests PASS** on the paired server: 8 Node security/config/signature-protocol checks, and 7 real HTTP + PostgreSQL16 test results (one suite with six named inner scenarios). The browser/source/production were not modified, and no synthetic provider payment/grant evidence was manufactured.
- Actual real HTTP \`GET /.../status\` with QA header: HTTP200, actual \`bfstage\` PostgreSQL ready, 10 CTA routes, 0 enabled flags, secret file unconfigured, no native Export evidence. Anonymous QA route: 404.
- \`GET /.../bundle\`: strict **HOLD**, missing all six required proof classes. \`GET /.../routes\` and \`cta?route=...\` return precise hard-pinned feature gates; Trainer/unknown routes 404; off-register query fields rejected.
- \`POST /.../refresh\` without QA idempotency key: 422; with a key but no configured secret or feature flag: HTTP202 \`HOLD_GETCOURSE_READONLY_PROVIDER_UNCONFIGURED\`, **zero GetCourse network requests**, zero export API budget consumption. A caller-supplied paid JSON body: 415; wrong Origin: 403.
- Public \`/api/checkout/status\`: \`sales_ready=false\`, \`verified_sale_routes=0\`. \`/api/checkout/form\`: 404; \`/api/checkout/start\`: 503, no payment URL.
- Real PG after test: prior \`bf2026_getcourse_readback_once\`, \`bf2026_single_checkout_qa_intents\`, native bundle verification and callback-hint rows **unchanged** (0); Export budget count **0**, outstanding Export **NULL**. No extra staging schema or production DB writes.

## GetCourse official documented API / limitations

Official documents:
- <https://getcourse.ru/help/api> — **Export API** provides **users, groups, orders/deals, payments**, not a dedicated fiscal receipt / native Purchase-to-Training rights readback. Sequential export; **100 API requests per two hours** shared per account; it is for periodic analytics, not realtime single order CRUD. R123/126 budget caps at 70/2h.
- <https://getcourse.io/blog/1148810> — use an actual GetCourse **“Read only”** API key, not a default full-power key. Verify the real GetCourse account name and custom-domain mapping before any live request.
- Do **not** treat \`payment_status=accepted\`, a thank-you page, a client-side checkbox guard, a GetCourse callback hint, or a signed observer *claim alone* as fiscal receipt and actual grants proof.

### Secure deploy / single reviewed local checkout adapter

Only after the site engineer's current-version/CAS check on the **existing branch** (no new PR):

\`\`\`bash
git fetch origin bf2026-r109-site-boundary-qa-r1-20261119
git restore --source=FETCH_HEAD -- \
  bf2026-checkout/site-boundary-qa-r1/r126-provider-verification.cjs \
  bf2026-checkout/site-boundary-qa-r1/r126-provider-verification-http.cjs \
  bf2026-checkout/site-boundary-qa-r1/r126-signed-native-observer.cjs \
  bf2026-checkout/site-boundary-qa-r1/r126-approved-observer-loader.cjs \
  bf2026-checkout/site-boundary-qa-r1/patch-r126-stage-provider.py \
  bf2026-checkout/site-boundary-qa-r1/r126-provider-verify.env.example
\`\`\`

Stage **only**, preserve the real site/Caddy/Docker. Ensure R123 Export, its Postgres budget/one-shot ledger and R124 exact single-form gate already exist. Apply the R126 patch only to a fresh authorized isolated stage (never to \`/srv/factory-scratch/bf2026-checkout-r2-20261119/server.js\`); the script enforces this at runtime. Keep all R126 flags **0** while testing private QA status/route lookups. Stage secrets belong only in the owner-private \`private-credentials\` directory, \`0600\` owner files, no symlinks or published env values. Never send actual key to GitHub/chat.

When the user later **privately** provisions the genuine read-only key, set only the absolute secret **file path** in \`BF2026_GETCOURSE_SECRET_FILE\`; first validate its host/account name against real GetCourse account settings. To initiate one actual **GET-only** Export readback of **existing** Order71994, the site owner must separately enable \`BF2026_R126_PROVIDER_VERIFY_ENABLED=1\` for *private staging QA* and POST a new idempotency key with **no body**. If a real Export payload lacks account/QA-user/Offer/Product/Training fields, the strict legacy R123 driver must remain PARTIAL/HOLD — do NOT fill missing values with guesses or authorize payments.

No approved independent receipt + grant observer is presently connected. To add one, the owner must audit \`observer-transport-approved.cjs\` (read-only), provision its Ed25519 keypair privately, configure the public key file path, and separately enable \`BF2026_R126_NATIVE_OBSERVER_ENABLED=1\`. That transport must return nonce-bound signed origin, receipt and individual grants readbacks. The R126 verifier will still output \`public_release_allowed:false\` until separate real provider-side no-consent negative test, actual paid/receipt/access/Zoom evidence and owner-approved release are independently established. **No production activation is authorized by R126.**
