'use strict';
/**
 * BF2026 R115 trusted-relay event intake. An event is a HINT, never proof of payment.
 * GetCourse may invoke a URL in a process, but we do not assert it signs requests.
 * Only a separately configured HMAC-authenticated relay may call this gateway.
 */
const crypto=require('node:crypto');
const SCHEMA='bf2026.native.order.event.hint.v1';
const SOURCE='BF2026_TRUSTED_RELAY';
const MAX_SKEW_MS=300000;
function fail(code){const e=new Error(code);e.code=code;throw e;}
const hmac=(secret,stamp,body)=>crypto.createHmac('sha256',secret)
 .update('bf2026-relay-event-v1\n'+stamp+'\n').update(body).digest('hex');
const validId=x=>typeof x==='string'&&x.length>=4&&x.length<=128&&/^[A-Za-z0-9_:.@-]+$/.test(x);
function verifyRelayHint({rawBody,timestamp,signature,secret,nowMs=Date.now()}){
 if(!Buffer.isBuffer(secret)||secret.length<32)fail('RELAY_HMAC_KEY_NOT_CONFIGURED');
 if(!Buffer.isBuffer(rawBody)||rawBody.length<2||rawBody.length>4096)fail('RELAY_BODY_SIZE_INVALID');
 if(typeof timestamp!=='string'||!/^[0-9]{10}$/.test(timestamp))fail('RELAY_TIMESTAMP_INVALID');
 const at=Number(timestamp)*1000;
 if(!Number.isSafeInteger(at)||Math.abs(nowMs-at)>MAX_SKEW_MS)fail('RELAY_TIMESTAMP_EXPIRED');
 if(typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature))fail('RELAY_SIGNATURE_REQUIRED');
 const expected=hmac(secret,timestamp,rawBody),provided=Buffer.from(signature,'hex'),wanted=Buffer.from(expected,'hex');
 if(!crypto.timingSafeEqual(provided,wanted))fail('RELAY_SIGNATURE_INVALID');
 let event;try{event=JSON.parse(rawBody.toString('utf8'))}catch{fail('RELAY_JSON_INVALID')}
 if(!event||typeof event!=='object'||Array.isArray(event)||
  Object.keys(event).sort().join('|')!=='event_id|occurred_at|provider_order_id|schema|status_hint')
  fail('RELAY_HINT_FIELDS_INVALID');
 if(event.schema!==SCHEMA||!validId(event.event_id)||!validId(event.provider_order_id)||
    !['PAID','UNPAID','CANCELLED','REFUND'].includes(event.status_hint))
  fail('RELAY_HINT_VALUES_INVALID');
 const occurred=Date.parse(event.occurred_at);
 if(!Number.isFinite(occurred)||occurred>nowMs+MAX_SKEW_MS||occurred<nowMs-30*24*3600*1000)
  fail('RELAY_HINT_OCCURRED_AT_INVALID');
 const normalized={source:SOURCE,event_id:event.event_id,provider_order_id:event.provider_order_id,
  status_hint:event.status_hint,occurred_at:event.occurred_at,
  raw_sha256:crypto.createHash('sha256').update(rawBody).digest('hex')};
 return Object.freeze(normalized);
}
function createPostgresEventInbox(pool){
 if(!pool||typeof pool.query!=='function')fail('DURABLE_POSTGRES_EVENT_INBOX_REQUIRED');
 return {
  async accept(event){
   if(!event||event.source!==SOURCE||!validId(event.event_id)||!validId(event.provider_order_id)||
     !/^[a-f0-9]{64}$/.test(event.raw_sha256||''))fail('RELAY_VERIFIED_EVENT_REQUIRED');
   const args=[event.source,event.event_id,event.provider_order_id,event.status_hint,event.occurred_at,event.raw_sha256];
   const insert=await pool.query(
    "INSERT INTO bf2026_native_event_inbox(source,event_id,provider_order_id,status_hint,occurred_at,raw_sha256,state) VALUES($1,$2,$3,$4,$5,$6,'PENDING_PROVIDER_READBACK') ON CONFLICT DO NOTHING RETURNING event_id",args);
   if(insert.rowCount===1)return {status:'ACCEPTED_PENDING_READBACK',payment_verified:false,
    grant_writes:0,checkout_url:null};
   const old=await pool.query(
    "SELECT provider_order_id,status_hint,raw_sha256 FROM bf2026_native_event_inbox WHERE source=$1 AND event_id=$2",
    [event.source,event.event_id]);
   const row=old.rows?.[0];
   if(!row||row.raw_sha256!==event.raw_sha256||row.provider_order_id!==event.provider_order_id||
     row.status_hint!==event.status_hint)fail('RELAY_EVENT_ID_REPLAY_CONFLICT');
   return {status:'DUPLICATE_PENDING_READBACK',payment_verified:false,grant_writes:0,checkout_url:null};
  }
 };
}
async function ingestRelayEvent({rawBody,timestamp,signature,secret,nowMs=Date.now(),store}){
 const normalized=verifyRelayHint({rawBody,timestamp,signature,secret,nowMs});
 if(!store||typeof store.accept!=='function')fail('DURABLE_EVENT_INBOX_REQUIRED');
 const result=await store.accept(normalized);
 return {ok:true,http_status:202,status:result.status,provider_order_id:normalized.provider_order_id,
  event_id:normalized.event_id,webhook_hint:normalized.status_hint,payment_verified:false,
  native_order_verified:false,grant_writes:0,release_allowed:false};
}
function guardPaidProof({event,receipt}){
 if(!event||event.source!==SOURCE||!receipt||receipt.provider_order_id!==event.provider_order_id||
    receipt.status!=='PAID_NATIVE_READBACK_VERIFIED'||receipt.paid_total_rub!==11690||
    receipt.actual_grants_verified!==2||receipt.grant_writes!==0||
    receipt.receipt_tax_verified!==true||receipt.consent_verified!==true)
  fail('INDEPENDENT_PROVIDER_PAID_PROOF_REQUIRED');
 return {shape_checked_only:true,payment_verified:false,provider_order_id:event.provider_order_id,source:'CALLER_RESULT_SHAPE_ONLY',
  payment_event_id:receipt.paid_event_id,paid_total_rub:11690,grants:2,external_grant_writes:0};
}
module.exports={SCHEMA,SOURCE,MAX_SKEW_MS,verifyRelayHint,createPostgresEventInbox,ingestRelayEvent,
 guardPaidProof,hmac};
