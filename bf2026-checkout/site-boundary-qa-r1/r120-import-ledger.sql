-- BF2026 R120 — durable, non-retryable GetCourse Import API journal.
-- STAGING ONLY until separate owner/provider approval. Never marks a payment paid.
BEGIN;
CREATE TABLE IF NOT EXISTS bf2026_getcourse_import_ledger (
  scope text NOT NULL DEFAULT 'BF2026' CHECK (scope='BF2026'),
  checkout_idempotency_key varchar(32) NOT NULL CHECK (checkout_idempotency_key ~ '^[0-9a-f]{32}$'),
  selection_sha256 char(64) NOT NULL CHECK (selection_sha256 ~ '^[0-9a-f]{64}$'),
  customer_identity_hmac char(64) NOT NULL CHECK (customer_identity_hmac ~ '^[0-9a-f]{64}$'),
  total_rub integer NOT NULL CHECK (total_rub > 0),
  line_count smallint NOT NULL CHECK (line_count BETWEEN 1 AND 12),
  state text NOT NULL CHECK (state IN ('RESERVED','STEP_0_SUBMITTING','STEP_0_CONFIRMED','STEP_1_SUBMITTING','PROVIDER_OUTCOME_UNKNOWN','RECONCILIATION_REQUIRED','ORDER_CREATED')),
  current_step smallint NOT NULL DEFAULT 0 CHECK (current_step IN (0,1)),
  lease_owner varchar(32) NOT NULL CHECK (lease_owner ~ '^[0-9a-f]{32}$'),
  provider_deal_id bigint,
  provider_deal_number varchar(32),
  provider_user_id bigint,
  first_response_sha256 char(64) CHECK (first_response_sha256 IS NULL OR first_response_sha256 ~ '^[0-9a-f]{64}$'),
  final_response_sha256 char(64) CHECK (final_response_sha256 IS NULL OR final_response_sha256 ~ '^[0-9a-f]{64}$'),
  payment_link_sha256 char(64) CHECK (payment_link_sha256 IS NULL OR payment_link_sha256 ~ '^[0-9a-f]{64}$'),
  last_error_code varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(scope,checkout_idempotency_key),
  UNIQUE(scope,provider_deal_id),
  CHECK ((state IN ('STEP_0_CONFIRMED','STEP_1_SUBMITTING','ORDER_CREATED') AND provider_deal_id IS NOT NULL AND provider_deal_number IS NOT NULL AND provider_user_id IS NOT NULL) OR state IN ('RESERVED','STEP_0_SUBMITTING','PROVIDER_OUTCOME_UNKNOWN','RECONCILIATION_REQUIRED'))
);
CREATE INDEX IF NOT EXISTS bf2026_getcourse_import_pending_idx
 ON bf2026_getcourse_import_ledger(state,updated_at)
 WHERE state IN ('STEP_0_SUBMITTING','STEP_1_SUBMITTING','PROVIDER_OUTCOME_UNKNOWN','RECONCILIATION_REQUIRED');
COMMENT ON TABLE bf2026_getcourse_import_ledger IS
 'Import API is experimental/import-only. Idempotency journal; ambiguous provider timeout is never retried automatically. Payment is never marked paid here.';
COMMIT;
