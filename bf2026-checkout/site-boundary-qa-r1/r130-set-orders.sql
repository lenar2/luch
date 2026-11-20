-- BF2026 R130 single GetCourse multi-offer order assembler.
-- Isolated PostgreSQL stage ONLY. Production import disabled by default.
-- No payment links and no "payed" status can be stored.
BEGIN;
CREATE TABLE IF NOT EXISTS bf2026_r130_set_order_intents (
 intent_key char(64) PRIMARY KEY CHECK (intent_key ~ '^[a-f0-9]{64}$'),
 request_sha256 char(64) NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
 buyer_sha256 char(64) NOT NULL CHECK (buyer_sha256 ~ '^[a-f0-9]{64}$'),
 nonce_sha256 char(64) NOT NULL CHECK (nonce_sha256 ~ '^[a-f0-9]{64}$'),
 offer_revision_sha256 char(64) NOT NULL CHECK (offer_revision_sha256 ~ '^[a-f0-9]{64}$'),
 plan_sha256 char(64) NOT NULL CHECK (plan_sha256 ~ '^[a-f0-9]{64}$'),
 pricing_version text NOT NULL CHECK (pricing_version='BF2026_LOT10_CUSTOM_SET_R107'),
 deal_number text NOT NULL UNIQUE CHECK (deal_number ~ '^[0-9]{10,18}$'),
 deal_id text CHECK (deal_id IS NULL OR deal_id ~ '^[0-9]{1,18}$'),
 count_items integer NOT NULL CHECK (count_items BETWEEN 2 AND 5),
 total_rub integer NOT NULL CHECK (total_rub>0),
 current_step integer NOT NULL DEFAULT 0 CHECK (current_step BETWEEN 0 AND 5),
 state text NOT NULL DEFAULT 'PREPARED'
  CHECK (state IN (
   'PREPARED','SEND_UNCERTAIN','PARTIAL_ACKED_HOLD',
   'ALL_IMPORT_ACKED_HOLD_NATIVE_READBACK',
   'PROVIDER_UNKNOWN_MANUAL_RECONCILIATION',
   'DENIED')),
 no_auto_retry boolean NOT NULL DEFAULT true CHECK (no_auto_retry=true),
 provider_signature_verified boolean NOT NULL DEFAULT false CHECK (provider_signature_verified=false),
 native_line_items_verified boolean NOT NULL DEFAULT false CHECK (native_line_items_verified=false),
 native_discount_total_verified boolean NOT NULL DEFAULT false CHECK (native_discount_total_verified=false),
 payment_verified boolean NOT NULL DEFAULT false CHECK (payment_verified=false),
 fiscal_receipt_verified boolean NOT NULL DEFAULT false CHECK (fiscal_receipt_verified=false),
 actual_grants_verified boolean NOT NULL DEFAULT false CHECK (actual_grants_verified=false),
 public_payment_link text CHECK (public_payment_link IS NULL),
 public_release_allowed boolean NOT NULL DEFAULT false CHECK (public_release_allowed=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 last_error_code text,
 CHECK ((current_step=0 AND deal_id IS NULL) OR current_step>=1)
);
CREATE TABLE IF NOT EXISTS bf2026_r130_set_order_steps(
 intent_key char(64) NOT NULL REFERENCES bf2026_r130_set_order_intents(intent_key) ON DELETE RESTRICT,
 step_index integer NOT NULL CHECK (step_index BETWEEN 0 AND 4),
 offer_id bigint NOT NULL CHECK (offer_id>0),
 line_amount_rub integer NOT NULL CHECK (line_amount_rub>0),
 state text NOT NULL DEFAULT 'PREPARED'
  CHECK (state IN ('PREPARED','SEND_UNCERTAIN','ACKED','UNKNOWN_HOLD')),
 deal_id text CHECK (deal_id IS NULL OR deal_id ~ '^[0-9]{1,18}$'),
 sent_at timestamptz,
 acked_at timestamptz,
 PRIMARY KEY(intent_key,step_index)
);
COMMENT ON TABLE bf2026_r130_set_order_intents IS
 'One external GetCourse order with 2-5 existing Offer lines. Import ack is not native readback, payment, receipt or grants. Unknown writes must never auto-retry.';
COMMIT;
