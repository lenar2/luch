'use strict';
/**
 * BF2026 R112 site ↔ native GetCourse order boundary.
 *
 * This module creates a trusted server order payload for the one required
 * two-item set (Lot5 + Union). It DOES NOT invent a GetCourse API or submit
 * native forms. A provider driver must be supplied by the site engineer and
 * must return signed native form/order evidence. Missing capability/driver
 * fails closed before a provider write.
 */
const crypto=require('node:crypto');
const {
 sealSignedSelection,verifySignedSelection,validateNativeUnpaidOrderReadback,
 validatePaidGrantReadback,buildGrantPlan,createPostgresIdempotencyStore,
 canonical,sha256
}=require('./native-order-execution-contract.cjs');
const {
 verifyProviderEvidenceBundle,assertLiveProviderEvidence,buildNativeMultiOfferCapability
}=require('./native-provider-evidence.cjs');
const {quoteGuard,allocations,ORIGINAL}=require('./provider-supported-fallback.cjs');

const SCHEMA='bf2026.getcourse.trusted-order-payload.v1';
const ENVELOPE='bf2026.getcourse.trusted-order-envelope.v1';
const REVIEW_SCHEMA='bf2026.getcourse.native-capability-review.v1';
const EXPECTED_SELECTION={kind:'set',items:['rejection_program','union']};
const EXPECTED_LINES=[
 {selection_key:'rejection_program',offer_id:8933492,product_id:4557988,training_id:936022301,base_price_rub:6990},
 {selection_key:'union',offer_id:8919715,product_id:4550895,training_id:933861292,base_price_rub:6000}
];
function fail(code){const e=new Error(code);e.code=code;throw e}
function isHex(s,n){return typeof s==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(s)}
function same(a,b){return canonical(a)===canonical(b)}
function deepFreeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v))deepFreeze(x);Object.freeze(v)}return v}
function cleanSelection(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='items,kind'||
   input.kind!=='set'||!Array.isArray(input.items)||input.items.length!==2||
   new Set(input.items).size!==2||!input.items.includes('rejection_program')||!input.items.includes('union'))
  fail('LOT5_UNION_SELECTION_ONLY_NO_CLIENT_OVERRIDES');
 return EXPECTED_SELECTION;
}
function buildOrderPayloadFromPlan(plan,checkoutIdempotencyKey){
 quoteGuard(plan);
 if(plan.selection_key!==ORIGINAL.key||plan.selection_key!=='set:rejection_program|union')fail('UNEXPECTED_SELECTION');
 const rows=allocations(plan);
 if(rows.length!==2||rows.reduce((s,x)=>s+x.discount_rub,0)!==1300||
    rows.reduce((s,x)=>s+x.alloc_price_rub,0)!==11690)fail('DISCOUNT_ALLOCATION_MISMATCH');
 const lines=rows.map(x=>({
  selection_key:x.key,offer_id:x.offer_id,product_id:x.product_id,training_id:x.training_id,
  quantity:1,unit_price_rub:x.base_price,grant:{
   trigger:'CONFIRMED_PAID_EVENT_ONLY',start:'AFTER_PAY',duration_days:365,
   offer_id:x.offer_id,product_id:x.product_id,training_id:x.training_id
  }
 }));
 const payload={
  schema:SCHEMA,provider:'GetCourse',operation:'CREATE_ONE_NATIVE_UNPAID_ORDER',
  checkout_idempotency_key:checkoutIdempotencyKey,selection_key:plan.selection_key,
  selection:EXPECTED_SELECTION,
  selection_sha256:sha256(plan),
  pricing:{
   pricing_version:plan.quote.pricing_version,currency:'RUB',
   subtotal_rub:12990,discount_percent:10,discount_rub:1300,amount_due_rub:11690,
   rounding:'R109_FINAL_TOTAL_NEAREST_10_RUB',
   discount_scope:'EXACT_TWO_ITEM_SELECTION_ONLY',
   provider_discount_mode:'ONE_NATIVE_ORDER_LEVEL_CONDITIONAL_DISCOUNT',
   provider_promotion_ref:null,provider_promotion_capability_required:true
  },
  lines,
  reconciliation:{
   internal_discount_allocation:rows.map(x=>({
    offer_id:x.offer_id,product_id:x.product_id,training_id:x.training_id,
    base_price_rub:x.base_price,discount_allocation_rub:x.discount_rub,
    reconciled_line_total_rub:x.alloc_price_rub
   })),
   allocation_method:'LARGEST_REMAINDER_BY_BASE_PRICE',
   note:'Internal reconciliation only; do not send per-line discounted prices unless the verified native provider mechanism explicitly supports them.'
  },
  consent_requirements:{offer_terms_required:true,marketing_opt_in_required:false,marketing_default_checked:false},
  grant_policy:{authority:'GETCOURSE_NATIVE_AFTER_CONFIRMED_PAYMENT',external_grant_writes:false,
   all_grants_same_provider_order:true,all_grants_same_paid_event:true,duration_days:365,start:'AFTER_PAY'},
  provenance:{pricing:'SERVER_RECOMPUTED_R109',mapping:'SERVER_VERIFIED_NATIVE_R109_ADAPTER',
   client_price_or_offer_ids_accepted:false}
 };
 return deepFreeze(payload);
}
function sealPayload(payload,{secret,now=Math.floor(Date.now()/1000),ttlSeconds=300,nonce}={}){
 if(!Buffer.isBuffer(secret)||secret.length<32)fail('SERVER_HMAC_SECRET_REQUIRED');
 if(!Number.isSafeInteger(now)||!Number.isInteger(ttlSeconds)||ttlSeconds<30||ttlSeconds>300)fail('BAD_ENVELOPE_TTL');
 const n=nonce||crypto.randomBytes(16).toString('hex');if(!isHex(n,32))fail('BAD_ENVELOPE_NONCE');
 const envelope={schema:ENVELOPE,scope:'INTERNAL_SITE_TO_NATIVE_PROVIDER_ONLY',
  issued_at:now,expires_at:now+ttlSeconds,nonce:n,payload};
 const raw=Buffer.from(canonical(envelope)).toString('base64url');
 const mac=crypto.createHmac('sha256',secret).update('bf2026.order-envelope.v1.'+raw).digest('base64url');
 return 'v1.'+raw+'.'+mac;
}
function openPayloadToken({token,secret,now=Math.floor(Date.now()/1000)}){
 if(!Buffer.isBuffer(secret)||secret.length<32)fail('SERVER_HMAC_SECRET_REQUIRED');
 if(typeof token!=='string'||token.length>24000||!/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))fail('BAD_ORDER_ENVELOPE');
 const [v,raw,mac]=token.split('.'),provided=Buffer.from(mac,'base64url');
 const expected=crypto.createHmac('sha256',secret).update('bf2026.order-envelope.v1.'+raw).digest();
 if(provided.toString('base64url')!==mac||Buffer.from(raw,'base64url').toString('base64url')!==raw||
   provided.length!==expected.length||!crypto.timingSafeEqual(provided,expected))fail('ORDER_ENVELOPE_SIGNATURE_INVALID');
 let e;try{e=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'))}catch{fail('BAD_ORDER_ENVELOPE')}
 if(e.schema!==ENVELOPE||e.scope!=='INTERNAL_SITE_TO_NATIVE_PROVIDER_ONLY'||
   !Number.isSafeInteger(e.issued_at)||!Number.isSafeInteger(e.expires_at)||e.expires_at<=e.issued_at||
   e.expires_at-e.issued_at>300||e.issued_at>now+30||e.expires_at<=now||!isHex(e.nonce,32))
  fail('ORDER_ENVELOPE_EXPIRED_OR_INVALID');
 return e;
}
function prepareTrustedOrderPayload({adapter,input,secret,checkoutIdempotencyKey,now=Math.floor(Date.now()/1000),ttlSeconds=300,nonce}){
 if(!adapter||typeof adapter.plan!=='function')fail('TRUSTED_R109_ADAPTER_REQUIRED');
 const selection=cleanSelection(input);
 const key=checkoutIdempotencyKey;
 if(!isHex(key,32))fail('CHECKOUT_IDEMPOTENCY_KEY_REQUIRED');
 const selectionToken=sealSignedSelection({adapter,input:selection,secret,checkoutIdempotencyKey:key,now,ttlSeconds,nonce});
 const signed=verifySignedSelection({adapter,token:selectionToken,secret,now});
 const payload=buildOrderPayloadFromPlan(signed.plan,key);
 return {signed_order_payload:sealPayload(payload,{secret,now,ttlSeconds,nonce}),
  checkout_idempotency_key:key,payload_sha256:sha256(payload),
  quote:{currency:'RUB',subtotal_rub:12990,discount_percent:10,discount_rub:1300,total_rub:11690},
  provider_order_status:'NOT_CREATED',route_enabled:false,checkout_url:null};
}
function verifyTrustedOrderPayload({adapter,token,secret,now=Math.floor(Date.now()/1000)}){
 if(!adapter||typeof adapter.plan!=='function')fail('TRUSTED_R109_ADAPTER_REQUIRED');
 const envelope=openPayloadToken({token,secret,now}),p=envelope.payload;
 if(!p||p.schema!==SCHEMA||p.provider!=='GetCourse'||p.operation!=='CREATE_ONE_NATIVE_UNPAID_ORDER'||
    !isHex(p.checkout_idempotency_key,32)||!isHex(p.selection_sha256,64))fail('TRUSTED_ORDER_PAYLOAD_SHAPE_INVALID');
 const selection=cleanSelection(p.selection),plan=adapter.plan(selection);
 const expected=buildOrderPayloadFromPlan(plan,p.checkout_idempotency_key);
 if(!same(expected,p))fail('TRUSTED_ORDER_PAYLOAD_STALE_OR_TAMPERED');
 return {envelope,payload:p,payload_sha256:sha256(p),plan};
}
function verifyIndependentReview({review,evidenceBundle,reviewerKeys,nowMs=Date.now(),maxAgeMs=24*60*60*1000}){
 if(!review||review.schema!==REVIEW_SCHEMA||review.provider!=='GetCourse'||
   review.scope!=='LOT5_UNION_NATIVE_MULTI_OFFER_11690'||
   review.decision!=='PASS'||typeof review.reviewer_id!=='string'||!review.reviewer_id.trim()||
   review.legal_consent_negative_test_passed!==true||review.duplicate_guard_negative_test_passed!==true||
   typeof review.legal_consent_negative_test_ref!=='string'||review.legal_consent_negative_test_ref.length<5||
   typeof review.duplicate_guard_negative_test_ref!=='string'||review.duplicate_guard_negative_test_ref.length<5)
  fail('INDEPENDENT_REVIEW_SCHEMA_INVALID');
 const at=Date.parse(review.reviewed_at);
 if(!Number.isFinite(at)||at>nowMs+5*60*1000||nowMs-at>maxAgeMs)fail('INDEPENDENT_REVIEW_STALE');
 const unsigned=Object.fromEntries(Object.entries(review).filter(([k])=>k!=='attestation'));
 const a=review.attestation,key=reviewerKeys?.[a?.key_id];
 if(!a||a.algorithm!=='Ed25519'||typeof a.signature!=='string'||!key||
   key.trust_level!=='INDEPENDENT_QA_REVIEWER'||key.usage!=='BF2026_GETCOURSE_NATIVE_CAPABILITY_REVIEW')
  fail('INDEPENDENT_REVIEW_TRUST_KEY_INVALID');
 let sig;try{sig=Buffer.from(a.signature,'base64url')}catch{fail('INDEPENDENT_REVIEW_SIGNATURE_INVALID')}
 if(sig.length!==64||sig.toString('base64url')!==a.signature||
   !crypto.verify(null,Buffer.from(canonical(unsigned)),key.publicKey,sig))fail('INDEPENDENT_REVIEW_SIGNATURE_INVALID');
 if(review.evidence_bundle_sha256!==sha256(canonical(evidenceBundle)))fail('INDEPENDENT_REVIEW_EVIDENCE_MISMATCH');
 if(!Number.isSafeInteger(review.widget_id)||!Number.isSafeInteger(review.form_action_id)||
   typeof review.provider_order_id!=='string'||!review.provider_order_id.trim())
  fail('INDEPENDENT_REVIEW_REFERENCES_MISSING');
 return deepFreeze({reviewer_id:review.reviewer_id,reviewed_at:review.reviewed_at,
  widget_id:review.widget_id,form_action_id:review.form_action_id,provider_order_id:review.provider_order_id,
  evidence_bundle_sha256:review.evidence_bundle_sha256});
}
function assertReviewMatchesEvidence(review,evidence){
 if(review.reviewer_id===evidence.attested_by)fail('INDEPENDENT_REVIEWER_MUST_DIFFER_FROM_CAPTURE_ATTESTOR');
 if(review.widget_id!==evidence.form.widget_id||review.form_action_id!==Number(evidence.form.action_id)||
   review.provider_order_id!==evidence.order.provider_order_id)fail('INDEPENDENT_REVIEW_READBACK_MISMATCH');
 return true;
}
function verifyNativeCapability({plan,evidenceBundle,evidenceArtifacts,providerKeys,independentReview,reviewerKeys,nowMs=Date.now()}){
 if(!providerKeys||!reviewerKeys)fail('NATIVE_PROVIDER_TRUST_STORES_REQUIRED');
 const evidence=verifyProviderEvidenceBundle({bundle:evidenceBundle,artifacts:evidenceArtifacts,trustedKeys:providerKeys,nowMs});
 assertLiveProviderEvidence(evidence);
 if(evidence.order.status!=='UNPAID')fail('NATIVE_UNPAID_TWO_LINE_ORDER_REQUIRED');
 if(evidence.order.consent?.offer_terms_accepted!==true)fail('OFFER_TERMS_CONSENT_MISSING');
 const review=verifyIndependentReview({review:independentReview,evidenceBundle,reviewerKeys,nowMs});
 assertReviewMatchesEvidence(review,evidence);
 const capability=buildNativeMultiOfferCapability(evidence);
 return deepFreeze({...capability,independent_reviewed:true,independent_review:review,
  evidence_bundle:evidenceBundle,evidence_artifacts:evidenceArtifacts});
}
function assertSameNativeForm(evidence,capability){
 if(evidence.form.widget_id!==capability.evidence.form.widget_id||
   evidence.form.action_id!==capability.evidence.form.action_id||
   evidence.form.public_url!==capability.evidence.form.public_url)fail('NATIVE_FORM_BINDING_CHANGED');
 return true;
}
function validateCapabilityForPayload(capability,verified){
 if(!capability||capability.independent_reviewed!==true||
   capability.native_order_id!==verified.evidence.order.provider_order_id||
   capability.native_form_action_url!==verified.evidence.form.action_url_stable||
   capability.native_public_form_url!==verified.evidence.form.public_url||
   !same(capability.form_offer_ids,[8933492,8919715])||
   !same(capability.native_order_offer_ids,[8933492,8919715]))
  fail('NATIVE_MULTI_OFFER_CAPABILITY_MISMATCH');
 return capability;
}
function validateProviderCheckoutUrl(raw){
 let u;try{u=new URL(raw)}catch{fail('PROVIDER_CHECKOUT_URL_INVALID')}
 if(u.protocol!=='https:'||u.hostname!=='study.shkola-dnv.com'||u.port||u.username||u.password||u.hash||u.pathname==='/')
  fail('PROVIDER_CHECKOUT_URL_UNTRUSTED');
 return u.toString();
}
function withTransaction(pool,fn){
 return pool.connect().then(async c=>{
  try{await c.query('BEGIN');const out=await fn(c);await c.query('COMMIT');return out}
  catch(e){try{await c.query('ROLLBACK')}catch{}throw e}
  finally{c.release?.()}
 });
}
function createNativeOrderPostgresStore(pool){
 if(!pool||typeof pool.connect!=='function'||typeof pool.query!=='function')fail('POSTGRES_POOL_REQUIRED');
 const base=createPostgresIdempotencyStore(pool);
 return {
  ...base,
  async bindPayload({checkoutIdempotencyKey,selectionSha256,payloadSha256,ownerToken}){
   if(!isHex(payloadSha256,64)||!isHex(selectionSha256,64))fail('BAD_ORDER_PAYLOAD_HASH');
   const r=await pool.query(
    "UPDATE bf2026_native_checkout_idempotency SET trusted_order_payload_sha256=$3,updated_at=now() WHERE scope='BF2026' AND checkout_idempotency_key=$1 AND selection_sha256=$4 AND state='RESERVED' AND lease_owner=$2 AND (trusted_order_payload_sha256 IS NULL OR trusted_order_payload_sha256=$3)",
    [checkoutIdempotencyKey,ownerToken,payloadSha256,selectionSha256]);
   if(r.rowCount!==1)fail('IDEMPOTENCY_PAYLOAD_BIND_FAILED');
  },
  async reconcileCreated({checkoutIdempotencyKey,selectionSha256,payloadSha256,providerOrderId,orderReadbackSha256,evidenceRef}){
   if(!isHex(selectionSha256,64)||!isHex(payloadSha256,64)||!isHex(orderReadbackSha256,64)||
     typeof providerOrderId!=='string'||!providerOrderId.trim()||typeof evidenceRef!=='string'||evidenceRef.length<5)
    fail('RECONCILIATION_EVIDENCE_REQUIRED');
   return withTransaction(pool,async c=>{
    const q=await c.query("SELECT state,selection_sha256,trusted_order_payload_sha256 FROM bf2026_native_checkout_idempotency WHERE scope='BF2026' AND checkout_idempotency_key=$1 FOR UPDATE",[checkoutIdempotencyKey]);
    const row=q.rows?.[0];
    if(!row||row.state!=='PROVIDER_OUTCOME_UNKNOWN'||row.selection_sha256!==selectionSha256||row.trusted_order_payload_sha256!==payloadSha256)
     fail('IDEMPOTENCY_RECONCILIATION_PAYLOAD_MISMATCH');
    const u=await c.query("UPDATE bf2026_native_checkout_idempotency SET state='ORDER_CREATED',provider_order_id=$3,order_readback_sha256=$4,evidence_ref=$5,updated_at=now() WHERE scope='BF2026' AND checkout_idempotency_key=$1 AND selection_sha256=$2 AND trusted_order_payload_sha256=$6 AND state='PROVIDER_OUTCOME_UNKNOWN'",[checkoutIdempotencyKey,selectionSha256,providerOrderId,orderReadbackSha256,evidenceRef,payloadSha256]);
    if(u.rowCount!==1)fail('IDEMPOTENCY_RECONCILIATION_FAILED');
    return {status:'RECONCILED',provider_order_id:providerOrderId};
   });
  },
  async recordPaidVerification({checkoutIdempotencyKey,providerOrderId,paidEventId,payloadSha256,
    paidReadbackSha256,evidenceRef,paidTotalRub=11690}){
   if(!isHex(payloadSha256,64)||!isHex(paidReadbackSha256,64)||
     typeof providerOrderId!=='string'||!providerOrderId.trim()||
     typeof paidEventId!=='string'||!paidEventId.trim()||
     typeof evidenceRef!=='string'||evidenceRef.length<5||paidTotalRub!==11690)
    fail('PAID_VERIFICATION_RECORD_INVALID');
   return withTransaction(pool,async c=>{
    const q=await c.query(
     "SELECT state,provider_order_id,trusted_order_payload_sha256 FROM bf2026_native_checkout_idempotency WHERE scope='BF2026' AND checkout_idempotency_key=$1 FOR UPDATE",
     [checkoutIdempotencyKey]);
    const row=q.rows?.[0];
    if(!row||row.state!=='ORDER_CREATED'||row.provider_order_id!==providerOrderId||
      row.trusted_order_payload_sha256!==payloadSha256)fail('PAID_EVENT_NOT_BOUND_TO_CREATED_ORDER');
    const values=[providerOrderId,paidEventId,checkoutIdempotencyKey,paidTotalRub,paidReadbackSha256,evidenceRef];
    const ins=await c.query(
     "INSERT INTO bf2026_native_checkout_paid_events(scope,provider_order_id,paid_event_id,checkout_idempotency_key,paid_total_rub,paid_readback_sha256,evidence_ref,state) VALUES('BF2026',$1,$2,$3,$4,$5,$6,'VERIFIED') ON CONFLICT DO NOTHING RETURNING provider_order_id",
     values);
    let result='RECORDED';
    if(ins.rowCount!==1){
     const old=await c.query(
      "SELECT checkout_idempotency_key,paid_total_rub,paid_readback_sha256,evidence_ref FROM bf2026_native_checkout_paid_events WHERE provider_order_id=$1 AND paid_event_id=$2 FOR UPDATE",
      [providerOrderId,paidEventId]);
     const prior=old.rows?.[0];
     if(!prior||prior.checkout_idempotency_key!==checkoutIdempotencyKey||
       Number(prior.paid_total_rub)!==paidTotalRub||prior.paid_readback_sha256!==paidReadbackSha256||
       prior.evidence_ref!==evidenceRef)fail('PAID_EVENT_IDEMPOTENCY_CONFLICT');
     result='REPLAY';
    }
    const upd=await c.query(
     "UPDATE bf2026_native_checkout_idempotency SET paid_event_id=$2,paid_readback_sha256=$3,paid_evidence_ref=$4,paid_verified_at=COALESCE(paid_verified_at,now()),updated_at=now() WHERE scope='BF2026' AND checkout_idempotency_key=$1 AND state='ORDER_CREATED' AND provider_order_id=$5 AND trusted_order_payload_sha256=$6 AND (paid_event_id IS NULL OR paid_event_id=$2)",
     [checkoutIdempotencyKey,paidEventId,paidReadbackSha256,evidenceRef,providerOrderId,payloadSha256]);
    if(upd.rowCount!==1)fail('PAID_EVENT_PARENT_UPDATE_FAILED');
    return {status:result,provider_order_id:providerOrderId,paid_event_id:paidEventId,grant_writes:0};
   });
  }
 };
}
function createNativeOrderSiteIntegration({adapter,secret,store,provider,capabilityConfig}={}){
 if(!adapter||typeof adapter.plan!=='function')fail('TRUSTED_R109_ADAPTER_REQUIRED');
 if(!Buffer.isBuffer(secret)||secret.length<32)fail('SERVER_HMAC_SECRET_REQUIRED');
 function prepare(input,opts={}){
  return prepareTrustedOrderPayload({adapter,input,secret,...opts});
 }
 function open(token,now){return verifyTrustedOrderPayload({adapter,token,secret,now})}
 async function start({signedOrderPayload,now,nowMs=Date.now()}={}){
  const verified=open(signedOrderPayload,now);
  if(!capabilityConfig)fail('NATIVE_PROVIDER_CAPABILITY_HOLD');
  const capability=verifyNativeCapability({...capabilityConfig,plan:verified.plan,nowMs});
  validateCapabilityForPayload(capability,capability);
  if(!provider||provider.name!=='GetCourse'||provider.mode!=='NATIVE_MULTI_OFFER_FORM'||
    typeof provider.createNativeOrder!=='function')fail('VERIFIED_GETCOURSE_NATIVE_ORDER_DRIVER_REQUIRED');
  const required=['reserve','bindPayload','markSubmitting','commit','markOutcomeUnknown','reconcileCreated','recordPaidVerification'];
  if(!store||required.some(k=>typeof store[k]!=='function'))fail('DURABLE_IDEMPOTENCY_STORE_REQUIRED');
  const ownerToken=crypto.randomBytes(16).toString('hex');
  const p=verified.payload,selectionSha256=sha256(verified.plan);
  const reservation=await store.reserve({checkoutIdempotencyKey:p.checkout_idempotency_key,
    selectionSha256,ownerToken});
  if(reservation.status==='COMMITTED')return {status:'REPLAY_EXISTING_ORDER',
    provider_order_id:reservation.provider_order_id,amount_due_rub:11690,checkout_url:null};
  if(reservation.status==='CONFLICT')fail('IDEMPOTENCY_KEY_PAYLOAD_CONFLICT');
  if(reservation.status==='OUTCOME_UNKNOWN')fail('PROVIDER_OUTCOME_RECONCILIATION_REQUIRED');
  if(reservation.status==='IN_PROGRESS')fail('IDEMPOTENT_SUBMISSION_IN_PROGRESS');
  if(reservation.status!=='NEW')fail('IDEMPOTENCY_RESERVATION_REJECTED');
  await store.bindPayload({checkoutIdempotencyKey:p.checkout_idempotency_key,selectionSha256,
    payloadSha256:verified.payload_sha256,ownerToken});
  await store.markSubmitting({checkoutIdempotencyKey:p.checkout_idempotency_key,ownerToken});
  try{
   const result=await provider.createNativeOrder({
    orderPayload:p,capability:{widget_id:capability.evidence.form.widget_id,
     public_form_url:capability.native_public_form_url,form_action_url:capability.native_form_action_url,
     form_action_id:capability.evidence.form.action_id,selection_field:capability.selection_field,
     selection_encoding:capability.selection_encoding,offer_ids:capability.form_offer_ids},
    idempotency_key:p.checkout_idempotency_key
   });
   const evidence=verifyProviderEvidenceBundle({bundle:result?.evidence_bundle,
    artifacts:result?.evidence_artifacts,trustedKeys:capabilityConfig.providerKeys,nowMs});
   assertLiveProviderEvidence(evidence);
   assertSameNativeForm(evidence,capability);
   const valid=validateNativeUnpaidOrderReadback(evidence.order,verified.plan,evidence);
   if(evidence.order.consent?.offer_terms_accepted!==true)fail('OFFER_TERMS_CONSENT_MISSING');
   await store.commit({checkoutIdempotencyKey:p.checkout_idempotency_key,ownerToken,
    providerOrderId:valid.provider_order_id,orderReadbackSha256:sha256(evidence.artifact_sha256),
    evidenceRef:evidence.artifact_refs.order_json});
   return {status:'NATIVE_UNPAID_ORDER_CREATED',provider_order_id:valid.provider_order_id,
    amount_due_rub:11690,line_count:2,checkout_url:null,
    next:'No customer payment URL is released by this integration until the independent paid/receipt/access/consent and owner release gates pass.'};
  }catch(e){
   await store.markOutcomeUnknown({checkoutIdempotencyKey:p.checkout_idempotency_key,ownerToken,
    errorCode:e.code||e.message}).catch(()=>{});
   fail('PROVIDER_OUTCOME_UNKNOWN');
  }
 }
 async function reconcile({signedOrderPayload,evidenceBundle,evidenceArtifacts,independentReview,now,nowMs=Date.now()}={}){
  const verified=open(signedOrderPayload,now),p=verified.payload;
  if(!capabilityConfig?.providerKeys)fail('NATIVE_PROVIDER_TRUST_STORES_REQUIRED');
  const capability=verifyNativeCapability({...capabilityConfig,plan:verified.plan,nowMs});
  const evidence=verifyProviderEvidenceBundle({bundle:evidenceBundle,artifacts:evidenceArtifacts,
   trustedKeys:capabilityConfig.providerKeys,nowMs});
  assertLiveProviderEvidence(evidence);assertSameNativeForm(evidence,capability);
  const review=verifyIndependentReview({review:independentReview,evidenceBundle,reviewerKeys:capabilityConfig.reviewerKeys,nowMs});
  assertReviewMatchesEvidence(review,evidence);
  const valid=validateNativeUnpaidOrderReadback(evidence.order,verified.plan,evidence);
  if(evidence.order.consent?.offer_terms_accepted!==true)fail('OFFER_TERMS_CONSENT_MISSING');
  if(typeof store?.reconcileCreated!=='function')fail('IDEMPOTENCY_RECONCILIATION_STORE_REQUIRED');
  await store.reconcileCreated({checkoutIdempotencyKey:p.checkout_idempotency_key,
   selectionSha256:sha256(verified.plan),payloadSha256:verified.payload_sha256,providerOrderId:valid.provider_order_id,
   orderReadbackSha256:sha256(evidence.artifact_sha256),evidenceRef:evidence.artifact_refs.order_json});
  return {status:'RECONCILED_EXISTING_NATIVE_ORDER',provider_order_id:valid.provider_order_id,
   amount_due_rub:11690,checkout_url:null};
 }
 async function verifyPaid({signedOrderPayload,evidenceBundle,evidenceArtifacts,independentReview,now,nowMs=Date.now()}={}){
  const verified=open(signedOrderPayload,now),p=verified.payload;
  if(!capabilityConfig?.providerKeys)fail('NATIVE_PROVIDER_TRUST_STORES_REQUIRED');
  const capability=verifyNativeCapability({...capabilityConfig,plan:verified.plan,nowMs});
  const evidence=verifyProviderEvidenceBundle({bundle:evidenceBundle,artifacts:evidenceArtifacts,
   trustedKeys:capabilityConfig.providerKeys,nowMs});
  assertLiveProviderEvidence(evidence);assertSameNativeForm(evidence,capability);
  const review=verifyIndependentReview({review:independentReview,evidenceBundle,reviewerKeys:capabilityConfig.reviewerKeys,nowMs});
  assertReviewMatchesEvidence(review,evidence);
  const valid=validatePaidGrantReadback(evidence.order,evidence);
  if(typeof store?.recordPaidVerification!=='function')fail('PAID_EVENT_IDEMPOTENCY_STORE_REQUIRED');
  const recorded=await store.recordPaidVerification({
   checkoutIdempotencyKey:p.checkout_idempotency_key,providerOrderId:valid.provider_order_id,
   paidEventId:valid.paid_event_id,payloadSha256:verified.payload_sha256,
   paidReadbackSha256:sha256(evidence.artifact_sha256),evidenceRef:evidence.artifact_refs.order_json,
   paidTotalRub:11690
  });
  return {status:'PAID_NATIVE_READBACK_VERIFIED',provider_order_id:valid.provider_order_id,
   paid_event_id:valid.paid_event_id,paid_total_rub:11690,
   expected_native_grants:buildGrantPlan(verified.plan),actual_grants_verified:2,
   grant_writes:0,receipt_tax_verified:true,consent_verified:true,
   idempotency:recorded.status};
 }
 return Object.freeze({prepare,open,start,reconcile,verifyPaid});
}
module.exports={SCHEMA,EXPECTED_SELECTION,EXPECTED_LINES,buildOrderPayloadFromPlan,prepareTrustedOrderPayload,
 verifyTrustedOrderPayload,verifyIndependentReview,assertReviewMatchesEvidence,verifyNativeCapability,assertSameNativeForm,createNativeOrderPostgresStore,
 createNativeOrderSiteIntegration,validateProviderCheckoutUrl};
