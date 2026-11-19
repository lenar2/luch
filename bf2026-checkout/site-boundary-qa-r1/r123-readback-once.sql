-- BF2026 R123. One idempotency key = at most one GetCourse export workflow.
-- Durable PENDING / UNKNOWN never launches a duplicate provider call.
BEGIN;
CREATE TABLE IF NOT EXISTS bf2026_getcourse_readback_once (
 request_key text PRIMARY KEY CHECK (request_key ~ '^[a-f0-9]{32,64}$'),
 subject_sha256 char(64) NOT NULL CHECK(subject_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK (state IN ('PENDING','DONE','UNKNOWN')),
 result jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (jsonb_typeof(result)='object')
);
COMMENT ON TABLE bf2026_getcourse_readback_once IS
 'Exact QA Order 71994 export readback; only sanitized evidence, no credentials or PII. UNKNOWN is never retried with same key.';
COMMIT;
