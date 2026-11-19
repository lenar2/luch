'use strict';
/* BF2026 R133: durable, idempotent GetCourse Lot10 order-created callback.
 * A Bearer secret authenticates the configured Process sender; it is NOT a
 * GetCourse digital signature and it does NOT prove legal consent, payment,
 * receipt, native line-item readback or access grants.
 *
 * This endpoint only correlates an already prepared R130 2-5 Offer intent.
 * It records a minimal, PII-reduced inbox event and never mutates the intent,
 * creates an order, retries an Import, changes status or releases a link.
 */
const crypto = require('node:crypto');
const { loadCallbackSecret } = require('./r127-consent-boundary.cjs');

const ACCOUNT_HOST = 'study.shkola-dnv.com';
const CALLBACK_PATH = '/api/checkout/_provider/getcourse/lot10-order-created';
const MAX_BODY_BYTES = 8192;
const MAX_EVENT_AGE_MS = 30 * 86400000;
const EXPECTED_KEYS = Object.freeze([
  'deal_id', 'deal_number', 'user_id', 'offers', 'cost_money_value',
  'status', 'created_at', 'consent_nonce', 'offer_revision_sha256'
]);
const HEX64 = /^[a-f0-9]{64}$/;
const TOKEN = /^[A-Za-z0-9_-]{40,100}$/;
const DIGITS = /^[0-9]{1,18}$/;

function fail(code, status = 422) {
  const error = new Error(code);
  error.code = code;
  error.httpStatus = status;
  throw error;
}
function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function exactKeys(value, keys) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join('|') === [...keys].sort().join('|');
}
function canonical(value, depth = 0) {
  if (depth > 6) fail('R133_CALLBACK_VALUE_TOO_DEEP');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('R133_CALLBACK_NUMBER_INVALID');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (value.length > 50) fail('R133_CALLBACK_ARRAY_TOO_LARGE');
    return '[' + value.map(item => canonical(item, depth + 1)).join(',') + ']';
  }
  if (typeof value === 'object' &&
      (Object.getPrototypeOf(value) === Object.prototype ||
       Object.getPrototypeOf(value) === null)) {
    const keys = Object.keys(value).sort();
    if (keys.length > 50 || keys.some(key => key.length > 100)) {
      fail('R133_CALLBACK_OBJECT_TOO_LARGE');
    }
    return '{' + keys.map(key =>
      JSON.stringify(key) + ':' + canonical(value[key], depth + 1)
    ).join(',') + '}';
  }
  fail('R133_CALLBACK_VALUE_TYPE_INVALID');
}
function numericId(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }
  return typeof value === 'string' && DIGITS.test(value) && /[1-9]/.test(value)
    ? value : null;
}
function parseOfferIds(value) {
  let list = value;
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw || raw.length > 2048) return null;
    if (raw[0] === '[') {
      try { list = JSON.parse(raw); } catch { return null; }
    } else {
      list = raw.split(',').map(item => item.trim());
    }
  }
  if (!Array.isArray(list) || list.length < 2 || list.length > 5) return null;
  const ids = [];
  for (const item of list) {
    let candidate = item;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      candidate = item.offer_id ?? item.id;
    }
    const id = numericId(candidate);
    if (!id) return null;
    ids.push(id);
  }
  if (new Set(ids).size !== ids.length) return null;
  return ids;
}
function parseRubles(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string' || !/^[0-9]{1,9}(?:\.[0-9]{1,2})?$/.test(value)) {
    return null;
  }
  const [whole, fraction = ''] = value.split('.');
  if (fraction && /[1-9]/.test(fraction)) return null;
  const amount = Number(whole);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
