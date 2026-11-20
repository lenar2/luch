'use strict';
/* BF2026 R130: GetCourse documented Import deals API.
 * GETCOURSE OFF BY DEFAULT. Success import != payment, receipt, grant.
 * Never automatically retry network/timeouts: write may already be committed.
 */
const crypto=require('node:crypto');
const ACCOUNT='study.shkola-dnv.com';
const ENDPOINT='https://'+ACCOUNT+'/pl/api/deals';
function fail(code){const e=Error(code);e.code=code;throw e}
function validEmail(v){return typeof v==='string'&&v.length<=254&&/^[^\s@<>"']+@[^\s@<>"']+\.[a-zA-Z]{2,}$/.test(v)}
function validId(v){return typeof v==='string'&&/^[0-9]{10,18}$/.test(v)}
function validNonce(v){return typeof v==='string'&&/^[A-Za-z0-9_-]{40,100}$/.test(v)}
function validSha(v){return typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)}
function createImportStep({line,index,total,dealNumber,email,nonce,offerRevisionSha256,maxItems=5}={}){
 if(!line||!Number.isInteger(index)||index<0||index>=total||total<2||![5,7].includes(maxItems)||total>maxItems||
  !validId(dealNumber)||!validEmail(email)||!validNonce(nonce)||
  !validSha(offerRevisionSha256)||!Number.isSafeInteger(line.offer_id)||
  !Number.isSafeInteger(line.discounted_line_price_rub)||line.discounted_line_price_rub<=0)
  fail('R130_IMPORT_STEP_INVALID');
 return Object.freeze({
  user:{email:email.toLowerCase()},
  system:{refresh_if_exists:0,multiple_offers:index===0?0:1,
   return_payment_link:0,return_deal_number:1},
  deal:{
   deal_number:dealNumber,offer_id:line.offer_id,quantity:1,
   deal_cost:line.discounted_line_price_rub,
   deal_status:'new',deal_is_paid:0,deal_currency:'RUB',
   addfields:{'BF2026 Consent Nonce':nonce,
    'BF2026 Offer Revision SHA256':offerRevisionSha256}
  }
 });
}
function serializeImportStep(payload,key){
 if(!key||typeof key!=='string'||key.length<32||key.length>4096)
  fail('R130_IMPORT_API_KEY_NOT_PROVISIONED');
 if(!payload||payload.deal?.deal_is_paid!==0||
  payload.deal?.deal_status!=='new'||payload.system?.return_payment_link!==0)
  fail('R130_IMPORT_CANNOT_AUTO_PAY_OR_RETURN_LINK');
 const params=Buffer.from(JSON.stringify(payload),'utf8').toString('base64');
 return new URLSearchParams({action:'add',key,params}).toString();
}
function normalizeImportAck(json,{dealNumber,previousDealId=null}={}){
 if(!json||typeof json!=='object'||Array.isArray(json)||
  ![true,'true'].includes(json.success)||json.action!=='add'||
  !json.result||typeof json.result!=='object'||
  ![true,'true'].includes(json.result.success)||
  [true,'true'].includes(json.result.error))
  fail('R130_PROVIDER_ACK_NOT_VERIFIABLY_SUCCESSFUL');
 const number=String(json.result.deal_number??''),id=String(json.result.deal_id??'');
 if(number!==dealNumber||!/^[1-9][0-9]{0,17}$/.test(id)||
  (previousDealId!==null&&String(previousDealId)!==id))
  fail('R130_PROVIDER_ACK_ORDER_IDENTITY_MISMATCH');
 return Object.freeze({deal_number:number,deal_id:id,import_acknowledged:true,
  actual_native_line_items_readback_verified:false,
  actual_native_discounted_total_verified:false,
  receipt_verified:false,actual_grants_verified:false,
  public_payment_link:null,provider_payment_link_released:false});
}
function createImportTransport({keyProvider,fetchImpl=globalThis.fetch,
 allowProviderNetwork=false,endpoint=ENDPOINT,timeoutMs=8000}={}){
 if(typeof keyProvider!=='function'||typeof fetchImpl!=='function')
  fail('R130_IMPORT_TRANSPORT_DEPENDENCIES_REQUIRED');
 if(endpoint!==ENDPOINT)fail('R130_IMPORT_ENDPOINT_NOT_APPROVED');
 if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>15000)
  fail('R130_IMPORT_TIMEOUT_NOT_BOUNDED');
 return Object.freeze({async send({payload,dealNumber,previousDealId}={}){
  if(!allowProviderNetwork)fail('R130_GETCOURSE_ORDER_IMPORT_DISABLED_BY_DEFAULT');
  const form=serializeImportStep(payload,await keyProvider());
  let decoded;
  try{
   const response=await fetchImpl(endpoint,{method:'POST',redirect:'error',
    headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},
    body:form,signal:AbortSignal.timeout(timeoutMs)});
   if(response?.status!==200)fail('R130_PROVIDER_HTTP_NOT_200');
   const buf=await response.text();
   if(typeof buf!=='string'||Buffer.byteLength(buf,'utf8')>16384)
    fail('R130_PROVIDER_RESPONSE_TOO_LARGE');
   decoded=JSON.parse(buf);
  }catch{fail('R130_PROVIDER_RESPONSE_UNKNOWN_HOLD_RECONCILIATION')}
  return normalizeImportAck(decoded,{dealNumber,previousDealId});
 }});
}
function generateDealNumber(){
 const n=crypto.randomBytes(8).readBigUInt64BE()%900000000000000n;
 return String(100000000000000n+n);
}
module.exports={ACCOUNT,ENDPOINT,createImportStep,serializeImportStep,
 normalizeImportAck,createImportTransport,generateDealNumber,
 validEmail,validNonce,validSha,validId};
