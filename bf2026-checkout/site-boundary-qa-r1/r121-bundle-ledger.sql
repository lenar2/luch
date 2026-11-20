-- R121 additive staging schema, no payment or grant issuance.
BEGIN;
CREATE TABLE IF NOT EXISTS bf2026_native_bundle_verification (
 event_id text PRIMARY KEY,
 provider_order_id text NOT NULL CHECK(provider_order_id='924624456'),
 paid_event_id text NOT NULL CHECK(length(paid_event_id) BETWEEN 3 AND 128),
 proof_sha256 char(64) NOT NULL CHECK(proof_sha256 ~ '^[0-9a-f]{64}$'),
 relay_sha256 char(64) NOT NULL CHECK(relay_sha256 ~ '^[0-9a-f]{64}$'),
 state text NOT NULL CHECK(state IN ('TEST_ONLY','INDEPENDENT_NATIVE_PAID_ATTESTED')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS bf2026_native_bundle_unique_real_paid_event
 ON bf2026_native_bundle_verification(paid_event_id)
 WHERE state='INDEPENDENT_NATIVE_PAID_ATTESTED';
CREATE UNIQUE INDEX IF NOT EXISTS bf2026_native_bundle_unique_paid_event
 ON bf2026_native_bundle_verification(paid_event_id);
COMMENT ON TABLE bf2026_native_bundle_verification IS
 'Signed independent readback hashes only; TEST_ONLY never verifies real payment.';
COMMIT;
