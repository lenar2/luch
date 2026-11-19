'use strict';
/* R136: Connect R130 durable worker to R135 final payment URL and real,
 * read-only native *unpaid* order verification. No paid receipt required.
 * Public default OFF; caller must supply owner-authorized write transport,
 * independently validated order fields/consent, and actual native readbacks.
 */
const {buildSetImportPlan}=require('./r130-set-lines.cjs');
const {AsyncLocalStorage}=require('node:async_hooks');
const {validEmail,validNonce,validSha}=require('./r130-getcourse-import.cjs');
const {releaseAfterNativeOrderReadback}=require('./r135-set-payment-link.cjs');

const REQUIRED=[
 'owner_enabled','native_order_fields_verified','provider_side_consent_enforced',
 'buyer_order_specific_consent_verified','write_api_key_owner_approved',
 'source_provider_identity_verified','owner_controlled_qa_buyer_verified',
 'provider_order_notification_behavior_owner_approved',
 // Newly required for release of a prepayment link, not for payment receipt:
 'native_unpaid_qa_order_lines_verified','payment_url_return_verified'
];
function hold(code){return Object.freeze({ok:false,code,checkout_url:null,
 public_release_allowed:false,paid_order_verified:false});}
function validBuyerEmail(email){
 return validEmail(email)&&typeof email==='string'&&!/\s/.test(email)&&
   email===email.trim()&&email.length<=254;
}
function createLot10Coordinator({quoteFn,makeWorker,transport,preflight,
 nativeOrderReadback,nativeConsentReadback,allowProviderWrites=false}={}){
 if(typeof quoteFn!=='function'||typeof makeWorker!=='function'||
    typeof transport?.send!=='function'||typeof preflight!=='function'||
    typeof nativeOrderReadback!=='function'||typeof nativeConsentReadback!=='function')
  throw Error('R136_REAL_READBACK_AND_WORKER_DEPENDENCIES_REQUIRED');
 const scope=new AsyncLocalStorage();
 const capturedTransport={
  send:async args=>{
   const state=scope.getStore();
   if(!state||!args?.payload?.deal?.offer_id)
    throw Error('R136_NATIVE_SEND_OUTSIDE_ORDER_CONTEXT');
   const num=String(args.dealNumber||'');
   if(!state.dealNumber)state.dealNumber=num;
   if(state.dealNumber!==num)throw Error('R136_DEAL_NUMBER_CHANGED');
   const final=Number(args.payload.deal.offer_id)===state.finalOfferId;
   if(final&&args.payload.system?.multiple_offers!==1)
    throw Error('R136_LAST_NATIVE_POSITION_NOT_APPEND');
   // Original R130 worker sets return_payment_link:0 on EVERY call. R136
   // promotes ONLY the canonical last Offer to a final payment-link request.
   const payload={...args.payload,system:{...args.payload.system,
    return_payment_link:final?1:0}};
   const ack=await transport.send({...args,payload,isFinal:final});
   if(final)state.finalAck=ack;
   return ack;
  }
 };
 const worker=makeWorker(capturedTransport);
 if(typeof worker?.prepare!=='function'||typeof worker?.assembleOnce!=='function')
  throw Error('R136_R130_WORKER_REQUIRED');
 async function readiness(){
  if(!allowProviderWrites)return hold('R136_PROVIDER_WRITE_DISABLED');
  let p;
  try{p=await preflight()}catch{return hold('R136_PREFLIGHT_UNAVAILABLE')}
  if(!p||REQUIRED.some(k=>p[k]!==true))
   return hold('R136_GETCOURSE_KEY_NATIVE_FIELDS_CONSENT_OR_QA_NOT_READY');
  return Object.freeze({ok:true,ready:true,
   payment_url_can_be_returned_without_paid_receipt:true,
   public_release_allowed:true,paid_order_verified:false});
 }
 async function start({selection,email,nonce,offerRevisionSha256,idempotencyKey}={}){
  const ready=await readiness();
  if(!ready.ok)return ready;
  if(!validBuyerEmail(email)||!validNonce(nonce)||!validSha(offerRevisionSha256)||
     typeof idempotencyKey!=='string'||!/^[a-f0-9]{64}$/.test(idempotencyKey))
   return hold('R136_BUYER_OR_SERVER_CONSENT_CHALLENGE_INVALID');
  let plan;
  try{plan=buildSetImportPlan({selection,quoteFn})}
  catch{return hold('R136_SET_SELECTION_INVALID')}
  // PREPARE and external writes use original R130's PG mutex/idempotency ledger.
  let prepared;
  try{prepared=await worker.prepare({selection,email,nonce,offerRevisionSha256,idempotencyKey})}
  catch{return hold('R136_PREPARE_REJECTED')}
  if(prepared?.plan?.plan_sha256!==plan.plan_sha256)
   return hold('R136_PERSISTED_PLAN_CHANGED');
  if(prepared.duplicate===true&&prepared.status?.state==='ALL_IMPORT_ACKED_HOLD_NATIVE_READBACK')
   return hold('R136_EXISTING_ORDER_NEEDS_NATIVE_RECOVERY_NO_RESEND');
  // Each request has an independent asynchronous capture context; concurrent
  // buyers can never see one another's provisional payment links.
  const capture={dealNumber:null,finalOfferId:plan.lines.at(-1).offer_id,finalAck:null};
  return scope.run(capture,async()=>{try{
   const assembled=await worker.assembleOnce({idempotencyKey,selection,email,nonce,offerRevisionSha256});
   if(assembled?.state!=='ALL_IMPORT_ACKED_HOLD_NATIVE_READBACK')
    return hold('R136_ORDER_NOT_FULLY_ACKNOWLEDGED');
   const activeDeal=String(assembled.deal_number||'');
   if(!/^[0-9]{10,18}$/.test(activeDeal))
    return hold('R136_NATIVE_DEAL_NUMBER_MISSING');
   const finalAck=capture.finalAck;
   if(capture.dealNumber!==activeDeal)
    return hold('R136_UNBOUND_FINAL_ACK_NO_RETRY');
   if(!finalAck?.provisional_payment_link)
    return hold('R136_FINAL_PAYMENT_URL_NOT_OBSERVED_NO_RETRY');
   const actual=await nativeOrderReadback({
    plan,dealNumber:activeDeal,dealId:finalAck.deal_id,
    email,nonce,idempotencyKey
   });
   const consent=await nativeConsentReadback({
    plan,dealNumber:activeDeal,dealId:finalAck.deal_id,
    email,nonce,offerRevisionSha256,idempotencyKey
   });
   const verdict=releaseAfterNativeOrderReadback({
    plan,dealNumber:activeDeal,dealId:finalAck.deal_id,
    buyerId:String(actual?.buyerId||''),
    readback:actual?.order,
    finalAck,consentAttestation:consent
   });
   return verdict.ok?Object.freeze({...verdict,public_release_allowed:true}):
    hold(verdict.code||'R136_NATIVE_READBACK_UNVERIFIED');
  }catch{return hold('R136_PROVIDER_OR_NATIVE_READBACK_UNKNOWN_MANUAL_RECOVERY')}
  });
 }
 return Object.freeze({readiness,start});
}
module.exports={REQUIRED,hold,validBuyerEmail,createLot10Coordinator};
