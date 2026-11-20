'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createBoundary}=require('./site-boundary.cjs');
const {createPaidReconciler}=require('./paid-proof-reconciler.cjs');
const {buildOrderPayloadFromPlan,createNativeOrderPostgresStore}=require('./native-order-site-integration.cjs');
const {canonical,sha256}=require('./native-order-execution-contract.cjs');
const {SCHEMA,SOURCE}=require('./provider-relay-webhook.cjs');
const adapter=createBoundary().adapter;
const plan=adapter.plan({kind:'set',items:['rejection_program','union']});
const key='a'.repeat(32);
function record(overrides={}){
 return {state:'ORDER_CREATED',checkout_idempotency_key:key,provider_order_id:'TEST-ORDER-100',
  selection_sha256:sha256(plan),trusted_order_payload_sha256:sha256(buildOrderPayloadFromPlan(plan,key)),...overrides};
}
function hint(status_hint='PAID'){
 return {source:SOURCE,event_id:'TEST-EVENT-100',provider_order_id:'TEST-ORDER-100',status_hint};
}
function harness(row=record(),proof=null){
 let queries=0,loads=0,commits=0;
 const store={getByProviderOrder:async()=>{queries++;return row;},
  recordPaidVerification:async()=>{commits++;return {status:'RECORDED'}}};
 const loader={readNativePaidEvidence:async()=>{loads++;return proof}};
 const fn=createPaidReconciler({adapter,checkoutStore:store,providerProofLoader:loader,
  providerKeys:{},reviewerKeys:{},nowMs:()=>2000000000000});
 return {fn,stats:()=>({queries,loads,commits})};
}
test('requires server-owned verifier dependencies, cannot trust a hint alone',()=>{
 assert.throws(()=>createPaidReconciler({adapter}),{code:'PAID_RECONCILER_TRUSTED_DEPENDENCIES_REQUIRED'});
});
test('UNPAID, REFUND, CANCELLED hints do not access the database or issue grants',async()=>{
 const x=harness();
 for(const status of ['UNPAID','REFUND','CANCELLED']){
  const r=await x.fn(hint(status));
  assert.equal(r.payment_verified,false);
  assert.equal(r.external_grants_issued,0);
  assert.equal(r.status,'HOLD_NON_PAYMENT_EVENT');
 }
 assert.deepEqual(x.stats(),{queries:0,loads:0,commits:0});
});
test('unknown provider order cannot trigger a paid event or provider readback',async()=>{
 const x=harness(null);
 await assert.rejects(()=>x.fn(hint()),{code:'UNKNOWN_OR_UNCOMMITTED_NATIVE_ORDER'});
 assert.deepEqual(x.stats(),{queries:1,loads:0,commits:0});
});
test('tampered original checkout selection/payload cannot be reconciled',async()=>{
 for(const bad of [{selection_sha256:'0'.repeat(64)},{trusted_order_payload_sha256:'0'.repeat(64)}]){
  const x=harness(record(bad));
  await assert.rejects(()=>x.fn(hint()));
  assert.deepEqual(x.stats(),{queries:1,loads:0,commits:0});
 }
});
test('no actual GetCourse signed provider evidence means HOLD before paid ledger write',async()=>{
 const x=harness(record(),null);
 await assert.rejects(()=>x.fn(hint()),{code:'INDEPENDENT_NATIVE_PROVIDER_PROOF_MISSING'});
 assert.deepEqual(x.stats(),{queries:1,loads:1,commits:0});
});
test('server-backed checkout store can fetch by provider order id',async()=>{
 let called=0;
 const pool={connect:async()=>({query:async()=>({rowCount:0,rows:[]}),release(){}}),
  query:async(sql,params)=>{
   called++;
   assert.match(sql,/provider_order_id=\$1/);
   assert.deepEqual(params,['TEST-ORDER-100']);
   return {rows:[record()]};
  }};
 const store=createNativeOrderPostgresStore(pool);
 const row=await store.getByProviderOrder('TEST-ORDER-100');
 assert.equal(row.checkout_idempotency_key,key);
 assert.equal(called,1);
});
test('ephemeral TEST fixtures can exercise successful verification, but this is NOT GetCourse E2E',async()=>{
 // This test uses local mock role-keys and fabricated test-only order content.
 // Do NOT install these keys or artifacts into a site environment.
 const {publicKey:pk1,privateKey:sk1}=crypto.generateKeyPairSync('ed25519');
 const {publicKey:pk2,privateKey:sk2}=crypto.generateKeyPairSync('ed25519');
 const nowMs=2000000000000;
 const form='<form method="post" action="https://study.shkola-dnv.com/pl/lite/block-public/process?id=2263999999">'+
  '<input type="checkbox" name="formParams[offer_id][]" value="8933492" checked>'+
  '<input type="checkbox" name="formParams[offer_id][]" value="8919715" checked></form>';
 const expected=[
  {offer_id:8933492,product_id:4557988,training_id:936022301,base_price_rub:6990,quantity:1,line_total_rub:6990},
  {offer_id:8919715,product_id:4550895,training_id:933861292,base_price_rub:6000,quantity:1,line_total_rub:6000}
 ];
 const paymentId='TEST-PAYMENT-100';
 const order={source:'GETCOURSE_NATIVE_ORDER_DETAIL',provider_order_id:'TEST-ORDER-100',
  source_form_action_id:'2263999999',source_form_widget_id:1686999,
  status:'PAID',currency:'RUB',subtotal_rub:12990,discount_percent:10,discount_rub:1300,
  paid_total_rub:11690,lines:expected,payment_event_id:paymentId,
  grants:expected.map(x=>({offer_id:x.offer_id,product_id:x.product_id,training_id:x.training_id,
   provider_order_id:'TEST-ORDER-100',duration_days:365,start:'AFTER_PAY',status:'GRANTED',paid_event_id:paymentId})),
  receipt:{receipt_id:'TEST-RECEIPT-100',tax_readback:true},
  consent:{offer_terms_accepted:true},duplicate_guard:{verified:true,negative_test_passed:true}};
 const artifacts={'test/form.html':form,'test/order.json':JSON.stringify(order)};
 const manifest={schema:'bf2026.getcourse.provider-evidence.v1',provider:'GetCourse',
  capture_type:'LIVE_PROVIDER_CAPTURE',captured_at:new Date(nowMs).toISOString(),
  attested_by:'ephemeral-capture-fixture',
  form:{widget_id:1686999,public_url:'https://study.shkola-dnv.com/pl/lite/widget/widget?id=1686999',
   action_id:'2263999999',method:'POST',selection_field:'formParams[offer_id][]',
   selection_encoding:'MULTI_VALUE_CHECKBOX',offer_ids:[8933492,8919715]},
  artifacts:{form_html:{ref:'test/form.html',sha256:sha256(form)},
   order_json:{ref:'test/order.json',sha256:sha256(artifacts['test/order.json'])}}};
 const signedManifest={...manifest,attestation:{
  key_id:'EPHEMERAL_TEST_CAPTURE_KEY',algorithm:'Ed25519',
  signature:crypto.sign(null,Buffer.from(canonical(manifest)),sk1).toString('base64url')}};
 const reviewUnsigned={
  schema:'bf2026.getcourse.native-capability-review.v1',provider:'GetCourse',
  scope:'LOT5_UNION_NATIVE_MULTI_OFFER_11690',decision:'PASS',reviewer_id:'ephemeral-test-reviewer',
  reviewed_at:new Date(nowMs).toISOString(),evidence_bundle_sha256:sha256(canonical(signedManifest)),
  widget_id:1686999,form_action_id:2263999999,provider_order_id:'TEST-ORDER-100',
  legal_consent_negative_test_passed:true,duplicate_guard_negative_test_passed:true,
  legal_consent_negative_test_ref:'TEST-only-negative-consent',
  duplicate_guard_negative_test_ref:'TEST-only-negative-duplicate'
 };
 const review={...reviewUnsigned,attestation:{key_id:'EPHEMERAL_TEST_REVIEW_KEY',algorithm:'Ed25519',
  signature:crypto.sign(null,Buffer.from(canonical(reviewUnsigned)),sk2).toString('base64url')}};
 const event=hint(),proof={bundle:signedManifest,artifacts,independentReview:review};
 const providerKeys={EPHEMERAL_TEST_CAPTURE_KEY:{
  publicKey:pk1,trust_level:'SITE_ENGINEER_ATTESTED',usage:'BF2026_GETCOURSE_PROVIDER_EVIDENCE'}};
 const reviewerKeys={EPHEMERAL_TEST_REVIEW_KEY:{
  publicKey:pk2,trust_level:'INDEPENDENT_QA_REVIEWER',usage:'BF2026_GETCOURSE_NATIVE_CAPABILITY_REVIEW'}};
 let commits=0;
 const store={getByProviderOrder:async()=>record(),
  recordPaidVerification:async arg=>{
   commits++;assert.equal(arg.paidTotalRub,11690);assert.equal(arg.providerOrderId,'TEST-ORDER-100');
   return {status:commits===1?'RECORDED':'REPLAY'};
  }};
 const fn=createPaidReconciler({adapter,checkoutStore:store,
  providerProofLoader:{readNativePaidEvidence:async()=>proof},providerKeys,reviewerKeys,nowMs:()=>nowMs});
 const first=await fn(event),repeat=await fn(event);
 assert.equal(first.status,'NATIVE_PAYMENT_AND_TWO_GRANTS_VERIFIED');
 assert.equal(first.grant_count,2);assert.equal(first.grant_writes,0);
 assert.equal(first.release_allowed,false);
 assert.equal(repeat.duplicate_ledger_result,'REPLAY');
 assert.equal(commits,2);
 const wrong=await (async()=>{try{return await fn({...event,provider_order_id:'OTHER'})}catch(e){return e.code}})();
 assert.equal(wrong,'UNKNOWN_OR_UNCOMMITTED_NATIVE_ORDER');
});
