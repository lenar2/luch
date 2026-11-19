-- BF2026 R115: authenticated relay callback inbox. NOT DEPLOYED.
-- Provider "call URL" events are HINTS only; they never create payments or grants.
BEGIN;
CREATE TABLE IF NOT EXISTS bf2026_native_event_inbox (
  source text NOT NULL CHECK (source = 'BF2026_TRUSTED_RELAY'),
  event_id text NOT NULL CHECK (length(event_id) BETWEEN 4 AND 128),
  provider_order_id text NOT NULL CHECK (length(provider_order_id) BETWEEN 4 AND 128),
  status_hint text NOT NULL CHECK (status_hint IN ('PAID','UNPAID','CANCELLED','REFUND')),
  occurred_at timestamptz NOT NULL,
  raw_sha256 char(64) NOT NULL CHECK (raw_sha256 ~ '^[0-9a-f]{64}$'),
  state text NOT NULL DEFAULT 'PENDING_PROVIDER_READBACK'
    CHECK (state IN ('PENDING_PROVIDER_READBACK','VERIFIED_UNPAID','VERIFIED_PAID','RECONCILIATION_FAILED')),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  PRIMARY KEY (source,event_id)
);
CREATE INDEX IF NOT EXISTS bf2026_event_inbox_pending_idx
 ON bf2026_native_event_inbox(state,received_at)
 WHERE state='PENDING_PROVIDER_READBACK';
CREATE INDEX IF NOT EXISTS bf2026_event_inbox_provider_order_idx
 ON bf2026_native_event_inbox(provider_order_id,received_at);
COMMENT ON TABLE bf2026_native_event_inbox IS
 'Only authenticated relay hints and SHA-256. A callback cannot mark payment paid or issue grants. Independent GetCourse order/payment/receipt/grant readback mandatory.';
COMMIT;
