-- BF2026 R130: signed versioned 12-entry site manifest, anti-rollback head,
-- immutable activation history, and nonce->manifest binding. Isolated staging.
BEGIN;
CREATE TABLE IF NOT EXISTS bf2026_r130_manifest_history (
 registry_scope text NOT NULL CHECK (registry_scope IN ('BF2026_SITE','BF2026_R130_TEST')),
 manifest_version bigint NOT NULL CHECK (manifest_version>0),
 manifest_sha256 char(64) NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
 previous_manifest_sha256 char(64) CHECK (previous_manifest_sha256 IS NULL OR previous_manifest_sha256 ~ '^[a-f0-9]{64}$'),
 payload_sha256 char(64) NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
 key_id text NOT NULL CHECK (key_id ~ '^BF2026_[A-Z0-9_]{6,64}$'),
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL CHECK (expires_at>issued_at),
 signed_envelope jsonb NOT NULL,
 registered_at timestamptz NOT NULL DEFAULT now(),
 public_release_allowed boolean NOT NULL DEFAULT false CHECK (public_release_allowed=false),
 PRIMARY KEY(registry_scope,manifest_version),
 UNIQUE(registry_scope,manifest_sha256),
 UNIQUE(registry_scope,manifest_version,manifest_sha256),
 CHECK ((manifest_version=1 AND previous_manifest_sha256 IS NULL)
     OR (manifest_version>1 AND previous_manifest_sha256 IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS bf2026_r130_manifest_head (
 registry_scope text PRIMARY KEY CHECK (registry_scope IN ('BF2026_SITE','BF2026_R130_TEST')),
 manifest_version bigint NOT NULL,
 manifest_sha256 char(64) NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 public_release_allowed boolean NOT NULL DEFAULT false CHECK (public_release_allowed=false),
 FOREIGN KEY(registry_scope,manifest_version,manifest_sha256)
  REFERENCES bf2026_r130_manifest_history(registry_scope,manifest_version,manifest_sha256)
);
ALTER TABLE bf2026_r127_consent_challenges
 ADD COLUMN IF NOT EXISTS r130_registry_scope text,
 ADD COLUMN IF NOT EXISTS r130_manifest_version bigint,
 ADD COLUMN IF NOT EXISTS r130_manifest_sha256 char(64),
 ADD COLUMN IF NOT EXISTS r130_site_entry_key text;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bf2026_r127_r130_manifest_binding_all_or_none') THEN
  ALTER TABLE bf2026_r127_consent_challenges ADD CONSTRAINT bf2026_r127_r130_manifest_binding_all_or_none
   CHECK (
    (r130_registry_scope IS NULL AND r130_manifest_version IS NULL AND
     r130_manifest_sha256 IS NULL AND r130_site_entry_key IS NULL)
    OR
    (r130_registry_scope IN ('BF2026_SITE','BF2026_R130_TEST') AND
     r130_manifest_version>0 AND r130_manifest_sha256 ~ '^[a-f0-9]{64}$' AND
     r130_site_entry_key IN (
      'single:rejection','single:devaluation','single:self','single:guilt',
      'single:rejection_program','single:dnv','single:union','single:source:1',
      'single:source:2','single:personal_zoom','trainer_qa_only','bundle_qa_only'))
   );
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bf2026_r127_r130_manifest_history_fk') THEN
  ALTER TABLE bf2026_r127_consent_challenges ADD CONSTRAINT bf2026_r127_r130_manifest_history_fk
   FOREIGN KEY(r130_registry_scope,r130_manifest_version,r130_manifest_sha256)
   REFERENCES bf2026_r130_manifest_history(registry_scope,manifest_version,manifest_sha256);
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS bf2026_r127_r130_manifest_nonce_idx
 ON bf2026_r127_consent_challenges(r130_registry_scope,r130_manifest_version,r130_manifest_sha256)
 WHERE r130_registry_scope IS NOT NULL;
COMMENT ON TABLE bf2026_r130_manifest_history IS
 'R130 signed site-offer manifest activation history. Application only INSERTs; version/hash chain is append-only by contract. Test scope is explicitly separate. This is owner-signed readback, not GetCourse vendor signature.';
COMMENT ON TABLE bf2026_r130_manifest_head IS
 'R130 persistent anti-rollback high-water mark. One current version per scope. Never lower version; exact replay is idempotent.';
COMMENT ON COLUMN bf2026_r127_consent_challenges.r130_manifest_sha256 IS
 'Signed R130 manifest hash pinned at challenge issue; callback must match current head and exact offer revision.';
COMMIT;
