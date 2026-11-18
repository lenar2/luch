-- BF2026 durable native-order idempotency contract.
-- Apply only in the site engineer's isolated database after owner approval.
-- This migration is NOT deployed by PR #17.
CREATE TABLE IF NOT EXISTS bf2026_native_checkout_idempotency (
  scope text NOT NULL DEFAULT 'BF2026',
  checkout_idempotency_key char(32) NOT NULL,
  selection_sha256 char(64) NOT NULL,
  state text NOT NULL CHECK (state IN (
    'RESERVED',
    'PROVIDER_SUBMITTING',
    'PROVIDER_OUTCOME_UNKNOWN',
    'ORDER_CREATED'
  )),
  lease_owner char(32),
  lease_expires_at timestamptz,
  provider_started_at timestamptz,
  provider_order_id text,
  order_readback_sha256 char(64),
  evidence_ref text,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, checkout_idempotency_key),
  CHECK ((state <> 'ORDER_CREATED') OR provider_order_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS bf2026_native_checkout_provider_order_uidx
  ON bf2026_native_checkout_idempotency(provider_order_id)
  WHERE provider_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bf2026_native_checkout_state_lease_idx
  ON bf2026_native_checkout_idempotency(state, lease_expires_at);
COMMENT ON TABLE bf2026_native_checkout_idempotency IS
  'Durable BF2026 checkout idempotency. Ambiguous provider submits must be reconciled, never blindly retried.';
