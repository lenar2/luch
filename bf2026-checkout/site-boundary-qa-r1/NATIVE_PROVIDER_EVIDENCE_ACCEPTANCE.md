# BF2026 native provider evidence intake — acceptance contract

## Purpose

This contract separates a structurally valid fixture from a live GetCourse capture attested by a trusted site-engineer key. A passing fixture test is never a native provider order and never unlocks the production capability gate.

## Required evidence bundle

Schema: `bf2026.getcourse.provider-evidence.v1`; provider: `GetCourse`.

- `capture_type`: `LIVE_PROVIDER_CAPTURE` for real evidence, or `TEST_FIXTURE` for tests only.
- `captured_at` and `attested_by`.
- One native public widget URL, widget ID, native form action ID and form method.
- Selection field `formParams[offer_id][]` with both exact Offer IDs simultaneously selectable in the same form. Supported encodings are checked checkboxes or a multiple select. A radio input, two separate forms, or two separate action IDs do not qualify.
- Exact native action URL `https://study.shkola-dnv.com/pl/lite/block-public/process?id=<action_id>`.
- Native order readback tied to that form action and widget ID.
- SHA-256 digests and immutable references for the HTML and order JSON artifacts.
- Ed25519 signature over the canonical manifest without the signature field.

Dynamic visitor/session query parameters must not be copied into Git. The verifier compares the stable native action ID and omits visitor/session values from its normalized result. Order artifacts must omit buyer PII.

## Native unpaid order reconciliation

The order artifact must report `source=GETCOURSE_NATIVE_ORDER_DETAIL`, a real provider order ID, `status=UNPAID`, currency RUB and exactly two lines:

| Offer | Product | Training | Unit price |
|---:|---:|---:|---:|
| 8933492 | 4557988 | 936022301 | 6,990 ₽ |
| 8919715 | 4550895 | 933861292 | 6,000 ₽ |

Required totals: subtotal 12,990 ₽; discount 10%, 1,300 ₽ (R109 final-total rounding); amount due **11,690 ₽**. No access grants may exist while status is UNPAID.

The order must carry the same `source_form_action_id` and `source_form_widget_id` as the signed native form capture.

## Paid grant readback

For a PAID readback, the same two order lines and 11,690 ₽ paid total are required. Both grants must map to the exact matching Offer/Product/Training; grant 365 days starting `AFTER_PAY`; reference the same provider order ID and paid-event ID; include receipt/tax evidence, offer-terms consent and a passed duplicate-submit negative test.

## Trust configuration

The production verifier must receive a server-managed trusted key map, not a key supplied by the request:

`{ [key_id]: { publicKey: <pinned Ed25519 public key>, trust_level: "SITE_ENGINEER_ATTESTED", usage: "BF2026_GETCOURSE_PROVIDER_EVIDENCE" } }`

The private key must remain outside Git and chat. The current branch contains no trusted production key. A `TEST_ONLY` key validates test-fixture structure only; its result has `provider_verified=false` and is rejected by `assertLiveProviderEvidence` and `assertNativeMultiOfferCapability`.

The verifier's result is deeply immutable and tracked as an in-process verified object. Reconstructing the result from client JSON does not preserve verification.

## Exact acceptance command

```sh
cd /srv/factory-scratch/bf2026-dynamic-checkout-worker2-r1-20261119
NODE_ENV=test \
BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js \
BF_R109_PRICING=/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json \
node --test \
  bf2026-checkout/site-boundary-qa-r1/site-boundary.test.cjs \
  bf2026-checkout/site-boundary-qa-r1/native-order-boundary-contract.test.cjs \
  bf2026-checkout/site-boundary-qa-r1/widget-1686693-inspection.test.cjs \
  bf2026-checkout/site-boundary-qa-r1/native-order-execution-contract.test.cjs \
  bf2026-checkout/site-boundary-qa-r1/native-provider-evidence.contract.test.cjs
```

`executeProviderSubmissionAfterReservation` is exported only when `NODE_ENV=test`; production callers can reach it only through the capability-gated `submitSignedSelection` path.

## Current truth

- Current real public widgets remain two distinct one-offer forms (1686693/action 2263265127 and 1686738/action 2263282483). They fail this contract by design.
- No live two-offer native form or actual native unpaid two-line order has been supplied.
- Tests use an ephemeral Ed25519 TEST_ONLY key and explicitly synthetic fixture data. They test parsing, signature checks, reconciliation rules and state-machine safety only.
- No production evidence key is configured, no provider driver exists, no database migration is deployed, and no native order/payment/access grant was created.
