-- BF2026 R112 site/native-order integration extension.
-- Apply only in the isolated site DB after site-owner approval; NOT DEPLOYED.
BEGIN;

ALTER TABLE bf2026_native_checkout_idempotency
  ADD COLUMN IF NOT EXISTS trusted_order_payload_sha256 char(64),
  ADD COLUMN IF NOT EXISTS paid_event_id text,
  ADD COLUMN IF NOT EXISTS paid_readback_sha256 char(64),
  ADD COLUMN IF NOT EXISTS paid_evidence_ref text,
  ADD COLUMN IF NOT EXISTS paid_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS bf2026_native_checkout_paid_events (
  scope text NOT NULL DEFAULT 'BF2026',
  provider_order_id text NOT NULL,
  paid_event_id text NOT NULL,
  checkout_idempotency_key char(32) NOT NULL,
  paid_total_rub integer NOT NULL CHECK (paid_total_rub = 11690),
  paid_readback_sha256 char(64) NOT NULL,
  evidence_ref text NOT NULL,
  state text NOT NULL CHECK (state IN ('VERIFIED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_order_id, paid_event_id),
  UNIQUE (paid_event_id),
  FOREIGN KEY (scope, checkout_idempotency_key)
    REFERENCES bf2026_native_checkout_idempotency(scope, checkout_idempotency_key)
);

CREATE INDEX IF NOT EXISTS bf2026_native_paid_event_checkout_idx
  ON bf2026_native_checkout_paid_events(scope, checkout_idempotency_key);

COMMENT ON TABLE bf2026_native_checkout_paid_events IS
  'Exactly-once ledger for signed native GetCourse paid-event readbacks. This records verified native grants; it does not issue grants.';

COMMIT;
