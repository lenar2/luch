-- BF2026 Lot10 R131: isolate a SINGLE checkout consent nonce to ONE order intent.
-- Run only in isolated staging PostgreSQL before enabling QA prepare.
-- Failed/uncertain provider writes retain nonce ownership (NEVER recycle).
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS bf2026_r131_consent_nonce_one_order
  ON bf2026_r130_set_order_intents(nonce_sha256);
COMMENT ON INDEX bf2026_r131_consent_nonce_one_order IS
  'R131: one-use server consent nonce cannot be used with a second idempotency key / second GetCourse order.';
COMMIT;
