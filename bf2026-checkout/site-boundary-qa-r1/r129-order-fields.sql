-- BF2026 R129: staging-only GetCourse Order custom-field and Process callback contract.
-- No GetCourse API writes. Default rows deliberately have NO provider IDs or native evidence.
BEGIN;
CREATE TABLE IF NOT EXISTS bf2026_r129_order_fields (
 account_host text NOT NULL DEFAULT 'study.shkola-dnv.com'
   CHECK (account_host='study.shkola-dnv.com'),
 field_role text NOT NULL CHECK (field_role IN ('consent_nonce','offer_revision_sha256')),
 field_title text NOT NULL,
 field_scope text NOT NULL DEFAULT 'order' CHECK (field_scope='order'),
 field_id bigint CHECK (field_id>0 AND field_id<>22204810),
 native_readback_sha256 char(64) CHECK (native_readback_sha256 ~ '^[a-f0-9]{64}$'),
 native_form_population_sha256 char(64) CHECK (native_form_population_sha256 ~ '^[a-f0-9]{64}$'),
 owner_signed_payload_sha256 char(64) CHECK (owner_signed_payload_sha256 ~ '^[a-f0-9]{64}$'),
 native_verified_at timestamptz,
 state text NOT NULL DEFAULT 'UNVERIFIED'
   CHECK (state IN ('UNVERIFIED','OWNER_ATTESTED_QA_ONLY')),
 public_release_allowed boolean NOT NULL DEFAULT false CHECK (public_release_allowed=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (account_host,field_role),
 CHECK ((field_role='consent_nonce' AND field_title='BF2026 Consent Nonce')
    OR (field_role='offer_revision_sha256' AND field_title='BF2026 Offer Revision SHA256')),
 CHECK (
   (state='UNVERIFIED' AND field_id IS NULL AND native_readback_sha256 IS NULL
    AND native_form_population_sha256 IS NULL AND owner_signed_payload_sha256 IS NULL
    AND native_verified_at IS NULL)
   OR
   (state='OWNER_ATTESTED_QA_ONLY' AND field_id IS NOT NULL
    AND native_readback_sha256 IS NOT NULL AND native_form_population_sha256 IS NOT NULL
    AND owner_signed_payload_sha256 IS NOT NULL AND native_verified_at IS NOT NULL)
 )
);
CREATE UNIQUE INDEX IF NOT EXISTS bf2026_r129_distinct_order_field_ids
 ON bf2026_r129_order_fields(account_host,field_id) WHERE field_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS bf2026_r129_order_process (
 account_host text PRIMARY KEY CHECK (account_host='study.shkola-dnv.com'),
 process_id bigint CHECK (process_id>0),
 process_scope text NOT NULL DEFAULT 'orders' CHECK (process_scope='orders'),
 callback_url text NOT NULL DEFAULT 'https://wf.tati-lar.ru/api/checkout/_provider/getcourse/order-created'
  CHECK (callback_url='https://wf.tati-lar.ru/api/checkout/_provider/getcourse/order-created'),
 native_process_readback_sha256 char(64) CHECK (native_process_readback_sha256 ~ '^[a-f0-9]{64}$'),
 owner_signed_payload_sha256 char(64) CHECK (owner_signed_payload_sha256 ~ '^[a-f0-9]{64}$'),
 native_verified_at timestamptz,
 state text NOT NULL DEFAULT 'UNVERIFIED'
   CHECK (state IN ('UNVERIFIED','OWNER_ATTESTED_QA_ONLY')),
 provider_signature_verified boolean NOT NULL DEFAULT false CHECK (provider_signature_verified=false),
 public_release_allowed boolean NOT NULL DEFAULT false CHECK (public_release_allowed=false),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (
   (state='UNVERIFIED' AND process_id IS NULL AND native_process_readback_sha256 IS NULL
    AND owner_signed_payload_sha256 IS NULL AND native_verified_at IS NULL)
   OR
   (state='OWNER_ATTESTED_QA_ONLY' AND process_id IS NOT NULL
    AND native_process_readback_sha256 IS NOT NULL
    AND owner_signed_payload_sha256 IS NOT NULL AND native_verified_at IS NOT NULL)
 )
);
INSERT INTO bf2026_r129_order_fields(account_host,field_role,field_title)
VALUES
 ('study.shkola-dnv.com','consent_nonce','BF2026 Consent Nonce'),
 ('study.shkola-dnv.com','offer_revision_sha256','BF2026 Offer Revision SHA256')
ON CONFLICT (account_host,field_role) DO NOTHING;
INSERT INTO bf2026_r129_order_process(account_host)
 VALUES ('study.shkola-dnv.com')
 ON CONFLICT (account_host) DO NOTHING;
COMMENT ON TABLE bf2026_r129_order_fields IS
 'R129 stage-only placeholders; native GetCourse ORDER field IDs remain NULL until owner-authenticated independent readback. USER custom field 22204810 is forbidden. Owner attestation is not GetCourse vendor proof.';
COMMENT ON TABLE bf2026_r129_order_process IS
 'R129 stage-only callback metadata; NO native GetCourse Process ID is known. Process bearer secret is not provider digital signature and these rows cannot release sales.';
COMMIT;
