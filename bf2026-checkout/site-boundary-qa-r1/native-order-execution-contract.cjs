'use strict';
const crypto=require('node:crypto');
const contract=require('./native-order-execution-contract.json');
const EXPECTED=contract.required_native_order;
const {verifyProviderEvidenceBundle,assertLiveProviderEvidence,buildNativeMultiOfferCapability}=require('./native-provider-evidence.cjs');

function fail(code){const e=new Error(code);e.code=code;throw e}
function canonical(x){
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(x&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype)
  return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 if(x===null||['string','number','boolean'].includes(typeof x))return JSON.stringify(x);
 return fail('NON_CANONICAL_VALUE');
}
function sha256(x){return crypto.createHash('sha256').update(typeof x==='string'?x:canonical(x)).digest('hex')}
function isHex(x,n=32){return typeof x==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(x)}
function same(a,b){return canonical(a)===canonical(b)}
function expectedPlanLines(plan){
 return (plan.lines||[]).map(l=>({
  selection_key:l.line_key,offer_id:l.offer_ids?.[0],product_id:l.product_ids?.[0],training_id:l.training_ids?.[0],
  base_price_rub:l.base_price_rub,quantity:1,grant_start:l.grant?.start,access_days:l.grant?.duration_days
 })).sort((a,b)=>a.offer_id-b.offer_id);
}
function assertExpectedPlan(plan){
 if(!plan||plan.ready_for_native_binding!==true||!Array.isArray(plan.blockers)||plan.blockers.length)fail('NATIVE_MAPPING_HOLD');
 if(plan.selection_key!==EXPECTED.selection_key)fail('UNEXPECTED_SELECTION_KEY');
 if(!same(expectedPlanLines(plan),EXPECTED.lines.map(l=>({...l,quantity:1})).sort((a,b)=>a.offer_id-b.offer_id)))
  fail('NATIVE_GRANT_OR_LINE_MAPPING_MISMATCH');
 if(plan.quote?.currency!=='RUB'||plan.quote?.subtotal_rub!==EXPECTED.subtotal_rub||
    plan.quote?.discount_percent!==EXPECTED.discount_percent||plan.quote?.total_rub!==EXPECTED.amount_due_rub)
  fail('R109_QUOTE_BINDING_MISMATCH');
}
function sealSignedSelection({adapter,input,secret,checkoutIdempotencyKey,now=Math.floor(Date.now()/1000),ttlSeconds=300,nonce}){
 if(!adapter||typeof adapter.plan!=='function')fail('TRUSTED_R109_ADAPTER_REQUIRED');
 if(!Buffer.isBuffer(secret)||secret.length<32)fail('SERVER_HMAC_SECRET_REQUIRED');
 if(!isHex(checkoutIdempotencyKey,32))fail('BAD_CHECKOUT_IDEMPOTENCY_KEY');
 if(!Number.isSafeInteger(now)||!Number.isInteger(ttlSeconds)||ttlSeconds<30||ttlSeconds>300)fail('BAD_SELECTION_TTL');
 const n=nonce||crypto.randomBytes(16).toString('hex');
 if(!isHex(n,32))fail('BAD_SELECTION_NONCE');
 const plan=adapter.plan(input);assertExpectedPlan(plan);
 const payload={schema:'bf2026.native.selection.v1',scope:'INTERNAL_NATIVE_ORDER_CANDIDATE_ONLY',
  checkout_idempotency_key:checkoutIdempotencyKey,nonce:n,issued_at:now,expires_at:now+ttlSeconds,
  selection_key:plan.selection_key,plan};
 const raw=Buffer.from(canonical(payload)).toString('base64url');
 const mac=crypto.createHmac('sha256',secret).update('v1.'+raw).digest('base64url');
 return 'v1.'+raw+'.'+mac;
}
function verifySignedSelection({adapter,token,secret,now=Math.floor(Date.now()/1000)}){
 if(!Buffer.isBuffer(secret)||secret.length<32)fail('SERVER_HMAC_SECRET_REQUIRED');
 if(typeof token!=='string'||token.length>24000||!/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))fail('BAD_SELECTION_TOKEN');
 const [v,raw,mac]=token.split('.');
 const supplied=Buffer.from(mac,'base64url');
 const expected=crypto.createHmac('sha256',secret).update(v+'.'+raw).digest();
 if(supplied.toString('base64url')!==mac||Buffer.from(raw,'base64url').toString('base64url')!==raw||
    supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))fail('TAMPERED_SELECTION_TOKEN');
 let payload;try{payload=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'))}catch{fail('BAD_SELECTION_TOKEN')};
 if(payload.schema!=='bf2026.native.selection.v1'||payload.scope!=='INTERNAL_NATIVE_ORDER_CANDIDATE_ONLY'||
    !isHex(payload.checkout_idempotency_key,32)||!isHex(payload.nonce,32)||
    !Number.isSafeInteger(payload.issued_at)||!Number.isSafeInteger(payload.expires_at)||
    payload.expires_at<=payload.issued_at||payload.expires_at-payload.issued_at>300||
    payload.issued_at>now+30||payload.expires_at<=now||payload.selection_key!==EXPECTED.selection_key)
  fail('EXPIRED_OR_INVALID_SELECTION');
 const rerun=adapter.plan(payload.plan?.selection);assertExpectedPlan(rerun);
 if(sha256(rerun)!==sha256(payload.plan))fail('STALE_R109_PLAN_OR_MAPPING');
 return payload;
}
function assessNativeWidgetPair(evidence){
 const widgets=evidence?.widgets||[];
 const forms=widgets.map(w=>w.iframe?.form||{});
 const ids=widgets.map(w=>Number(w.offer_inputs?.[0]?.value||w.iframe?.offer_inputs?.[0]?.value||0)).filter(Boolean);
 const oneRadioEach=widgets.length===2&&widgets.every(w=>{
  const i=w.iframe||{};
  return i.offer_input_count===1&&i.offer_inputs?.length===1&&i.offer_inputs[0].type==='radio'&&i.offer_inputs[0].checked===true;
 });
 const distinctActions=new Set(forms.map(f=>f.action_id)).size===2;
 return {native_forms_observed:widgets.length,one_checked_radio_per_form:oneRadioEach,
  distinct_form_action_ids:distinctActions,observed_offer_ids:ids.sort((a,b)=>a-b),
  one_native_form_with_both_offers:false,multi_offer_selection_transfer_verified:false,
  native_two_line_order_verified:false,
  classification:'TWO_DISTINCT_NATIVE_SINGLE_OFFER_FORMS_NOT_ONE_MULTI_OFFER_FORM'};
}
function assertNativeMultiOfferCapability(capability,plan,{trustedKeys,nowMs=Date.now()}={}){
 assertExpectedPlan(plan);
 if(!capability?.evidence_bundle||!capability?.evidence_artifacts||!trustedKeys)
  fail('NATIVE_PROVIDER_EVIDENCE_BUNDLE_REQUIRED');
 const evidence=verifyProviderEvidenceBundle({
  bundle:capability.evidence_bundle,artifacts:capability.evidence_artifacts,trustedKeys,nowMs
 });
 assertLiveProviderEvidence(evidence);
 if(evidence.order.status!=='UNPAID')fail('NATIVE_UNPAID_TWO_LINE_ORDER_REQUIRED');
 if(capability.independent_reviewed!==true)fail('NATIVE_MULTI_OFFER_INDEPENDENT_REVIEW_REQUIRED');
 const derived=buildNativeMultiOfferCapability(evidence);
 if(!same(derived.form_offer_ids,EXPECTED.lines.map(x=>x.offer_id).sort((a,b)=>a-b))||
    !same(derived.native_order_offer_ids,EXPECTED.lines.map(x=>x.offer_id).sort((a,b)=>a-b)))
  fail('NATIVE_MULTI_OFFER_IDS_NOT_PROVEN');
 return {...derived,independent_reviewed:true};
}
function classifyExistingReservation(row,selectionSha256,nowMs=Date.now()){
 if(!row)return 'NEW';
 if(row.selection_sha256!==selectionSha256)return 'CONFLICT';
 if(row.state==='ORDER_CREATED')return 'COMMITTED';
 if(row.state==='PROVIDER_SUBMITTING'||row.state==='PROVIDER_OUTCOME_UNKNOWN')return 'OUTCOME_UNKNOWN';
 if(row.state==='RESERVED'){
  const expiry=new Date(row.lease_expires_at).getTime();
  return Number.isFinite(expiry)&&expiry<=nowMs?'RECLAIM':'IN_PROGRESS';
 }
 return 'OUTCOME_UNKNOWN';
}
function validateNativeUnpaidOrderReadback(order,plan,evidence){
 assertExpectedPlan(plan);
 if(!order||typeof order!=='object')fail('NATIVE_UNPAID_ORDER_READBACK_REQUIRED');
 assertLiveProviderEvidence(evidence);
 if(evidence.order.status!=='UNPAID'||evidence.order.provider_order_id!==order.provider_order_id||
    !same(evidence.order,order))fail('NATIVE_ORDER_READBACK_EVIDENCE_MISMATCH');
 if(order.status!=='UNPAID'||order.currency!=='RUB'||order.subtotal_rub!==EXPECTED.subtotal_rub||
    order.discount_percent!==EXPECTED.discount_percent||order.discount_rub!==EXPECTED.discount_rub||
    order.amount_due_rub!==EXPECTED.amount_due_rub)fail('NATIVE_UNPAID_ORDER_TOTAL_OR_STATUS_MISMATCH');
 if(!Array.isArray(order.lines)||order.lines.length!==2)fail('EXACT_TWO_NATIVE_LINES_REQUIRED');
 const lines=[...order.lines].sort((a,b)=>a.offer_id-b.offer_id);
 const expected=[...EXPECTED.lines].sort((a,b)=>a.offer_id-b.offer_id);
 for(let i=0;i<2;i++)for(const k of ['offer_id','product_id','training_id','base_price_rub','quantity'])
  if(lines[i]?.[k]!==expected[i][k])fail('NATIVE_UNPAID_LINE_MISMATCH_'+i+'_'+k);
 if(Array.isArray(order.grants)&&order.grants.length)fail('GRANTS_BEFORE_CONFIRMED_PAYMENT');
 return {valid:true,provider_order_id:order.provider_order_id,status:'UNPAID',
  amount_due_rub:EXPECTED.amount_due_rub,line_count:2,evidence_class:evidence.evidence_class,
  provider_order_status:'VALIDATED_SITE_ENGINEER_ATTESTED_NATIVE_READBACK'};
}
function buildGrantPlan(plan){
 assertExpectedPlan(plan);
 return EXPECTED.lines.map(l=>({offer_id:l.offer_id,product_id:l.product_id,training_id:l.training_id,
  trigger:'CONFIRMED_PAID_EVENT_ONLY',start:'AFTER_PAY',duration_days:365}));
}
function validatePaidGrantReadback(order,evidence){
 if(!order||order.status!=='PAID'||order.paid_total_rub!==EXPECTED.paid_total_rub||
   typeof order.provider_order_id!=='string'||!order.provider_order_id)fail('PAID_NATIVE_ORDER_REQUIRED');
 assertLiveProviderEvidence(evidence);
 if(evidence.order.status!=='PAID'||evidence.order.provider_order_id!==order.provider_order_id||
    !same(evidence.order,order))fail('PAID_NATIVE_ORDER_EVIDENCE_MISMATCH');
 if(order.currency!=='RUB'||order.subtotal_rub!==EXPECTED.subtotal_rub||
    order.discount_percent!==EXPECTED.discount_percent||order.discount_rub!==EXPECTED.discount_rub)
  fail('PAID_NATIVE_ORDER_TOTAL_MISMATCH');
 if(!Array.isArray(order.lines)||order.lines.length!==2)fail('EXACT_TWO_PAID_LINES_REQUIRED');
 const lines=[...order.lines].sort((a,b)=>a.offer_id-b.offer_id);
 const expectedLines=[...EXPECTED.lines].sort((a,b)=>a.offer_id-b.offer_id);
 for(let i=0;i<2;i++)for(const k of ['offer_id','product_id','training_id','base_price_rub','quantity'])
  if(lines[i]?.[k]!==expectedLines[i][k])fail('PAID_NATIVE_LINE_MISMATCH_'+i+'_'+k);
 if(!Array.isArray(order.grants)||order.grants.length!==2)fail('EXACT_TWO_PAID_GRANTS_REQUIRED');
 const grants=[...order.grants].sort((a,b)=>a.training_id-b.training_id);
 const expected=[...EXPECTED.lines].sort((a,b)=>a.training_id-b.training_id);
 const paidEvent=grants[0]?.paid_event_id;
 if(!paidEvent||grants.some(g=>g.paid_event_id!==paidEvent)||order.payment_event_id!==paidEvent)
  fail('GRANTS_NOT_BOUND_TO_SAME_PAID_EVENT');
 for(let i=0;i<2;i++){
  const g=grants[i],e=expected[i];
  if(g.provider_order_id!==order.provider_order_id||g.training_id!==e.training_id||
    g.product_id!==e.product_id||g.offer_id!==e.offer_id||g.duration_days!==365||
    g.start!=='AFTER_PAY'||g.status!=='GRANTED')fail('PAID_GRANT_MAPPING_MISMATCH_'+i);
 }
 if(!order.receipt?.receipt_id||order.receipt?.tax_readback!==true)fail('FISCAL_RECEIPT_OR_TAX_MISSING');
 if(order.consent?.offer_terms_accepted!==true)fail('OFFER_TERMS_CONSENT_MISSING');
 if(order.duplicate_guard?.verified!==true||order.duplicate_guard?.negative_test_passed!==true)
  fail('DUPLICATE_GUARD_NOT_PROVEN');
 return {valid:true,provider_order_id:order.provider_order_id,paid_event_id:paidEvent,
  paid_total_rub:EXPECTED.paid_total_rub,grant_count:2,evidence_class:evidence.evidence_class,
  provider_order_status:'VALIDATED_SITE_ENGINEER_ATTESTED_PAID_READBACK'};
}
async function withTransaction(pool,fn){
 const client=await pool.connect();
 try{await client.query('BEGIN');const value=await fn(client);await client.query('COMMIT');return value;}
 catch(e){try{await client.query('ROLLBACK')}catch{}throw e;}
 finally{client.release?.();}
}
function createPostgresIdempotencyStore(pool){
 if(!pool||typeof pool.connect!=='function')fail('POSTGRES_POOL_REQUIRED');
 return {
  async reserve({checkoutIdempotencyKey,selectionSha256,ownerToken,leaseSeconds=90}){
   if(!isHex(checkoutIdempotencyKey,32)||!isHex(selectionSha256,64)||!isHex(ownerToken,32))fail('BAD_IDEMPOTENCY_RESERVATION');
   return withTransaction(pool,async c=>{
    const ins=await c.query(
     "INSERT INTO bf2026_native_checkout_idempotency(scope,checkout_idempotency_key,selection_sha256,state,lease_owner,lease_expires_at) VALUES('BF2026',$1,$2,'RESERVED',$3,now()+($4 * interval '1 second')) ON CONFLICT(scope,checkout_idempotency_key) DO NOTHING RETURNING state",
     [checkoutIdempotencyKey,selectionSha256,ownerToken,leaseSeconds]);
    if(ins.rowCount)return {status:'NEW'};
    const q=await c.query("SELECT selection_sha256,state,lease_expires_at,provider_order_id FROM bf2026_native_checkout_idempotency WHERE scope='BF2026' AND checkout_idempotency_key=$1 FOR UPDATE",[checkoutIdempotencyKey]);
    const row=q.rows?.[0];if(!row)fail('IDEMPOTENCY_ROW_DISAPPEARED');
    const classification=classifyExistingReservation(row,selectionSha256,Date.now());
    if(classification==='CONFLICT')return {status:'CONFLICT'};
    if(classification==='COMMITTED')return {status:'COMMITTED',provider_order_id:row.provider_order_id};
    if(classification==='OUTCOME_UNKNOWN')return {status:'OUTCOME_UNKNOWN'};
    if(classification==='IN_PROGRESS')return {status:'IN_PROGRESS'};
    const upd=await c.query("UPDATE bf2026_native_checkout_idempotency SET lease_owner=$2,lease_expires_at=now()+($3 * interval '1 second'),updated_at=now() WHERE scope='BF2026' AND checkout_idempotency_key=$1 AND state='RESERVED' AND lease_expires_at<=now() RETURNING state",[checkoutIdempotencyKey,ownerToken,leaseSeconds]);
    return upd.rowCount?{status:'NEW'}:{status:'IN_PROGRESS'};
   });
  },
  async markSubmitting({checkoutIdempotencyKey,ownerToken}){
   const r=await pool.query("UPDATE bf2026_native_checkout_idempotency SET state='PROVIDER_SUBMITTING',provider_started_at=now(),updated_at=now() WHERE scope='BF2026' AND checkout_idempotency_key=$1 AND state='RESERVED' AND lease_owner=$2",[checkoutIdempotencyKey,ownerToken]);
   if(r.rowCount!==1)fail('IDEMPOTENCY_RESERVATION_LOST');
  },
  async commit({checkoutIdempotencyKey,ownerToken,providerOrderId,orderReadbackSha256,evidenceRef}){
   const r=await pool.query("UPDATE bf2026_native_checkout_idempotency SET state='ORDER_CREATED',provider_order_id=$3,order_readback_sha256=$4,evidence_ref=$5,updated_at=now() WHERE scope='BF2026' AND checkout_idempotency_key=$1 AND state='PROVIDER_SUBMITTING' AND lease_owner=$2",[checkoutIdempotencyKey,ownerToken,providerOrderId,orderReadbackSha256,evidenceRef]);
   if(r.rowCount!==1)fail('IDEMPOTENCY_COMMIT_FAILED');
  },
  async markOutcomeUnknown({checkoutIdempotencyKey,ownerToken,errorCode}){
   const r=await pool.query("UPDATE bf2026_native_checkout_idempotency SET state='PROVIDER_OUTCOME_UNKNOWN',last_error_code=$3,updated_at=now() WHERE scope='BF2026' AND checkout_idempotency_key=$1 AND state='PROVIDER_SUBMITTING' AND lease_owner=$2",[checkoutIdempotencyKey,ownerToken,String(errorCode||'UNKNOWN').slice(0,120)]);
   if(r.rowCount!==1)fail('IDEMPOTENCY_UNKNOWN_MARK_FAILED');
  },
  async reconcileCreated({checkoutIdempotencyKey,selectionSha256,providerOrderId,orderReadbackSha256,evidenceRef}){
   if(!evidenceRef||!isHex(selectionSha256,64)||!isHex(orderReadbackSha256,64)||typeof providerOrderId!=='string'||!providerOrderId.trim())fail('RECONCILIATION_EVIDENCE_REQUIRED');
   const r=await pool.query("UPDATE bf2026_native_checkout_idempotency SET state='ORDER_CREATED',provider_order_id=$3,order_readback_sha256=$4,evidence_ref=$5,updated_at=now() WHERE scope='BF2026' AND checkout_idempotency_key=$1 AND selection_sha256=$2 AND state='PROVIDER_OUTCOME_UNKNOWN'",[checkoutIdempotencyKey,selectionSha256,providerOrderId,orderReadbackSha256,evidenceRef]);
   if(r.rowCount!==1)fail('IDEMPOTENCY_RECONCILIATION_FAILED');
  }
 };
}
// Internal execution primitive. Production caller must pass the independently verified capability gate first.
async function executeProviderSubmissionAfterReservation({payload,capability,idempotencyStore,provider,ownerToken,
 evidenceTrustStore,nowMs=Date.now()}){
 await idempotencyStore.markSubmitting({checkoutIdempotencyKey:payload.checkout_idempotency_key,ownerToken});
 try{
  const providerResult=await provider.createNativeOrder({
   nativePublicFormUrl:capability.native_public_form_url,
   nativeFormActionUrl:capability.native_form_action_url,
   offerIds:EXPECTED.lines.map(l=>l.offer_id),
   selectionField:'formParams[offer_id][]',
   amountDueRub:EXPECTED.amount_due_rub,
   checkoutIdempotencyKey:payload.checkout_idempotency_key
  });
  const evidence=verifyProviderEvidenceBundle({
   bundle:providerResult?.evidence_bundle,artifacts:providerResult?.evidence_artifacts,
   trustedKeys:evidenceTrustStore,nowMs
  });
  assertLiveProviderEvidence(evidence);
  const order=evidence.order;
  const valid=validateNativeUnpaidOrderReadback(order,payload.plan,evidence);
  await idempotencyStore.commit({
   checkoutIdempotencyKey:payload.checkout_idempotency_key,ownerToken,
   providerOrderId:order.provider_order_id,orderReadbackSha256:sha256(evidence.artifact_sha256),
   evidenceRef:evidence.artifact_refs.order_json
  });
  return {status:'NATIVE_UNPAID_ORDER_CREATED',provider_order_id:valid.provider_order_id,
   amount_due_rub:valid.amount_due_rub,evidence_class:evidence.evidence_class};
 }catch(e){
  await idempotencyStore.markOutcomeUnknown({
   checkoutIdempotencyKey:payload.checkout_idempotency_key,ownerToken,errorCode:e.code||e.message
  }).catch(()=>{});
  fail('PROVIDER_OUTCOME_UNKNOWN');
 }
}
async function submitSignedSelection({adapter,token,secret,now,capability,idempotencyStore,provider,
 evidenceTrustStore,nowMs=Date.now()}){
 const payload=verifySignedSelection({adapter,token,secret,now});
 const validatedCapability=assertNativeMultiOfferCapability(capability,payload.plan,{trustedKeys:evidenceTrustStore,nowMs});
 if(!idempotencyStore||!['reserve','markSubmitting','commit','markOutcomeUnknown'].every(k=>typeof idempotencyStore[k]==='function'))
  fail('DURABLE_IDEMPOTENCY_STORE_REQUIRED');
 if(!provider||provider.name!=='GetCourse'||typeof provider.createNativeOrder!=='function')
  fail('VERIFIED_GETCOURSE_NATIVE_ORDER_DRIVER_REQUIRED');
 const ownerToken=crypto.randomBytes(16).toString('hex');
 const selectionSha256=sha256(payload.plan);
 const reservation=await idempotencyStore.reserve({checkoutIdempotencyKey:payload.checkout_idempotency_key,selectionSha256,ownerToken});
 if(reservation.status==='COMMITTED')return {status:'REPLAY_EXISTING_ORDER',provider_order_id:reservation.provider_order_id};
 if(reservation.status==='CONFLICT')fail('IDEMPOTENCY_KEY_PAYLOAD_CONFLICT');
 if(reservation.status==='OUTCOME_UNKNOWN')fail('PROVIDER_OUTCOME_RECONCILIATION_REQUIRED');
 if(reservation.status==='IN_PROGRESS')fail('IDEMPOTENT_SUBMISSION_IN_PROGRESS');
 if(reservation.status!=='NEW')fail('IDEMPOTENCY_RESERVATION_REJECTED');
 return executeProviderSubmissionAfterReservation({
  payload,capability:validatedCapability,idempotencyStore,provider,ownerToken,evidenceTrustStore,nowMs
 });
}
async function reconcileUnknownProviderOutcome({adapter,token,secret,now,idempotencyStore,
 evidenceBundle,evidenceArtifacts,evidenceTrustStore,nowMs=Date.now()}){
 const payload=verifySignedSelection({adapter,token,secret,now});
 const evidence=verifyProviderEvidenceBundle({
  bundle:evidenceBundle,artifacts:evidenceArtifacts,trustedKeys:evidenceTrustStore,nowMs
 });
 assertLiveProviderEvidence(evidence);
 const valid=validateNativeUnpaidOrderReadback(evidence.order,payload.plan,evidence);
 if(typeof idempotencyStore?.reconcileCreated!=='function')fail('IDEMPOTENCY_RECONCILIATION_STORE_REQUIRED');
 await idempotencyStore.reconcileCreated({
  checkoutIdempotencyKey:payload.checkout_idempotency_key,selectionSha256:sha256(payload.plan),
  providerOrderId:valid.provider_order_id,orderReadbackSha256:sha256(evidence.artifact_sha256),
  evidenceRef:evidence.artifact_refs.order_json
 });
 return {status:'RECONCILED_EXISTING_NATIVE_ORDER',provider_order_id:valid.provider_order_id,
  amount_due_rub:valid.amount_due_rub,evidence_class:evidence.evidence_class};
}
module.exports={sealSignedSelection,verifySignedSelection,assessNativeWidgetPair,assertNativeMultiOfferCapability,
 classifyExistingReservation,validateNativeUnpaidOrderReadback,buildGrantPlan,validatePaidGrantReadback,
 createPostgresIdempotencyStore,submitSignedSelection,reconcileUnknownProviderOutcome,canonical,sha256,
 ...(process.env.NODE_ENV==='test'?{executeProviderSubmissionAfterReservation}: {})};

