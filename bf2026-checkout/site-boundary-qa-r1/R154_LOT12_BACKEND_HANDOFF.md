# BF2026 R154 · Visible Lot 12 «Собери свой сет» · Backend handoff

**Scope:** existing lenar2/luch PR #17, atop R145 HEAD 9af893eeca6885d38f5b9f6a84c5577c75b68a15. Backend ONLY. Original R107 checkout, site and GetCourse UI unchanged. R145 first-24h gift outbox untouched.

## R153 production agreement and real native IDs

- Public site calculator: https://wf.tati-lar.ru/?v=r153#lot-12; visible Lot 12, legacy selector \`data-lot=10\`.
- Price/version \`BF2026_LOT12_CUSTOM_SET_R153\`. Eleven choices; 2–7 distinct items; extra discounts 2=10%, 3=15%, 4=25%, 5=35%, 6=40%, 7=45%; BF standalone prices are input; **one nearest-10 RUB rounding at FINAL total only**. Audio max 2; program «Исцеление отвержения» excludes individual audios. Source I/II variant unchanged. Zero unapproved extra coupons.
- DGS2 \`dgs2\`: Offer **8937776**, Product **4550902**, Training **549791334**, standalone BF **7,000 ₽**, 365d AFTER_PAY; Widget 1687317, Form 2263523651.
- Knopochka \`knopochka\`: Offer **8937784**, Product **4550899**, Training **316213861**, standalone BF **5,990 ₽**, 365d AFTER_PAY; Widget 1687346, Form 2263526444.
- Native Offer IDs read back by GC UI engineer, #4112 comment 7012233764; historical site JSON \`provider_offer_unverified:true\` is stale. This **does not prove native seven-offer checkout**.
- Nine prior catalog entries use pinned \`r123-single-widget-adapter.cjs\` / \`r130-set-lines.cjs\`; Trainer is full Training **935051957**. Source II Offer 8934987 has two Product/Training entitlement pairs.

## Actual delivered code

- \`r154-lot12-set.cjs\`: trusted server catalog, exact selection constraints, 2–7 quotes, deterministic per-line RUB allocations, positive Offer/Training IDs, 365d product grants and stable server plan SHA-256. The browser's total/offer IDs are ignored.
- \`r154-lot12-http.cjs\`: unmapped isolated \`/api/checkout/lot12/{status,plan,start}\` handler; actual local HTTP. POST \`plan\` returns one Deal's exact positions + server quote. POST \`start\` is **503 by default** and cannot return an arbitrary payment link. Explicit \`allowStart\` + production coordinator readiness + one exact *native verified unpaid* buyer/Deal/amount/consent + real GetCourse \`payment_link\` required before 200.
- \`r154-lot12-coordinator.cjs\`: opt-in R130 durable PG and R136/R135 native-readback coordinator. Additional exact realtime multi-Offer owner approval + one native Deal + 365d grant capability + independent payment-link proof required. GetCourse Import API success/901 is **not** that proof. No provider traffic by default.
- \`r154-lot12-orders.sql\`: separate R154 staging ledger/step tables for 2–7 and R153 pricing_version (including per-nonce uniqueness and send-uncertain states); it **does not alter R130 tables**. Real isolated PG stage migration applied during test; NOT deployed on production.
- \`r130-set-order-worker.cjs\`, \`r136-lot10-order-coordinator.cjs\`: backward-compatible optional \`planBuilder\` injection; defaults are original R107 path. R154 uses its own table-name adapter for the R130 code's prepared SQL.
- \`r130-getcourse-import.cjs\`: R154-only \`maxItems:7\` opt-in for 6/7 serialized Import steps; legacy default cap remains **5**.
- \`r154-lot12.test.cjs\`, \`r154-lot12-stage.integration.test.cjs\`: server arithmetic, GetCourse line/readback contracts, HTTP, provider HOLD, real isolated PostgreSQL idempotency/replay.

## Acceptance observations

| Count | Example BF subtotal | Extra discount | R154 final |
|---:|---:|---:|---:|
| 2 | 6,666 | 10% | 6,000 |
| 3 | 19,990 | 15% | 16,990 |
| 5 | 33,180 | 35% | 21,570 |
| 6 | 61,180 | 40% | 36,710 |
| 7, Source I | 67,180 | 45% | 36,950 |
| 7, Source II | 71,180 | 45% | **39,150** |

Seven-item maximum savings: **32,030 ₽** beyond BF standalone prices. Source II → two trainings. One provider Offer ID per line; all discounts sum exactly to one final total. Local positive native order fixtures are **synthetic contract checks**, NOT an actual GetCourse order/payment/receipt.

## Exact repeatable tests (on isolated source checkout)

\`\`\`bash
cd bf2026-checkout/site-boundary-qa-r1
node --test r154-lot12.test.cjs r130-set-lines.test.cjs \
 r130-set-order-worker.integration.test.cjs r136-lot10-order-coordinator.test.cjs \
 r135-set-payment-link.test.cjs r137-lot10-public-router.test.cjs

# Only on isolated bfstage 127.0.0.1:55439 (never production)
BF2026_STAGE_ONLY=1 \
BF2026_STAGE_PG_POOL_MODULE=/srv/factory-scratch/bf2026-r118-relay-stage-20261119/stage-pool-module.cjs \
node --test r154-lot12-stage.integration.test.cjs
\`\`\`

## Release gate / exact SITE+GC handoff

1. Leave current native individual CTAs and public R153 layout untouched. SITE engineer should arrange scoped, owner-approved bridge from the **visible Lot 12 / legacy selector 10** to R154 POST \`/api/checkout/lot12/plan\` and later \`/start\`, passing only selections; do not trust client subtotal. **This bridge is not deployed by backend.**
2. Do not configure \`allowStart:true\` or \`allowProviderWrites:true\` until owner-authorized GetCourse native real-time multiple-Offer creation (Import API alone is insufficient) is shown by an *actual* unpaid Deal readback with all 2–7 exact Offer line prices and one total, buyer identity, mandatory consent, 365d AFTER_PAY Product→Training mappings and real trusted \`payment_link\`. Never silently use an older key after HTTP901.
3. Wire actual independent \`preflight()\`, \`nativeOrderReadback()\`, \`nativeConsentReadback()\`, trusted transport, stage then production migration; default flags OFF. Reuse R130 idempotency keys, one-time nonces, abort-on-unknown-send and readback validation. Never publish from import ACK or create fabricated paid/grant evidence.
4. For paid E2E, verify fiscal receipt, same paid event and **all selected** 365d grants before success claims. Gift Training 936028240 remains separate R145 first-24h PAID-only mechanism, never a priced set item.
5. Production remains \`checkout_url:null\`, \`public_release_allowed:false\`, \`sales_ready:false\` for this new path; no order/payment/access was created by R154. Site and GC UI require separate owner-managed evidence and release.

**Blocker:** no independently verified live operational native 6-/7-Offer order plus GetCourse payment link. **Work delivered despite blocker:** exact server quote, durable plans, seven-line import payload schema, isolated SQL, HTTP bridge contract and focused real-PG tests.
