# BF2026 R121 — native bundle signed readback + real staging QA

## Scope and exact identity
Backend only, existing Draft PR #17. Native GetCourse **one Offer 8935004**, Widget **1686790**, Order **71994**, Deal **924624456**, order line **942536770**. Exactly **11,690 RUB**, two Product→Training grants: 4557988→936022301 and 4550895→933861292; both **365 days AFTER_PAY**. Existing unrelated Offers 8933492 and 8919715 unchanged. No 265 quote-vector audit.

## Code delivered
- `r121-bundle-verify.cjs`: R115 authenticated relay inbox event (PAID is merely a hint) → server-owned `reader.readNativeOrder({deal_id:'924624456',order_number:'71994'})` → original unpaid order, exact single native bundle Offer/line/price/config → captured one paid event + receipt/tax + consent + two distinct native grants → separate Ed25519 independent QA attestation with pinned reviewer key, artifact SHA and 10-minute freshness → durable PG dedupe. Strict expected amount **11690**, not **12990**.
- `r121-bundle-ledger.sql`: additive staging table `bf2026_native_bundle_verification`; event ID primary key and globally unique paid event ID; only SHA hashes and identifiers, no buyer PII. No external grant writes. Exact replay returns duplicate; conflicting replay or paid event rejects.
- `r121-bundle-qa-http.cjs` and `patch-r121-stage.py`: private QA route `/api/checkout/_qa/native-bundle-readback/{status,reconcile}`, same site QA authorization. Request to reconcile accepts **only** relay `event_id`, never caller-supplied paid/order artifacts. Unconfigured reader returns 503; unauthenticated returns 404. Patch refuses paths outside the isolated R118 staging directory.
- `r121-bundle-stage.integration.test.cjs`: actual HTTP listener + PostgreSQL 16 `bfstage` tests, synthetic TEST_ONLY signed readback. Deliberately `payment_verified:false`, `release_allowed:false`, `grant_writes:0` for fixture tests, even if a fixture presents paid fields.

## Real staging observed
Host services: PostgreSQL `127.0.0.1:55439` / database `bfstage`; staged HTTP `127.0.0.1:18765`. Successfully applied new R121 SQL. **7/7 tests PASS** in Node 20, real PostgreSQL and HTTP, covering correct single Offer+two products, immutable replay, wrong 12,990 amount, wrong order/line, missing second grant, invalid receipt, consent, malformed paid event, forged attestation, ambiguous timeout, unrelated deal event, non-paid event and duplicate paid-event rejection. Test rows cleaned: **0** R121 ledger rows after the suite.

Exact command:
```sh
cd /srv/factory-scratch/bf2026-r118-relay-stage-20261119
BF2026_STAGE_ONLY=1 BF2026_STAGE_PG_POOL_MODULE=$PWD/stage-pool-module.cjs node --test site-boundary-qa-r1/r121-bundle-stage.integration.test.cjs
```

Isolated `server.js` copy has R121 QA route patch and passes `node --check`. Spawned a separate one-shot site-server candidate on `127.0.0.1:18766` using existing stage environment: unauthenticated GET returns 404; authorized GET returns **503 provider_reader_configured=false**, both as designed. **Existing process on 18765 was NOT restarted or replaced**; remains the R120/R115 live staging process. No staging keys/logs were copied into GitHub. Its R121 route is present on disk but not yet active in that running process. A stage restart attempt was stopped by tool safety checks; no bypass attempted.

## Hard release gate
GetCourse native #71994 remains **UNPAID**, no authenticated paid, receipt, consent-negative-test or two issued grant readbacks. The provider API callback cryptographic signature is **NOT DOCUMENTED**: R115 HMAC authenticates only our internal relay; Ed25519 attests independent QA readback, not GetCourse. Real `readNativeOrder` credentials/loader and pinned live independent reviewer key are not configured; production checkout and public sale routes remain **HOLD**, no payment, receipts, grant or mailing actions. Synthetic tests are explicitly TEST_ONLY and cannot establish paid E2E.

Next engineer: obtain the already-requested sanitized provider evidence bundle from #4112 comment 6998399122; implement/read-back a real authenticated GetCourse-native order/receipt/grants loader behind this server interface; independently sign real artifacts with configured reviewer key; run one authorized paid QA E2E without creating a duplicate order. Keep `allowLive=false` until trusted loader, key, QA and owner release. Never assert `sales_ready` from a webhook hint alone.
