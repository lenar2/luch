'use strict';
/**
 * R115 reconcile a trusted-relay HINT with independently read-back, signed
 * GetCourse order/receipt/grants. This module never creates a payment/grant.
 * No short-lived browser order token is required at payment time: it binds
 * to the durable original order and payload SHA in PostgreSQL instead.
 */
const {verifyProviderEvidenceBundle,assertLiveProviderEvidence}=require('./native-provider-evidence.cjs');
const {verifyIndependentReview,assertReviewMatchesEvidence,buildOrderPayloadFromPlan}=require('./native-order-site-integration.cjs');
const {validatePaidGrantReadback,sha256}=require('./native-order-execution-contract.cjs');
const {SOURCE}=require('./provider-relay-webhook.cjs');
function fail(code){const e=new Error(code);e.code=code;throw e;}
function createPaidReconciler({adapter,checkoutStore,providerProofLoader,providerKeys,reviewerKeys,nowMs=()=>Date.now()}={}){
 if(typeof adapter?.plan!=='function'||typeof checkoutStore?.getByProviderOrder!=='function'||
   typeof checkoutStore?.recordPaidVerification!=='function'||
   typeof providerProofLoader?.readNativePaidEvidence!=='function'||!providerKeys||!reviewerKeys)
  fail('PAID_RECONCILER_TRUSTED_DEPENDENCIES_REQUIRED');
 return async function reconcile(event){
  if(!event||event.source!==SOURCE||typeof event.provider_order_id!=='string')
   fail('RECONCILE_TRUSTED_INBOX_RECORD_REQUIRED');
  if(event.status_hint!=='PAID')return {
   status:'HOLD_NON_PAYMENT_EVENT',payment_verified:false,grants_recorded:0,external_grants_issued:0};
  // Read durable original order association, not caller-provided prices, IDs or tokens.
  const record=await checkoutStore.getByProviderOrder(event.provider_order_id);
  if(!record||record.state!=='ORDER_CREATED'||record.provider_order_id!==event.provider_order_id||
     typeof record.checkout_idempotency_key!=='string'||!/^[a-f0-9]{32}$/.test(record.checkout_idempotency_key))
   fail('UNKNOWN_OR_UNCOMMITTED_NATIVE_ORDER');
  const plan=adapter.plan({kind:'set',items:['rejection_program','union']});
  if(record.selection_sha256!==sha256(plan))fail('DURABLE_SELECTION_HASH_MISMATCH');
  const expected=buildOrderPayloadFromPlan(plan,record.checkout_idempotency_key);
  if(record.trusted_order_payload_sha256!==sha256(expected))fail('DURABLE_PAYLOAD_HASH_MISMATCH');
  const proof=await providerProofLoader.readNativePaidEvidence({
   provider_order_id:event.provider_order_id
  });
  if(!proof||!proof.bundle||!proof.artifacts||!proof.independentReview)
   fail('INDEPENDENT_NATIVE_PROVIDER_PROOF_MISSING');
  const evidence=verifyProviderEvidenceBundle({
   bundle:proof.bundle,artifacts:proof.artifacts,trustedKeys:providerKeys,nowMs:nowMs()
  });
  assertLiveProviderEvidence(evidence);
  if(evidence.order.provider_order_id!==event.provider_order_id||evidence.order.status!=='PAID')
   fail('PROVIDER_ORDER_STATUS_ID_MISMATCH');
  const review=verifyIndependentReview({
   review:proof.independentReview,evidenceBundle:proof.bundle,reviewerKeys,nowMs:nowMs()
  });
  assertReviewMatchesEvidence(review,evidence);
  const validated=validatePaidGrantReadback(evidence.order,evidence);
  if(validated.paid_total_rub!==11690||validated.grant_count!==2)
   fail('NATIVE_PAID_AMOUNT_OR_GRANTS_INVALID');
  const ledger=await checkoutStore.recordPaidVerification({
   checkoutIdempotencyKey:record.checkout_idempotency_key,
   providerOrderId:validated.provider_order_id,
   paidEventId:validated.paid_event_id,
   payloadSha256:record.trusted_order_payload_sha256,
   paidReadbackSha256:sha256(evidence.artifact_sha256),
   evidenceRef:evidence.artifact_refs.order_json,paidTotalRub:11690
  });
  if(!['RECORDED','REPLAY'].includes(ledger?.status))fail('PAID_LEDGER_COMMIT_INVALID');
  return {status:'NATIVE_PAYMENT_AND_TWO_GRANTS_VERIFIED',
   provider_order_id:validated.provider_order_id,paid_event_id:validated.paid_event_id,
   amount_rub:11690,receipt_tax_verified:true,offer_terms_verified:true,
   grant_count:2,grant_start:'AFTER_PAY',grant_duration_days:365,
   grant_writes:0,checkout_url:null,
   duplicate_ledger_result:ledger.status,
   release_allowed:false}; // owner release is a separate decision
 }
}
module.exports={createPaidReconciler};
