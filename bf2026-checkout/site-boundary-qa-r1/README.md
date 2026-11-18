# BF2026 live R109 to adapter boundary QA (isolated)

This branch adds a read-only live boundary test, not a GetCourse integration or production release.

## Exact run

    BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js \
    BF_R109_PRICING=/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json \
    node --test site-boundary-qa/site-boundary.test.cjs

To create the sanitized evidence snapshot from real HTTPS requests:

    BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js \
    BF_R109_PRICING=/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json \
    node site-boundary-qa/run-live-boundary.cjs

The harness sends actual POST requests to /api/checkout/quote and /api/checkout/start, plus GET /api/checkout/status, on https://wf.tati-lar.ru. It compares each live site quote to the exact deployed R109 compute() and then builds the adapter plan. It also verifies that client price injection and an invalid three-audio selection are rejected.

## Fresh native Lot5 mapping overlay

native-mapping-live-overlay.json applies only the newer Lot5 native readback in #4073 comment 6988661595 (Offer 8933492 to Product 4557988 to Training 936022301, 6990 RUB, active/public, 365 days after payment). It does not edit the PR15 historical mapping snapshot. Union stays at its last evidenced INACTIVE_QA_ONLY state from #4073 comment 6988302858.

## Boundaries

- No GetCourse UI, lock, API, order or customer record is touched.
- No real or test payment is attempted.
- No native order is synthesized or asserted.
- The harness never mutates offer-registry.json; public /start must remain 503 while no native per-selection form binding exists.
- ready_for_native_binding is only a mapping/planning property. It is not a verified checkout route and cannot make /start live.
- The 3,333 vs 3,000 RUB audio discrepancy is reported as a blocker, never resolved in code.

