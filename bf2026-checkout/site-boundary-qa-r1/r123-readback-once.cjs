'use strict';
/* BF2026 R123. Durable one-shot readback for EXACT native Order71994.
 * No order/receipt/grant writes, no provider-signed webhook claims.
 * Each key can trigger at most one export workflow; ambiguous outcomes hold. */
const crypto=require('node:crypto');
const {DEFAULTS}=require('./getcourse-export-readback.cjs');
const SUBJECT_SHA=crypto.createHash('sha256').update([
 'BF2026_R123_EXPORT_READBACK_V1',DEFAULTS.host,DEFAULTS.dealId,DEFAULTS.orderNumber,
 DEFAULTS.offerId,DEFAULTS.amountRub,4557988,936022301,4550895,933861292].join(':')).digest('hex');
function fail(code){const e=new Error(code);e.code=code;throw e}
function validKey(k){return typeof k==='string'&&/^[a-f0-9]{32,64}$/.test(k)}
function safeSnapshot(v){
 if(!v||typeof v!=='object'||Array.isArray(v))fail('R123_EXPORT_RESULT_INVALID');
 const goodState=new Set(['VERIFIED_UNPAID_ORDER','PARTIAL_PRODUCT_MAPPING_UNAVAILABLE',
 'PARTIAL_ORDER_STATE','PARTIAL_UNPAID_WITHOUT_ZERO_PAYMENT_READBACK',
 'PAID_ORDER_PAYMENT_DATE_MISSING','PAID_ORDER_PAYMENT_DATE_UNPARSEABLE',
 'PENDING_DEALS_EXPORT','PENDING_PAYMENTS_EXPORT','PAYMENT_RECORD_MATCHED']);
 if(!goodState.has(v.state))fail('R123_EXPORT_STATE_UNEXPECTED');
 if(!v.state.startsWith('PENDING')&&v.source!=='GETCOURSE_EXPORT_API_READONLY')fail('R123_EXPORT_SOURCE_NOT_TRUSTED');
 if(!v.state.startsWith('PENDING')&&
   (v.deal_id!==DEFAULTS.dealId||v.order_number!==DEFAULTS.orderNumber||
    Number(v.offer_id)!==DEFAULTS.offerId||v.order_total_rub!==DEFAULTS.amountRub))
  fail('R123_EXPORT_ORDER_IDENTITY_MISMATCH');
 if(v.state==='VERIFIED_UNPAID_ORDER'&&
   (v.order_status!=='new'||v.paid_total_rub!==0||v.product_identity_verified!==true))
  fail('R123_UNPAID_PRODUCT_IDENTITY_NOT_PROVEN');
 if(v.state==='PAYMENT_RECORD_MATCHED'&&
   (v.order_status!=='payed'||v.paid_total_rub!==DEFAULTS.amountRub||
    v.payment_amount_rub!==DEFAULTS.amountRub||
    v.payment_record_verified!==true||v.product_identity_verified!==true))
  fail('R123_PAID_PRODUCT_IDENTITY_NOT_PROVEN');
 const allow=['state','source','deal_id','order_number','offer_id','order_total_rub','order_status',
 'paid_total_rub','payed_at','payment_record_verified','payment_status','payment_amount_rub',
 'payment_id','payment_source','product_identity_verified','product_identity_reason'];
 const result={};for(const k of allow)if(v[k]!==undefined)result[k]=v[k];
 result.provider_cryptographic_signature_verified=false;
 result.fiscal_receipt_verified=false;result.actual_grants_verified=false;
 result.grant_writes=0;result.release_allowed=false;result.checkout_url=null;
 return Object.freeze(result);
}
function createReadbackOnce({pool,reader}={}){
 if(typeof pool?.query!=='function')fail('R123_POSTGRES_STORE_REQUIRED');
 if(typeof reader?.readBundleOrderAndPayment!=='function')fail('R123_READONLY_READER_REQUIRED');
 return async function readOnce(requestKey){
  if(!validKey(requestKey))fail('R123_IDEMPOTENCY_KEY_INVALID');
  let inserted;
  try{
   inserted=await pool.query("INSERT INTO bf2026_getcourse_readback_once(request_key,subject_sha256,state) VALUES($1,$2,'PENDING') ON CONFLICT(request_key) DO NOTHING RETURNING request_key",
    [requestKey,SUBJECT_SHA]);
  }catch{fail('R123_POSTGRES_UNAVAILABLE')}
  if(!inserted.rowCount){
   let found;try{found=await pool.query("SELECT subject_sha256,state,result FROM bf2026_getcourse_readback_once WHERE request_key=$1",[requestKey]);}
   catch{fail('R123_POSTGRES_UNAVAILABLE')}
   const prior=found.rows?.[0];if(!prior)fail('R123_READBACK_ROW_MISSING');
   if(prior.subject_sha256!==SUBJECT_SHA)fail('R123_IDEMPOTENCY_SUBJECT_CONFLICT');
   if(prior.state==='DONE')return {duplicate:true,...prior.result};
   return {duplicate:true,state:'HOLD_INFLIGHT_OR_UNKNOWN',payment_record_verified:false,
    provider_cryptographic_signature_verified:false,fiscal_receipt_verified:false,
    actual_grants_verified:false,grant_writes:0,release_allowed:false,checkout_url:null};
  }
  try{
   const result=safeSnapshot(await reader.readBundleOrderAndPayment());
   const changed=await pool.query("UPDATE bf2026_getcourse_readback_once SET state='DONE',result=$2::jsonb,updated_at=now() WHERE request_key=$1 AND state='PENDING' RETURNING request_key",[requestKey,JSON.stringify(result)]);
   if(changed.rowCount!==1)fail('R123_READBACK_COMMIT_CONFLICT');
   return {duplicate:false,...result};
  }catch(e){
   try{await pool.query("UPDATE bf2026_getcourse_readback_once SET state='UNKNOWN',updated_at=now() WHERE request_key=$1 AND state='PENDING'",[requestKey]);}
   catch{}
   return {duplicate:false,state:'HOLD_READBACK_UNKNOWN',reason_code:typeof e?.code==='string'&&/^[A-Z0-9_]{3,80}$/.test(e.code)?e.code:'R123_READBACK_FAILED',
    payment_record_verified:false,provider_cryptographic_signature_verified:false,
    fiscal_receipt_verified:false,actual_grants_verified:false,grant_writes:0,
    release_allowed:false,checkout_url:null};
  }
 };
}
module.exports={SUBJECT_SHA,validKey,safeSnapshot,createReadbackOnce};
