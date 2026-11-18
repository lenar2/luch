# BF2026 Dynamic Checkout Intent Adapter R1 — isolated, not deployed

This package is an **executable, fail-closed draft** for the R109 site engineer, not a working GetCourse gateway. It has **no browser operations, no payment credentials, no production registry mutation, and no public checkout routes**. No 265 separate GetCourse Offers are created.

## Purpose and trust boundary

* Import the **live R109 server-side \`compute(selection)\`** as \`quoteFn\`. Prices, percentage discounts (2/3/4/5 positions = 10/15/25/35%), final-order nearest-10 ₽, source 1/2, excluded combinations are decided exclusively by R109. Client totals, IDs, and discounts are never trusted.
* \`plan(input)\` creates a canonical, auditable buyer-selection intent: exact ordered line provenance, R107 catalog digest, native Offer/Product/Training mapping, **after confirmed payment only**, 365-day grant obligations, and explicit missing-evidence blockers. Plans remain blocked with the current observed mapping.
* \`seal(input,{secret,...})\` creates a short-lived HMAC-SHA256 token **only after every native mapping is independently verified**. Tokens have server-generated nonce and expiry, no PII/card data. Not a GetCourse order or payment URL.
* \`verify\` checks MAC, time and recomputes the entire plan to detect catalog/mapping changes. \`resolve\` accepts only an exact per-selection provider binding with verified URL, exact total, line-binding digest, eight distinct release proofs including provider-specific cart-selection transfer, paid access, receipt, consent, duplicate protection and explicit owner approval.
* A reusable **single GetCourse multi-item form** can serve many selections only if the provider natively binds the exact selected Offer IDs, discounted amount, and correct paid entitlement on each order. Merely linking to one shared generic native form for 265 keys is UNSAFE and rejected by the contract. This adapter does not invent GetCourse API parameters. API \`/pl/api/deals\` import is not treated as runtime checkout.
* \`resolve\` consumes the token through an externally supplied **atomic durable idempotency store**. The developer must wire Redis/DB with atomic \`SETNX\`/unique constraint and verify GetCourse duplicate-order protection; an in-memory Set in tests is not production-safe.
* **No direct payment integration**, actual native form URLs, verified order creation, provider callback, paid access, tax treatment, or mailings are implemented here. Absent verified native transfer, all 265 checkout routes remain HOLD.

## Files

\`adapter.cjs\`: pure reference implementation. \`native-mapping-observed.json\`: only evidenced native IDs from canonical R3.19 + later persisted readbacks, all BLOCKED. \`pricing-r107.snapshot.json\`: unchanged exact copy of R109 production source. \`adapter.test.cjs\`: all 768 source-variant states, 265 allowed + 503 rejected; 265 synthetic full mapping/grant plans; signed HMAC, stale price/mapping/tamper/expiry, no live route, replay prevention.

## Running isolated tests (never deploy to public service)

\`\`\`sh
BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js node --test adapter.test.cjs
\`\`\`

Tests import R109 trusted \`compute\` directly from the existing **read-only** production source, and independently recalculate prices from the snapshot as an oracle. \`BF_R109_SERVER\` is only a path to the source module; tests do not start the web server, touch production registry or browser.

## Integration prerequisites for site engineer (#4112)

1. Validate current user-approved single audio price: the R109 snapshot uses **3,333 ₽ per audio** (2-audio discounted total 6,000 ₽); earlier #4073 summaries mention **3,000 ₽**. This conflict requires explicit owner-accepted site/native price alignment. **Do not silently change amounts**.
2. GetCourse native **Lot5 6,990 ₽** public form first, paid 365d grant, receipt/tax, consent, outsider, duplicate checks.
3. Prototype native multi-offer **Lot5 + Union** order; R109 exact total **11,690 ₽**. Verify selection encoded/received provider-side, exact order lines, correct two Training grants, no unpaid grant.
4. Define/verify an actual per-selection GetCourse cart binding: may be one shared form only if exact items/amount are securely supplied and proven. Do not use imaginary query parameters or 265 duplicated Offers. Exhaustively test 265/265 cases using \`adapter.plan\` against actual provider order fixture/proofs.
5. With signed provider evidence, fill native mapping and per-selection route bindings; only then integrate adapter into a new version of R109 in the site engineer's own exclusive branch. Deploy after independent QA and owner release. Until then \`offer-registry.json\` keeps \`rollout_enabled:false\`, \`checkout_forms:{}\`, and public API returns 503.

**Approval/design invariants:** original live \`wf.tati-lar.ru\` hero «до −80%», art, prices, and R109 code unchanged by this PR. Never claim commercial PASS from synthetic tests.


## Independent native order reconciliation extension

\`reconcile-native-order.cjs\` exports \`requireNativeMatch(plan, nativeEvidence)\` for structural verification of an **independently obtained** native GetCourse order: PAID event, quoted total, component Offer/Product/Training lines, exact 365-day-after-pay grants, fiscal receipt and legal-tax review, consent, and duplicate guard. It returns **STRUCTURAL_MATCH_ONLY_EXTERNAL_NATIVE_ATTESTATION_STILL_REQUIRED**, never production PASS. Provide native order, paid event, grant, receipt, consent, duplicate guard readback references; synthetic/untrusted inputs cannot count as independent external attestation. No PII needed.

Run \`reconcile-native-order.test.cjs\` beside \`adapter.test.cjs\`. It exercises all 265 combinations under clearly synthetic provider evidence, plus negative wrong-total/order/grant/receipt/consent/unpaid tests. A real provider test is blocked until an authorized GetCourse engineer supplies actual native provider readbacks and a verified form contract.



## Native checkout acceptance fixtures

See `PROVIDER_NATIVE_ACCEPTANCE.md` for exact native QA vectors and official GetCourse support boundaries. Run `export-265-vectors.cjs` with `BF_R109_SERVER` to regenerate all 265 machine-readable pricing/provenance vectors. Snapshot is `qa-265-vectors.json` and is NOT provider/payment certification.

