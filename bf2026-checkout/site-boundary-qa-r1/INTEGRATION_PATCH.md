# BF2026 R109 site-boundary QA patch — integration handoff

## Scope

This is a backend-only, read-only QA patch on top of PR #16. It does not modify R109, offer-registry.json, the public site design, GetCourse, or any production order/payment path.

## Branch ancestry

- PR #16 base commit: c7b3e5c860760f604a54df55a4ca157261f9d7dd
- QA branch: bf2026-r109-site-boundary-qa-r1-20261119
- QA files: bf2026-checkout/site-boundary-qa-r1/
- Site engineer should integrate this branch only into an isolated checkout integration branch that already contains PR #15 and PR #16 code.

## Minimal merge step for site engineer

After reviewing the branch, from the site engineer's isolated integration branch (not production):

    git fetch origin bf2026-r109-site-boundary-qa-r1-20261119
    git merge --no-ff FETCH_HEAD

Then execute the exact live boundary suite from the R109 host with read-only access:

    BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js \
    BF_R109_PRICING=/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json \
    node --test bf2026-checkout/site-boundary-qa-r1/site-boundary.test.cjs

This patch is test harness + evidence only. Do not merge to production. Do not copy the Lot5 mapping overlay into production registry. Do not enable rollout or create checkout_forms entries based on quote parity.

## Observed live boundary result

- Live R109 quote endpoint matched adapter output for Lot5, Lot5 + Union, two audios and Source II.
- Lot5 + Union exact quote: subtotal 12,990 ₽, 10%, final 11,690 ₽.
- Live R109 audio price: 3,333 ₽ each; this does not resolve the older 3,000 ₽ owner-price conflict.
- Lot5 native mapping can be planned from fresh readback #4073 comment 6988661595, but R109 /start still returns 503 because the production registry has no verified route.
- Union remains blocked by last evidenced INACTIVE_QA_ONLY status (#4073 comment 6988302858).
- Client price override and three-audio invalid selection are rejected by live R109 with 422.

## What this patch proves / does not prove

It proves a read-only adapter-to-site quote boundary using actual HTTPS responses from wf.tati-lar.ru and the exact R109 compute() source. It does not prove GetCourse provider selection transfer, a native order, payment, fiscal receipt, or paid entitlement. No provider order is synthesized or claimed.

## Remaining release gates

1. Authorized UI worker supplies current Union public Offer + multi-offer form readback.
2. Native provider order proves exact two lines and 11,690 ₽.
3. Both 365-day-after-pay grants, payment event, receipt/tax, mandatory consent and duplicate guard are independently read back.
4. Site engineer wires the exact provider selection transfer and durable idempotency in their own isolated branch.
5. Independent QA and owner release precede any production registry change.
