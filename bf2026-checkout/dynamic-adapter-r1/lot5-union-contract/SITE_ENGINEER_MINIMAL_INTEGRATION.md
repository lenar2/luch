# Minimal site-engineer integration — BF2026 R109 / Lot5 + Union

**Scope:** backend-only, isolated site-engineer branch. Do not edit the approved WF HTML/CSS/hero/photos/copy or production registry. Do not use the GetCourse UI or acquire/change its lock from this branch.

## Delivery / ACK status

The prior PeerBus handoff \`msg_7c1db357-d091-44e2-aa3b-623a6dc46713\` remains \`PENDING\`; the site-engineer peer inbox had no response, and #4112 had no engineer-authored ACK at last check. This branch is a single follow-up handoff, not permission to publish.

## What the current provider evidence actually permits

- Lot5 Offer \`8933492\` → Product \`4557988\` → Training \`936022301\`, 6,990 ₽, 365 days after payment, active/all-users. Source: #4073 comment \`6988661595\`.
- Existing Widget \`1686693\` is explicitly bound to **Lot5 only**. Its admin editor URL is not a buyer URL; its unauthenticated \`/pl/lite/widget/show\` returned 403. The public script is HTTP 200, which only proves the script is fetchable, not that a buyer order succeeds.
- Union Offer \`8919715\` → Product \`4550895\` → Training \`933861292\`, 6,000 ₽, was last evidenced **INACTIVE_QA_ONLY** in #4073 comment \`6988302858\`. No newer public/active proof found. Therefore a real Lot5+Union order cannot currently be requested safely. Do not reactivate Union from backend code.
- R109 server-side quote is independently reproducible: subtotal 12,990 ₽, 10%, savings 1,300 ₽, final total **11,690 ₽** (nearest 10 ₽ after computing the full order). Exact R109 catalog SHA256 \`c20dd54301ab2bdfe4c2944abda0a7b51ec821f885465bbf17c7eb71b2277135\`; quote SHA256 \`9489fedcb65b9181707e23176ca315b1e2f9a84b3ce36662ab389b11a5afa021\`.
- Separate pricing HOLD: audio singles are 3,333 ₽ in deployed R109 vs 3,000 ₽ in older #4073 map. Do not adjust either value without owner approval.

## Minimum integration steps (do these in the site-engineer's isolated branch)

1. Add the contract validator \`reconcile-lot5-union.cjs\` to the R109 backend package. Import it only in the backend QA/reconciliation layer; do not make it a public payment endpoint.
2. Keep the existing \`POST /api/checkout/quote\` as sole pricing authority. Verify at runtime that \`compute({kind:'set',items:['rejection_program','union']})\` returns the exact expected quote digest/fields in \`native-order-lot5-union.expected.json\`. Never accept client totals/discount/Offer IDs.
3. Build a provider normalizer **only after** an authorized native GetCourse order readback reveals actual provider field names. Normalize to \`bf2026.getcourse.native-order.readback.v1\` as specified by \`native-order-lot5-union.schema.json\`; retain redacted native order/payment/grant/receipt/consent readback refs. Do not guess undocumented API fields or query parameters.
4. Require a distinct native multi-offer form/widget that conveys both Offer IDs \`8933492\` and \`8919715\`, selected items and 11,690 ₽. Do not reuse Lot5-only Widget \`1686693\` as proof of a two-line order. The form must be publicly accessible to an outsider and carry mandatory offer terms consent.
5. After Union is independently made public/active by the authorized UI worker, run a controlled native test under owner-approved test conditions. Obtain an actual native order with exactly two lines and paid total 11,690 ₽; capture a confirmed paid event; verify both Training grants are ACTIVE for 365 days from that payment; obtain fiscal receipt and tax treatment evidence; perform repeated-submit negative test showing no second order.
6. Run \`reconcileLot5Union(redactedNativeReadback)\`. It returns only \`STRUCTURAL_MATCH_ONLY_HUMAN_SOURCE_ATTESTATION_REQUIRED\`; an independent reviewer must check every referenced native artifact. Only after that may site engineer add an exact \`checkout_forms['set:rejection_program|union']\` entry in their own branch and run real end-to-end QA. Keep production \`rollout_enabled:false\` until owner release and all evidence gates pass.
7. Keep the design byte-identical. This is a backend-only integration.

## Test

\`\`\`sh
node --test reconcile-lot5-union.test.cjs
\`\`\`

The unit tests deliberately use \`UNIT_TEST_*\` fixtures. They prove only that the validator rejects bad evidence; **they are not a native GetCourse order, paid transaction, receipt, entitlement or commercial PASS**.


## Live R109 pricing provenance check (not a provider order test)

Run the source-bound check against the current read-only R109 files:

\`\`\`sh
BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js \
BF_R109_PRICING=/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json \
node --test reconcile-lot5-union.test.cjs reconcile-lot5-union.r109.test.cjs
\`\`\`

This independently binds the acceptance contract to the exact current server catalog bytes and its own \`compute()\` output. It still does not create or claim a GetCourse order.

