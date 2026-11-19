'use strict';
/* BF2026 R121. Relay HMAC is internal and NEVER proof of GetCourse payment.
 * This module reads only an independently attested native order. No provider
 * mutations, no grant creation, no payment links, and no public release. */
const crypto=require('node:crypto');
const {SOURCE}=require('./provider-relay-webhook.cjs');
const {confirmNativeUnpaidBundleReadback,confirmNativePaidBundleReadback}=require('./native-bundle-qa.cjs');
const DEAL='924624456',ORDER='71994',LINE='942536770';
const DOMAIN='BF2026_R121_INDEPENDENT_NATIVE_READBACK_V1\n';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const signable=s=>Buffer.from(DOMAIN+JSON.stringify(s),'utf8');
function fail(code){const e=new Error(code);e.code=code;throw e}
function validate(snapshot,attestation,keys,now=Date.now()){
 if(!snapshot||snapshot.source!=='GETCOURSE_NATIVE_ADMIN_READBACK'||
  snapshot.line_id!==LINE||snapshot.widget_id!==1686790||!snapshot.unpaid||!snapshot.paid)
  fail('NATIVE_GETCOURSE_READBACK_REQUIRED');
 const timestamp=Date.parse(snapshot.captured_at);
 if(!Number.isFinite(timestamp)||Math.abs(now-timestamp)>600000)fail('PROVIDER_READBACK_STALE');
 const unpaid=confirmNativeUnpaidBundleReadback(snapshot.unpaid);
 if(unpaid.native_deal_id!==DEAL||unpaid.native_order_number!==ORDER||
  unpaid.offer_id!==8935004||unpaid.order_amount_rub!==11690||
  String(snapshot.unpaid.native_line_id)!==LINE||
  snapshot.unpaid.native_widget_id!==1686790)fail('NATIVE_ORDER_LINE_OR_PRICE_MISMATCH');
 const paid=confirmNativePaidBundleReadback({unpaid:snapshot.unpaid,paid:snapshot.paid});
 if(paid.provider_order_id!==DEAL||paid.native_order_number!==ORDER||
  paid.captured_rub!==11690)fail('PAID_ORDER_MISMATCH');
 if(!attestation||attestation.domain!=='BF2026_R121_INDEPENDENT_NATIVE_READBACK_V1'||
  typeof attestation.key_id!=='string'||typeof attestation.signature!=='string'||
  !/^[0-9a-f]{64}$/.test(attestation.sha256||''))
  fail('INDEPENDENT_REVIEW_SIGNATURE_REQUIRED');
 const key=keys?.[attestation.key_id];
 if(!key||!['TEST_ONLY','LIVE_INDEPENDENT_QA'].includes(key.mode))fail('REVIEW_KEY_NOT_PINNED');
 const message=signable(snapshot),digest=sha(message);
 if(attestation.sha256!==digest)fail('READBACK_SHA_MISMATCH');
 let signature;try{signature=Buffer.from(attestation.signature,'base64url')}
 catch{fail('INDEPENDENT_SIGNATURE_BAD')}
 if(signature.toString('base64url')!==attestation.signature||
  !crypto.verify(null,message,key.publicKey,signature))fail('INDEPENDENT_SIGNATURE_BAD');
 return {proof_sha256:digest,paid_event_id:paid.paid_event_id,trust:key.mode};
}
function createVerifier({pool,reader,keys={},allowLive=false,now=()=>Date.now()}={}){
 if(typeof pool?.query!=='function')fail('POSTGRES_LEDGER_REQUIRED');
 return async eventId=>{
  if(typeof eventId!=='string'||!/^[A-Za-z0-9_:.@-]{4,128}$/.test(eventId))
   fail('RELAY_EVENT_ID_INVALID');
  const r=await pool.query('SELECT source,event_id,provider_order_id,status_hint,raw_sha256,state FROM bf2026_native_event_inbox WHERE source=$1 AND event_id=$2',[SOURCE,eventId]);
  const e=r.rows?.[0];
  if(!e||e.provider_order_id!==DEAL)fail('EVENT_ORDER_ID_MISMATCH');
  if(e.status_hint!=='PAID')return {status:'HOLD_NON_PAYMENT_HINT',payment_verified:false,grant_writes:0,release_allowed:false};
  if(e.state!=='PENDING_PROVIDER_READBACK')return {status:'HOLD_EVENT_STATE',payment_verified:false,grant_writes:0,release_allowed:false};
  if(typeof reader?.readNativeOrder!=='function')
   return {status:'HOLD_PROVIDER_READBACK_NOT_CONFIGURED',payment_verified:false,grant_writes:0,release_allowed:false};
  let proof;try{proof=await reader.readNativeOrder({deal_id:DEAL,order_number:ORDER})}
  catch{return {status:'HOLD_READBACK_TIMEOUT_OR_UNAVAILABLE',payment_verified:false,grant_writes:0,release_allowed:false}}
  if(!proof?.snapshot||!proof.attestation)
   return {status:'HOLD_MISSING_PROVIDER_PROOF',payment_verified:false,grant_writes:0,release_allowed:false};
  const verified=validate(proof.snapshot,proof.attestation,keys,now());
  const live=allowLive===true&&reader.kind==='AUTHENTICATED_GETCOURSE_NATIVE_READBACK'&&
   verified.trust==='LIVE_INDEPENDENT_QA';
  const state=live?'INDEPENDENT_NATIVE_PAID_ATTESTED':'TEST_ONLY';
  let insert;
  try{
   insert=await pool.query('INSERT INTO bf2026_native_bundle_verification(event_id,provider_order_id,paid_event_id,proof_sha256,relay_sha256,state) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_id) DO NOTHING RETURNING event_id',
    [eventId,DEAL,verified.paid_event_id,verified.proof_sha256,e.raw_sha256,state]);
  }catch(err){if(err.code==='23505')fail('PAID_EVENT_DEDUP_CONFLICT');throw err}
  if(!insert.rowCount){
   const old=await pool.query('SELECT * FROM bf2026_native_bundle_verification WHERE event_id=$1',[eventId]);
   const p=old.rows?.[0];
   if(!p||p.provider_order_id!==DEAL||p.paid_event_id!==verified.paid_event_id||
    p.proof_sha256!==verified.proof_sha256||p.relay_sha256!==e.raw_sha256||
    p.state!==state)fail('EVENT_REPLAY_PAYLOAD_CONFLICT');
  }
  return {status:live?'INDEPENDENT_NATIVE_PAID_ATTESTED':'TEST_ONLY_SHAPE_PASS',
   duplicate:!insert.rowCount,order_number:ORDER,deal_id:DEAL,line_id:LINE,
   offer_id:8935004,widget_id:1686790,captured_rub:11690,
   paid_event_id:verified.paid_event_id,product_grants_checked:2,
   payment_verified:live,provider_cryptographic_signature_verified:false,
   independent_qa_attestation:true,grant_writes:0,release_allowed:false,checkout_url:null};
 };
}
module.exports={DOMAIN,signable,validate,createVerifier};
