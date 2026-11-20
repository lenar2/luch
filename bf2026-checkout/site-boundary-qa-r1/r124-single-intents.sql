-- BF2026 R124: idempotent QA single-form intent contract.
-- Staging only; it is NOT an order, payment, receipt, or user grant ledger.
BEGIN;
CREATE TABLE IF NOT EXISTS bf2026_single_checkout_qa_intents (
 request_key text PRIMARY KEY CHECK (request_key ~ '^[a-f0-9]{32,64}$'),
 payload_sha256 char(64) NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
 route_key text NOT NULL CHECK (route_key IN (
 'single:rejection','single:devaluation','single:self','single:guilt',
 'single:rejection_program','single:dnv','single:union',
 'single:source:1','single:source:2','single:personal_zoom')),
 widget_id bigint NOT NULL CHECK(widget_id>0),
 offer_id bigint NOT NULL CHECK(offer_id>0),
 quote_rub integer NOT NULL CHECK(quote_rub>0),
 product_count smallint NOT NULL CHECK(product_count IN(1,2)),
 consent_input_checked boolean NOT NULL CHECK(consent_input_checked=true),
 marketing_input_unchecked boolean NOT NULL CHECK(marketing_input_unchecked=true),
 state text NOT NULL DEFAULT 'HOLD_PROVIDER_CONSENT_RECEIPT_AND_ENTITLEMENTS'
   CHECK(state='HOLD_PROVIDER_CONSENT_RECEIPT_AND_ENTITLEMENTS'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bf2026_single_qa_route_idx
 ON bf2026_single_checkout_qa_intents(route_key,created_at);
COMMENT ON TABLE bf2026_single_checkout_qa_intents IS
 'Stage-only QA consent-input and quote identity: not provider consent proof, not paid order, not fiscal receipt or granted entitlement. Never public release.';
COMMIT;
