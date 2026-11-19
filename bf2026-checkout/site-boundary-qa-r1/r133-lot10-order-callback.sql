-- BF2026 R133: isolated durable inbox for Lot10 GetCourse order-created events.
-- This table records authenticated callback correlation only. It cannot prove
-- provider signatures, native order positions, legal consent, payment, receipt
-- or grants; all corresponding flags are constrained false.
BEGIN;
CREATE TABLE IF NOT EXISTS bf2026_r133_getcourse_lot10_callback_inbox (
 event_key char(64) PRIMARY KEY CHECK (event_key ~ '^[a-f0-9]{64}$'),
 account_host text NOT NULL CHECK (account_host='study.shkola-dnv.com'),
 deal_id text NOT NULL CHECK (deal_id ~ '^[0-9]{1,18}$'),
 deal_number text NOT NULL CHECK (deal_number ~ '^[0-9]{1,18}$'),
 user_id_sha256 char(64) NOT NULL CHECK (user_id_sha256 ~ '^[a-f0-9]{64}$'),
 nonce_sha256 char(64) NOT NULL CHECK (nonce_sha256 ~ '^[a-f0-9]{64}$'),
 offer_revision_sha256 char(64) NOT NULL CHECK (offer_revision_sha256 ~ '^[a-f0-9]{64}$'),
 offer_ids bigint[] NOT NULL CHECK (cardinality(offer_ids) BETWEEN 2 AND 5),
 offer_ids_sha256 char(64) NOT NULL CHECK (offer_ids_sha256 ~ '^[a-f0-9]{64}$'),
 total_rub integer NOT NULL CHECK (total_rub>0),
 order_status text NOT NULL CHECK (order_status='new'),
 provider_created_at timestamptz NOT NULL,
 callback_received_at timestamptz NOT NULL DEFAULT now(),
 payload_sha256 char(64) NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
 callback_auth text NOT NULL CHECK (callback_auth='GETCOURSE_PROCESS_BEARER_SHARED_SECRET'),
 state text NOT NULL DEFAULT 'CALLBACK_RECORDED_HOLD_NATIVE_READBACK'
  CHECK (state='CALLBACK_RECORDED_HOLD_NATIVE_READBACK'),
 provider_signature_verified boolean NOT NULL DEFAULT false CHECK (provider_signature_verified=false),
 native_order_readback_verified boolean NOT NULL DEFAULT false CHECK (native_order_readback_verified=false),
 payment_verified boolean NOT NULL DEFAULT false CHECK (payment_verified=false),
 receipt_verified boolean NOT NULL DEFAULT false CHECK (receipt_verified=false),
 grants_verified boolean NOT NULL DEFAULT false CHECK (grants_verified=false),
 public_release_allowed boolean NOT NULL DEFAULT false CHECK (public_release_allowed=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_host,deal_id),
 UNIQUE(account_host,deal_number),
 UNIQUE(account_host,nonce_sha256)
);
CREATE INDEX IF NOT EXISTS bf2026_r133_lot10_callback_received
 ON bf2026_r133_getcourse_lot10_callback_inbox(callback_received_at DESC);
COMMENT ON TABLE bf2026_r133_getcourse_lot10_callback_inbox IS
 'R133 Lot10 idempotent GetCourse order-created callback inbox. Bearer secret is not vendor signature. Inbox row is not native order readback/payment/receipt/grant evidence and cannot release public checkout.';
COMMIT;
