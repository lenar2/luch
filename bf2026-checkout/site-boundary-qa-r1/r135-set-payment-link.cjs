'use strict';
/* BF2026 Lot10 R135: final-step GetCourse payment link after one multi-offer
 * unpaid order. Unlike the legacy R130 checkout, DOES NOT require paid-order,
 * fiscal receipt or already activated access for showing a payment link.
 * It DOES require independently read-back correct native unpaid order total,
 * positions, buyer, consent, and a provider response URL.
 * Strictly dormant by default. Never sends a provider request unless a caller
 * has separately configured an owner-approved write key AND enabled network.
 */
const {createImportStep, normalizeImportAck, ENDPOINT}=
 require('./r130-getcourse-import.cjs');
const {validateAssembledOrder}=
 require('./r130-native-order-readback.cjs');

function invalid(code) {const e=new Error(code); e.code=code; throw e;}
function exactPaymentUrl(value) {
 if(typeof value!=='string'||value.length>4096)invalid('R135_PAYMENT_URL_MISSING');
 let u;
 try {u=new URL(value);}catch {invalid('R135_PAYMENT_URL_INVALID');}
 if(u.protocol!=='https:'||u.hostname!=='study.shkola-dnv.com'||
   u.port||u.username||u.password||u.hash||
   !u.pathname.startsWith('/pl/')&&!u.pathname.startsWith('/sales/'))
  invalid('R135_PAYMENT_URL_UNTRUSTED_DESTINATION');
 return u.toString();
}
function finalPaymentPayload(params) {
 const base=createImportStep(params);
 return Object.freeze({
  ...base,
  system:Object.freeze({...base.system,
   return_payment_link: params.index===params.total-1 ? 1 : 0})
 });
}
function encodePostBody(payload,key) {
 if(typeof key!=='string'||key.length<32||key.length>4096)
  invalid('R135_OWNER_WRITE_KEY_REQUIRED');
 if(!payload||payload.deal?.deal_is_paid!==0||
   payload.deal?.deal_status!=='new'||
   ![0,1].includes(payload.system?.return_payment_link)||
   ![0,1].includes(payload.system?.multiple_offers)||
   typeof payload.deal.deal_number!=='string')
  invalid('R135_INVALID_UNPAID_ORDER_PAYLOAD');
 if(payload.system.return_payment_link===1&&payload.system.multiple_offers!==1)
  invalid('R135_FINAL_PAYMENT_LINK_REQUIRES_APPENDED_OFFER');
 return new URLSearchParams({
  action:'add',key,params:Buffer.from(JSON.stringify(payload),'utf8').toString('base64')
 }).toString();
}
function normalizeStepResponse(json,{dealNumber,previousDealId=null,isFinal=false}={}) {
 const ack=normalizeImportAck(json,{dealNumber,previousDealId});
 if(isFinal) {
  const link=exactPaymentUrl(json.result?.payment_link);
  return Object.freeze({...ack,provisional_payment_link:link,
   native_order_total_verified:false,payment_verified:false});
 }
 if(json?.result?.payment_link)
  invalid('R135_PRE_FINAL_LINK_EXPOSURE_NOT_ALLOWED');
 return Object.freeze({...ack,provisional_payment_link:null});
}
function createPaymentLinkTransport({keyProvider,fetchImpl=globalThis.fetch,
 allowProviderNetwork=false,endpoint=ENDPOINT,timeoutMs=8000}={}) {
 if(typeof keyProvider!=='function'||typeof fetchImpl!=='function'||
   endpoint!==ENDPOINT||!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>15000)
  invalid('R135_TRANSPORT_DEPENDENCIES_OR_ENDPOINT_INVALID');
 return Object.freeze({
  async send({payload,dealNumber,previousDealId=null,isFinal=false}={}) {
   if(!allowProviderNetwork)
    invalid('R135_PROVIDER_NETWORK_DISABLED');
   if(Boolean(isFinal)!==(payload?.system?.return_payment_link===1))
    invalid('R135_FINAL_REQUEST_FLAG_MISMATCH');
   const body=encodePostBody(payload,await keyProvider());
   let response;
   try {
    response=await fetchImpl(endpoint,{
     method:'POST',redirect:'error',headers:{
      'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'
     },body,signal:AbortSignal.timeout(timeoutMs)});
    if(response?.status!==200)invalid('R135_PROVIDER_HTTP_FAILURE');
    const text=await response.text();
    if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>16384)
      invalid('R135_PROVIDER_RESPONSE_TOO_LARGE');
    return normalizeStepResponse(JSON.parse(text),{dealNumber,previousDealId,isFinal});
   } catch {
    // Once a provider POST was attempted, unknown response must NEVER cause
    // automated replay of that Offer. R130 step ledger handles UNKNOWN hold.
    invalid('R135_PROVIDER_RESULT_UNKNOWN_DO_NOT_RETRY');
   }
  }
 });
}
function releaseAfterNativeOrderReadback({
 plan,dealNumber,dealId,buyerId,readback,finalAck,consentAttestation
}={}) {
 const fail=(code)=>Object.freeze({ok:false,code,checkout_url:null,
   payment_verified:false,receipt_verified:false});
 if(consentAttestation?.source!=='GETCOURSE_NATIVE_ORDER_CONSENT_VERIFIED'||
    consentAttestation?.deal_id!==dealId||
    consentAttestation?.deal_number!==dealNumber||
    consentAttestation?.consent_accepted!==true)
   return fail('R135_NATIVE_ORDER_SPECIFIC_CONSENT_UNVERIFIED');
 if(!finalAck||finalAck.import_acknowledged!==true||
    finalAck.deal_number!==dealNumber||
    finalAck.deal_id!==dealId||!finalAck.provisional_payment_link)
   return fail('R135_FINAL_PROVIDER_ACK_MISSING');
 let url;
 try{url=exactPaymentUrl(finalAck.provisional_payment_link)}
 catch{return fail('R135_PROVIDER_PAYMENT_LINK_INVALID')}
 const proof=validateAssembledOrder({plan,dealNumber,dealId,buyerId,readback});
 if(proof.native_order_positions_verified!==true||
    proof.order_total_rub!==plan?.desired_order_total_rub)
   return fail(proof.code||'R135_NATIVE_UNPAID_LINES_NOT_VERIFIED');
 return Object.freeze({
  ok:true,checkout_url:url,deal_number:dealNumber,deal_id:dealId,
  order_total_rub:proof.order_total_rub,
  native_order_positions_verified:true,consent_verified:true,
  payment_verified:false,receipt_verified:false,
  access_after_pay_days:365
 });
}
module.exports={exactPaymentUrl,finalPaymentPayload,encodePostBody,
 normalizeStepResponse,createPaymentLinkTransport,releaseAfterNativeOrderReadback};
