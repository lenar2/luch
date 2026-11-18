# BF2026 R3.15 · R10.7 quote-only backend reference

**State: SALES HOLD**. This is a reference validator, not an active checkout, and it has no payment, GetCourse API, order, entitlement, mail or live site integration.

- Contract source: https://wf.tati-lar.ru/assets/lot10-set/assets/set-pricing-r107.json
- Owner-approved Lot5 base price: **6,990 RUB**; separate-audio limit: **2**; individual audio program overlap: forbidden; 265 supported Lot10 combinations; 365-day access starts **after confirmed payment**.
- `quote.py` recomputes prices from a server-held snapshot rather than client-submitted totals; validates Source I/II tariff, 2–5 unique items, audio caps, mutual exclusion and a single 10-RUB rounding.
- `test_quote.py`: 4 tests passed on LUCH server 18 Nov 2026, including all 265 allowed combinations and hostile/invalid cart cases.
- All price results are `QUOTE_ONLY_SALES_HOLD`. The `create_order` entry point **always raises**; it is not an order adapter.
- Native Product `4557988` maps to Training `936022301`, but no authorized native paid Offer exists for Lot5. Do not infer that new individual-audio Products, after-payment grants, checkout URLs or email triggers exist.
- Before enabling a future integration: verified restricted GetCourse Offers, non-eligible outsider denial, one-to-one offer/product/training grants, 365-day after-payment and refund behavior, server idempotency, quote-to-order reconciliation, explicit shipping of paid-only order outcomes, post-payment confirmation, safe thank-you mapping, email consent/suppression, independent QA and explicit owner authorization.
- Unpublished thank-you page IDs: 4834089 (audio), 4834095 (programs). Existing template IDs 23731340 and 23703690 are not proven ready for sending. Do not activate them.

**No changes to** the published `wf.tati-lar.ru` build, payment feature flag, existing students, production GetCourse Offers, legacy grants or emails.
