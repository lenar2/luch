-- BF2026 R127: per-offer one-time consent challenge and authenticated GetCourse callback.
-- Isolated staging migration. This is NOT a provider consent record by itself.
BEGIN;
CREATE TABLE IF NOT EXISTS bf2026_r127_consent_challenges (
 nonce_sha256 char(64) PRIMARY KEY CHECK (nonce_sha256 ~ '^[a-f0-9]{64}$'),
 session_sha256 char(64) NOT NULL CHECK (session_sha256 ~ '^[a-f0-9]{64}$'),
 route_key text NOT NULL CHECK (route_key IN (
  'single:rejection','single:devaluation','single:self','single:guilt',
  'single:rejection_program','single:dnv','single:union',
  'single:source:1','single:source:2','single:personal_zoom')),
 offer_id bigint NOT NULL CHECK (offer_id>0),
 widget_id bigint NOT NULL CHECK (widget_id>0),
 amount_rub integer NOT NULL CHECK (amount_rub>0),
 pricing_version text NOT NULL CHECK (length(pricing_version) BETWEEN 1 AND 100),
 offer_revision_sha256 char(64) NOT NULL CHECK (offer_revision_sha256 ~ '^[a-f0-9]{64}$'),
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL CHECK (expires_at>issued_at),
 state text NOT NULL DEFAULT 'PENDING'
  CHECK (state IN ('PENDING','ORDER_CALLBACK_MATCHED_HOLD','PROVIDER_CONSENT_VERIFIED_HOLD_OTHER_GATES','REJECTED','EXPIRED')),
 provider_order_id text,
 provider_order_number text,
 provider_user_id text,
 provider_offer_ids bigint[],
 provider_amount_rub integer,
 provider_order_status text,
 provider_order_created_at timestamptz,
 provider_callback_received_at timestamptz,
 provider_callback_sha256 char(64) CHECK (provider_callback_sha256 IS NULL OR provider_callback_sha256 ~ '^[a-f0-9]{64}$'),
 provider_callback_auth text CHECK (provider_callback_auth IS NULL OR provider_callback_auth='GETCOURSE_PROCESS_BEARER_SHARED_SECRET'),
 provider_signature_verified boolean NOT NULL DEFAULT false CHECK (provider_signature_verified=false),
 native_consent_verified boolean NOT NULL DEFAULT false,
 native_consent_source text,
 native_negative_test_sha256 char(64) CHECK (native_negative_test_sha256 IS NULL OR native_negative_test_sha256 ~ '^[a-f0-9]{64}$'),
 public_release_allowed boolean NOT NULL DEFAULT false CHECK (public_release_allowed=false),
 rejection_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (
  (state='PENDING' AND provider_order_id IS NULL AND provider_callback_sha256 IS NULL)
  OR
  (state<>'PENDING' AND provider_order_id IS NOT NULL AND provider_callback_sha256 IS NOT NULL)
 )
);
CREATE UNIQUE INDEX IF NOT EXISTS bf2026_r127_consent_order_unique
 ON bf2026_r127_consent_challenges(provider_order_id)
 WHERE provider_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bf2026_r127_consent_session_idx
 ON bf2026_r127_consent_challenges(session_sha256,issued_at DESC);
CREATE INDEX IF NOT EXISTS bf2026_r127_consent_expiry_idx
 ON bf2026_r127_consent_challenges(expires_at)
 WHERE state='PENDING';
COMMENT ON TABLE bf2026_r127_consent_challenges IS
 'R127 staging correlation ledger only: server-issued one-time nonce bound to exact offer/revision/time; authenticated GetCourse order callback is not itself proof that provider rejected missing consent. Client checkbox/JS never sets native_consent_verified. public_release_allowed is hard constrained false.';
COMMIT;
