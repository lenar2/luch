-- R122: authenticated GetCourse process callback hints only. No payments or grants.
BEGIN;
CREATE TABLE IF NOT EXISTS bf2026_getcourse_callback_hints (
 event_id char(64) PRIMARY KEY CHECK(event_id ~ '^[a-f0-9]{64}$'),
 provider_order_id text NOT NULL CHECK(provider_order_id='924624456'),
 order_number text NOT NULL CHECK(order_number='71994'),
 offer_id bigint NOT NULL CHECK(offer_id=8935004),
 status_hint text NOT NULL CHECK(status_hint IN('PAID','UNPAID','PART_PAYED','CANCELLED','FALSE','PAYMENT_WAITING','WAITING_FOR_RETURN')),
 order_total_rub integer NOT NULL CHECK(order_total_rub=11690),
 paid_total_rub numeric(12,2) NOT NULL CHECK(paid_total_rub>=0 AND paid_total_rub<=11690),
 occurred_at timestamptz NOT NULL,
 raw_sha256 char(64) NOT NULL CHECK(raw_sha256 ~ '^[a-f0-9]{64}$'),
 auth_method text NOT NULL CHECK(auth_method='BEARER_SHARED_SECRET'),
 provider_signature_verified boolean NOT NULL DEFAULT false CHECK(provider_signature_verified=false),
 received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bf2026_getcourse_callback_order_idx
 ON bf2026_getcourse_callback_hints(provider_order_id,received_at);
COMMENT ON TABLE bf2026_getcourse_callback_hints IS
 'Shared-secret-authenticated GetCourse Process Call URL hints. Not provider-signed; never proof of payment, receipt, or Training grants.';
COMMIT;
