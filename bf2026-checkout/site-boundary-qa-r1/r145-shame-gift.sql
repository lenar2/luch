-- BF2026 R145: durable first-24h gift eligibility ledger + grant outbox.
-- STAGING/PRODUCTION MIGRATION IS NOT RUN BY THIS COMMIT.
-- Unique buyer/training and event keys prevent duplicate issue across restarts.
BEGIN;
CREATE TABLE IF NOT EXISTS bf2026_r145_shame_gift_events (
  account_host text NOT NULL CHECK (account_host='study.shkola-dnv.com'),
  event_id char(64) NOT NULL CHECK (event_id ~ '^[a-f0-9]{64}$'),
  raw_sha256 char(64) NOT NULL CHECK (raw_sha256 ~ '^[a-f0-9]{64}$'),
  provider_order_id text NOT NULL CHECK (provider_order_id ~ '^[0-9]{1,18}$'),
  buyer_id_sha256 char(64) NOT NULL CHECK (buyer_id_sha256 ~ '^[a-f0-9]{64}$'),
  decision text NOT NULL CHECK (decision IN ('ELIGIBLE','REFUND_CONFIRMED')),
  native_readback_sha256 char(64) NOT NULL CHECK (native_readback_sha256 ~ '^[a-f0-9]{64}$'),
  paid_at timestamptz,
  offer_ids bigint[],
  order_total_rub integer CHECK (order_total_rub IS NULL OR order_total_rub>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_host,event_id),
  CHECK ((decision='ELIGIBLE' AND paid_at IS NOT NULL AND offer_ids IS NOT NULL
          AND cardinality(offer_ids) BETWEEN 1 AND 5 AND order_total_rub IS NOT NULL)
      OR (decision='REFUND_CONFIRMED' AND paid_at IS NULL))
);
CREATE INDEX IF NOT EXISTS bf2026_r145_gift_events_order_idx
  ON bf2026_r145_shame_gift_events(account_host,provider_order_id,created_at DESC);
CREATE TABLE IF NOT EXISTS bf2026_r145_shame_gift_outbox (
  gift_key char(64) PRIMARY KEY CHECK (gift_key ~ '^[a-f0-9]{64}$'),
  account_host text NOT NULL CHECK (account_host='study.shkola-dnv.com'),
  buyer_id_sha256 char(64) NOT NULL CHECK (buyer_id_sha256 ~ '^[a-f0-9]{64}$'),
  user_id_nonce text NOT NULL,
  user_id_ciphertext text NOT NULL,
  user_id_tag text NOT NULL,
  training_id bigint NOT NULL CHECK (training_id=936028240),
  product_id bigint NOT NULL CHECK (product_id=4559950),
  source_order_id text NOT NULL CHECK (source_order_id ~ '^[0-9]{1,18}$'),
  source_event_id char(64) NOT NULL CHECK (source_event_id ~ '^[a-f0-9]{64}$'),
  offer_ids bigint[] NOT NULL CHECK (cardinality(offer_ids) BETWEEN 1 AND 5),
  order_total_rub integer NOT NULL CHECK (order_total_rub>0),
  paid_at timestamptz NOT NULL,
  access_days integer NOT NULL CHECK (access_days=365),
  grant_idempotency_key char(64) NOT NULL CHECK (grant_idempotency_key ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'READY' CHECK (state IN (
    'READY','GRANTING','GRANTED','ALREADY_ENTITLED','REFUNDED_NO_GRANT',
    'REFUND_AFTER_GRANT_REVIEW','RECONCILIATION_REQUIRED','HOLD')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count>=0),
  lease_until timestamptz,
  provider_grant_id text,
  access_from timestamptz,
  access_until timestamptz,
  last_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_host,buyer_id_sha256,training_id),
  UNIQUE (account_host,source_order_id,training_id)
);
CREATE INDEX IF NOT EXISTS bf2026_r145_shame_gift_outbox_claim_idx
  ON bf2026_r145_shame_gift_outbox(state,lease_until,created_at)
  WHERE state IN ('READY','GRANTING','RECONCILIATION_REQUIRED');
CREATE INDEX IF NOT EXISTS bf2026_r145_shame_gift_outbox_order_idx
  ON bf2026_r145_shame_gift_outbox(account_host,source_order_id);
COMMENT ON TABLE bf2026_r145_shame_gift_events IS
  'R145 authenticated GetCourse callback hints reconciled to fresh native paid/refund readback; hints alone never issue access.';
COMMENT ON TABLE bf2026_r145_shame_gift_outbox IS
  'R145 one-time gift Training 936028240 per buyer. User ID encrypted at rest. Native write disabled until owner-private activation evidence and approved idempotent entitlement adapter exist.';
COMMIT;