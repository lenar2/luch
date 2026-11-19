# BF2026 R141 — existing BF API key verified; durable branded R137 checkout module

Date: 2026-11-19. Owner: "Для тебя нужен отдельный апи или тот что я уже сделал для белой пятницы подойдет? Если подойдет бери на сервере и делай."

## Real authenticated GetCourse readback — not a simulation

The existing owner-created API credential is already present at

    /srv/factory-scratch/bf2026-checkout-r2-20261119/secrets/getcourse_import.key

Native server filesystem readback: regular file owned by lenar, mode 0600,
size 128; parent secrets directory mode 0700, owned by lenar.

The actual GetCourse authenticated READ-ONLY API accepted this key:

    POST https://study.shkola-dnv.com/pl/api/account/fields
    action=get

Provider returned HTTPS 200, JSON success=true and 59 field records.
Exact native ORDER fields independently identified:

    23331550   BF2026 Consent Nonce          string   context_type=deal
    23331559   BF2026 Offer Revision SHA256  string   context_type=deal

Both share GetCourse form_id 701330. Both have required=0 (the fields are
not inherently required by the native field registry). Provider TLS hostname
was verified; the second read-only check used a DNS-resolved GetCourse IP
only as a one-time diagnostic because ordinary DNS was transiently failing.
No API key was printed or published; no GetCourse Import request was sent.

**This verifies the EXISTING KEY for authenticated account field reads,
not the GetCourse ability to create orders through Import Deals in realtime.**
It does not verify the native order-level callback Process ID, automatic
population of both fields in an actual order, required legal consent, one
unpaid order with matching native lines/total, payment URL or grants.

## Code delivered, no public checkout activation

Added these files under the existing PR #17:
- r141-server-key.cjs — secure backend-only reader of the existing key from
  the same server directory, no secret logging; optional read-only native
  field catalog verification, defaults fail-closed on network/error.
- r141-server-key.test.cjs — 4/4 PASS.
- r141-contact-durable.cjs — optional drop-in durable idempotency coordinator
  for the existing R137 first-party **single fixed Offer** contact checkout,
  with injected R137 price/validation rules and separate trusted provider
  transport, preflight, and native order readback. Public network defaults
  OFF. fsyncs a private one-use request claim BEFORE each provider write;
  UNKNOWN outcomes or interrupted requests NEVER auto-retry. Multiple
  concurrent requests create at most one sender attempt. Restart replay
  returns an encrypted-at-rest native payment URL only when the matching
  exact unpaid native order+consent had already been verified.
- r141-contact-durable.test.cjs — 10/10 PASS on actual host filesystem,
  10/10 PASS with actual R137 validation/price helpers injected, and
  10/10 with portable test-only adapters. Mock provider responses are NOT
  native GetCourse proof; no real buyer/order/payment created.
- this handoff.

**Important scope separation:** this R141 adapter only hardens R137 contact
checkout for one existing Offer. It explicitly rejects Lot10, Lot11 and
removed Lot12. Lot10 variable 2–5-product orders remain the independent
R130/R135/R136/R137 Lot10 backend in the SAME PR #17 with its own PostgreSQL
idempotency, unique consent nonce and same-deal multi-offer order contract.
DO NOT use a fixed bundle or single-offer R141 adapter for Lot10.

Server-side predeployment files were installed additively, permissions 0600:

    /srv/factory-scratch/bf2026-checkout-r2-20261119/r141-server-key.cjs
    /srv/factory-scratch/bf2026-checkout-r2-20261119/r141-contact-durable.cjs

The live R2 server.js, R137 original module, site HTML/JS/CSS, native GetCourse
Offer/Widget/Training and existing production buttons were NOT changed;
service was NOT restarted. New code is available but **not wired to the live
/api/checkout/contact/start route** until the operational provider preflight
passes. This is deliberate; do not call the prepared module a live checkout.

Reproduce local checks:

    node --test r141-contact-durable.test.cjs r141-server-key.test.cjs
    BF2026_R137_SOURCE_FILE=/srv/factory-scratch/bf2026-checkout-r2-20261119/r137-contact-order.cjs node --test r141-contact-durable.test.cjs

Live HTTPS status after installation:

    GET /api/checkout/contact/status => ready:false
    POST /api/checkout/contact/start => 503 GETCOURSE_API_NOT_CONFIGURED

## Release blocker — exact next authorized work

A valid GetCourse API key does not by itself establish Import Deals is an
operational checkout API. GetCourse docs explicitly describe Import Deals
as data import, not real-time operational object management:
https://getcourse.ru/help/api

To enable actual unpaid order creation, the sole authorized GetCourse UI
worker must confirm native Order Process ID/callback and buyer legal consent
enforcement; provide an owner-controlled QA buyer with explicit checked
consent; verify account limits/notifications; authorize one unpaid QA
2-Offer order; read it back with ONE deal ID, correct Offer IDs and exact
discounted total, plus authentic https payment_link. Never fabricate buyer
identity or native provider response. Existing import key may be reused
after those checks; no second secret key is technically required merely
because this is Lot10. Do NOT re-audit 265 sets.

**State: existing key FOUND, authenticated GetCourse read-only field API PASS,
R141 restart-safe backend modules installed/stage-tested, public writes HOLD.**
