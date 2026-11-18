# BF2026 live R109 to adapter boundary QA (isolated)

This branch adds a read-only live boundary test, not a GetCourse integration or production release.

## Exact run

    BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js \
    BF_R109_PRICING=/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json \
    node --test bf2026-checkout/site-boundary-qa-r1/site-boundary.test.cjs

To create the sanitized evidence snapshot from real HTTPS requests:

    BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js \
    BF_R109_PRICING=/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json \
    node bf2026-checkout/site-boundary-qa-r1/run-live-boundary.cjs

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


## Exhaustive live quote boundary (265 HTTPS requests)

For the complete valid set space, run the optional rate-limited live pass:

    BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js \
    BF_R109_PRICING=/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json \
    node bf2026-checkout/site-boundary-qa-r1/run-live-265-boundary.cjs

It submits exactly 265 read-only POST quote requests to the live R109 site, one per second (below the server's 90/minute IP limit), and compares each real response with both the adapter and the R109 vector digest. It never calls /start, creates provider orders, or submits buyer data. The resulting live-boundary evidence file is an observation of the site quote boundary only, not a GetCourse/payment proof.


## Exhaustive live quote boundary (265 HTTPS requests)

For the complete valid set space, run the four rate-limited chunks below, then aggregate:

    node bf2026-checkout/site-boundary-qa-r1/run-live-265-boundary.cjs 0 80
    node bf2026-checkout/site-boundary-qa-r1/run-live-265-boundary.cjs 80 160
    node bf2026-checkout/site-boundary-qa-r1/run-live-265-boundary.cjs 160 240
    node bf2026-checkout/site-boundary-qa-r1/run-live-265-boundary.cjs 240 265
    node bf2026-checkout/site-boundary-qa-r1/aggregate-live-265.cjs

Each chunk sends actual read-only HTTPS POST quote requests to live R109, one per second (below the server's 90/minute IP limit), and compares each response with both the adapter and R109 vector digest. It never calls /start, creates provider orders, or submits buyer data. The final live-boundary evidence file is quote-boundary evidence only, not GetCourse/payment proof.


The 265 expected selections are self-contained in live-265-inputs.json; no generated QA vector file outside this PR is required.

## Read-only GetCourse Widget 1686693 transport findings

See PROVIDER_WIDGET_READONLY_FINDINGS.md. Public embed and iframe GETs both return HTTP 200. The embed forwards the parent query string, but the inspected form has one hidden external-value offer_id field with no value and no form-position-input controls. The inspected JavaScript populates that external field through an explicit modal position.offer_id object; it does not establish a URL-query selection contract. Mailing checkbox is enabled and prechecked in the returned iframe variables; review consent separately. No form was submitted.


The provider widget transport inspection is also repeatable without submitting the form:

    node --test bf2026-checkout/site-boundary-qa-r1/widget-1686693-inspection.test.cjs
    node bf2026-checkout/site-boundary-qa-r1/inspect-widget-1686693.cjs

It reads the public embed script and iframe HTML, emits sanitized structure only, and never stores visitor cookies or submits the form.