function parseCreatedAt(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value)) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms) : null;
}
function normalizeCallback(body) {
  if (!exactKeys(body, EXPECTED_KEYS)) fail('R133_CALLBACK_SCHEMA_INVALID');
  const dealId = numericId(body.deal_id);
  const dealNumber = numericId(body.deal_number);
  const userId = numericId(body.user_id);
  const offers = parseOfferIds(body.offers);
  const amount = parseRubles(body.cost_money_value);
  const createdAt = parseCreatedAt(body.created_at);
  if (!dealId || !dealNumber || !userId) fail('R133_CALLBACK_ORDER_IDENTITY_INVALID');
  if (!offers) fail('R133_CALLBACK_OFFER_LIST_INVALID');
  if (!amount) fail('R133_CALLBACK_TOTAL_INVALID');
  if (body.status !== 'new') fail('R133_CALLBACK_ORDER_NOT_NEW');
  if (!createdAt) fail('R133_CALLBACK_CREATED_AT_TIMEZONE_INVALID');
  if (typeof body.consent_nonce !== 'string' || !TOKEN.test(body.consent_nonce)) {
    fail('R133_CALLBACK_CONSENT_NONCE_INVALID');
  }
  if (typeof body.offer_revision_sha256 !== 'string' ||
      !HEX64.test(body.offer_revision_sha256)) {
    fail('R133_CALLBACK_OFFER_REVISION_INVALID');
  }
  return Object.freeze({
    deal_id: dealId,
    deal_number: dealNumber,
    user_id: userId,
    offers,
    total_rub: amount,
    status: body.status,
    created_at: createdAt.toISOString(),
    consent_nonce: body.consent_nonce,
    offer_revision_sha256: body.offer_revision_sha256
  });
}
function bearerMatches(req, secret) {
  const header = req.headers?.authorization;
  if (typeof secret !== 'string' || secret.length < 32 ||
      typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice(7), 'utf8');
  const expected = Buffer.from(secret, 'utf8');
  return supplied.length === expected.length &&
    crypto.timingSafeEqual(supplied, expected);
}
function send(res, status, body) {
  if (res.headersSent) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, private',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer'
  });
  res.end(JSON.stringify(body));
}
async function readJson(req) {
  if (String(req.headers['content-type'] || '').split(';')[0].trim() !== 'application/json') {
    fail('R133_JSON_CONTENT_TYPE_REQUIRED', 415);
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) fail('R133_CALLBACK_BODY_TOO_LARGE', 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    fail('R133_CALLBACK_JSON_INVALID', 400);
  }
}
function createLot10OrderCallbackRouter({
  pool, secretProvider = loadCallbackSecret, clock = () => Date.now()
} = {}) {
  if (typeof pool?.connect !== 'function' || typeof pool?.query !== 'function' ||
      typeof secretProvider !== 'function' || typeof clock !== 'function') {
    fail('R133_CALLBACK_DEPENDENCIES_REQUIRED', 500);
  }
  return async function lot10OrderCallbackRouter(req, res, path) {
    if (path !== CALLBACK_PATH) return false;
    if (req.method !== 'POST') {
      send(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', public_release_allowed: false });
      return true;
    }
    // GetCourse Process is server-to-server. Browser-origin requests are not accepted.
    if (req.headers.origin !== undefined) {
      send(res, 403, { ok: false, code: 'R133_BROWSER_ORIGIN_DENIED', public_release_allowed: false });
      return true;
    }
    let secret;
    try { secret = secretProvider(); } catch { secret = null; }
    if (typeof secret !== 'string' || secret.length < 32 || secret.length > 1024) {
      send(res, 503, { ok: false, code: 'R133_CALLBACK_SECRET_NOT_CONFIGURED', public_release_allowed: false });
      return true;
    }
    if (!bearerMatches(req, secret)) {
      send(res, 401, { ok: false, code: 'R133_CALLBACK_AUTH_FAILED', public_release_allowed: false });
      return true;
    }
    let normalized;
    try {
      normalized = normalizeCallback(await readJson(req));
    } catch (error) {
      send(res, error.httpStatus || 422, {
        ok: false,
        code: /^R133_/.test(String(error.code || error.message))
          ? String(error.code || error.message) : 'R133_CALLBACK_INVALID',
        public_release_allowed: false
      });
      return true;
    }
    const nonceHash = sha(normalized.consent_nonce);
    const userIdHash = sha(normalized.user_id);
    const eventKey = sha([
      ACCOUNT_HOST, normalized.deal_id, normalized.deal_number,
      userIdHash, nonceHash, normalized.offer_revision_sha256
    ].join('|'));
    const payloadHash = sha(canonical(normalized));
    const offersHash = sha(canonical(normalized.offers));
    const createdAt = new Date(normalized.created_at);
    const now = clock();
    if (!Number.isFinite(now) || createdAt.getTime() > now + 60000 ||
        now - createdAt.getTime() > MAX_EVENT_AGE_MS) {
      send(res, 422, { ok: false, code: 'R133_CALLBACK_EVENT_TIME_INVALID', public_release_allowed: false });
      return true;
    }
    let client;
    let transaction = false;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      transaction = true;
      // Serialize retries for one native deal; DB unique constraints also
      // protect deal IDs, deal numbers and one-use consent nonces.
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
        ['bf2026-r133-lot10:' + normalized.deal_id]
      );
      const intentResult = await client.query(
        'SELECT intent_key,nonce_sha256,offer_revision_sha256,deal_number,' +
        'count_items,total_rub,state,created_at FROM bf2026_r130_set_order_intents ' +
        'WHERE deal_number=$1 FOR SHARE',
        [normalized.deal_number]
      );
      if (intentResult.rows.length !== 1) fail('R133_CALLBACK_INTENT_NOT_FOUND', 404);
      const intent = intentResult.rows[0];
      if (String(intent.deal_number) !== normalized.deal_number ||
          intent.nonce_sha256 !== nonceHash ||
          intent.offer_revision_sha256 !== normalized.offer_revision_sha256) {
        fail('R133_CALLBACK_INTENT_CONSENT_OR_REVISION_MISMATCH', 409);
      }
      if (intent.state === 'DENIED') fail('R133_CALLBACK_INTENT_DENIED', 409);
      const intentCreated = new Date(intent.created_at).getTime();
      if (!Number.isFinite(intentCreated) ||
          createdAt.getTime() < intentCreated - 300000 ||
          createdAt.getTime() > now + 60000) {
        fail('R133_CALLBACK_OUTSIDE_INTENT_WINDOW', 422);
      }
      const stepsResult = await client.query(
        'SELECT step_index,offer_id,line_amount_rub FROM bf2026_r130_set_order_steps ' +
        'WHERE intent_key=$1 ORDER BY step_index',
        [intent.intent_key]
      );
      const steps = stepsResult.rows;
      const expectedCount = Number(intent.count_items);
      const expectedOffers = steps.map(row => String(row.offer_id));
      const expectedTotal = steps.reduce((sum, row) => sum + Number(row.line_amount_rub), 0);
      if (expectedCount < 2 || expectedCount > 5 || steps.length !== expectedCount ||
          expectedOffers.length !== normalized.offers.length ||
          expectedOffers.some((id, index) => id !== normalized.offers[index]) ||
          expectedTotal !== Number(intent.total_rub) ||
          normalized.total_rub !== Number(intent.total_rub)) {
        fail('R133_CALLBACK_NATIVE_ORDER_SUMMARY_MISMATCH', 409);
      }
      const inserted = await client.query(
        'INSERT INTO bf2026_r133_getcourse_lot10_callback_inbox ' +
        '(event_key,account_host,deal_id,deal_number,user_id_sha256,nonce_sha256,' +
        'offer_revision_sha256,offer_ids,offer_ids_sha256,total_rub,order_status,' +
        'provider_created_at,callback_received_at,payload_sha256,callback_auth) ' +
        "VALUES($1,$2,$3,$4,$5,$6,$7,$8::bigint[],$9,$10,'new',$11,$12,$13," +
        "'GETCOURSE_PROCESS_BEARER_SHARED_SECRET') ON CONFLICT DO NOTHING RETURNING event_key",
        [eventKey, ACCOUNT_HOST, normalized.deal_id, normalized.deal_number,
          userIdHash, nonceHash, normalized.offer_revision_sha256,
          normalized.offers, offersHash, normalized.total_rub,
          createdAt.toISOString(), new Date(now).toISOString(), payloadHash]
      );
      if (inserted.rowCount === 1) {
        await client.query('COMMIT');
        transaction = false;
        send(res, 202, {
          ok: true, duplicate: false, state: 'CALLBACK_RECORDED_HOLD_NATIVE_READBACK',
          deal_id: normalized.deal_id, deal_number: normalized.deal_number,
          offer_count: expectedCount, total_rub: normalized.total_rub,
          provider_callback_auth: 'GETCOURSE_PROCESS_BEARER_SHARED_SECRET',
          provider_signature_verified: false,
          native_order_readback_verified: false, payment_verified: false,
          receipt_verified: false, grants_verified: false,
          public_release_allowed: false
        });
        return true;
      }
      const existing = await client.query(
        'SELECT event_key,payload_sha256 FROM bf2026_r133_getcourse_lot10_callback_inbox ' +
        'WHERE event_key=$1 OR (account_host=$2 AND deal_id=$3) ' +
        'OR (account_host=$2 AND deal_number=$4) OR (account_host=$2 AND nonce_sha256=$5) ' +
        'LIMIT 2',
        [eventKey, ACCOUNT_HOST, normalized.deal_id, normalized.deal_number, nonceHash]
      );
      if (existing.rows.length === 1 &&
          existing.rows[0].event_key === eventKey &&
          existing.rows[0].payload_sha256 === payloadHash) {
        await client.query('COMMIT');
        transaction = false;
        send(res, 200, {
          ok: true, duplicate: true, state: 'CALLBACK_RECORDED_HOLD_NATIVE_READBACK',
          deal_id: normalized.deal_id, deal_number: normalized.deal_number,
          provider_signature_verified: false, payment_verified: false,
          receipt_verified: false, grants_verified: false,
          public_release_allowed: false
        });
        return true;
      }
      fail('R133_CALLBACK_IDEMPOTENCY_CONFLICT', 409);
    } catch (error) {
      if (transaction) {
        try { await client.query('ROLLBACK'); } catch {}
      }
      const status = Number.isInteger(error.httpStatus) ? error.httpStatus :
        (error.code === '23505' ? 409 : 503);
      send(res, status, {
        ok: false,
        code: /^R133_/.test(String(error.code || error.message))
          ? String(error.code || error.message)
          : (error.code === '23505' ? 'R133_CALLBACK_UNIQUE_CONFLICT' : 'R133_CALLBACK_DATABASE_UNAVAILABLE'),
        public_release_allowed: false
      });
      return true;
    } finally {
      client?.release?.();
    }
  };
}
function loadConfiguredLot10OrderCallbackRouter({ pool, env = process.env, clock } = {}) {
  return createLot10OrderCallbackRouter({
    pool, secretProvider: () => loadCallbackSecret(env), clock
  });
}
module.exports = {
  ACCOUNT_HOST, CALLBACK_PATH, MAX_BODY_BYTES, MAX_EVENT_AGE_MS,
  canonical, parseOfferIds, parseRubles, parseCreatedAt, normalizeCallback,
  createLot10OrderCallbackRouter, loadConfiguredLot10OrderCallbackRouter
};
