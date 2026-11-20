'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {EXPECTED,canonical,sha256,verifyProviderEvidenceBundle,assertLiveProviderEvidence,
 buildNativeMultiOfferCapability}=require('./native-provider-evidence.cjs');
const pair=require('./native-widget-pair-readonly-evidence.json');
const {assessNativeWidgetPair}=require('./native-order-execution-contract.cjs');
const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
const nowMs=1795060800000; // deterministic 2026-11-19 UTC window
const formHtml=`<!doctype html><html><body>
<form method="post" action="https://study.shkola-dnv.com/pl/lite/block-public/process?id=2263999999">
<input type="checkbox" name="formParams[offer_id][]" value="8933492" checked>
<input type="checkbox" name="formParams[offer_id][]" value="8919715" checked>
<button type="submit">Оформить заказ</button></form></body></html>`;
const unpaidOrder={
 source:'GETCOURSE_NATIVE_ORDER_DETAIL',synthetic:true,provider_order_id:'TEST-GC-UNPAID-001',
 status:'UNPAID',currency:'RUB',subtotal_rub:12990,discount_percent:10,discount_rub:1300,amount_due_rub:11690,
 source_form_action_id:'2263999999',source_form_widget_id:1686999,
 lines:[
  {offer_id:8933492,product_id:4557988,training_id:936022301,base_price_rub:6990,quantity:1,line_total_rub:6990},
  {offer_id:8919715,product_id:4550895,training_id:933861292,base_price_rub:6000,quantity:1,line_total_rub:6000}
 ],grants:[]
};
const refs={form:'test-fixture/form.html',order:'test-fixture/order.json'};
function makeBundle({html=formHtml,order=unpaidOrder,formOverrides={},captureType='TEST_FIXTURE'}={}){
 const artifacts={ [refs.form]:html,[refs.order]:JSON.stringify(order) };
 const bundle={
  schema:'bf2026.getcourse.provider-evidence.v1',provider:'GetCourse',capture_type:captureType,
  captured_at:'2026-11-19T00:00:00.000Z',attested_by:'BF2026 contract-test fixture',
  form:{
   widget_id:1686999,public_url:'https://study.shkola-dnv.com/pl/lite/widget/widget?id=1686999',
   action_id:'2263999999',method:'POST',selection_field:'formParams[offer_id][]',
   selection_encoding:'MULTI_VALUE_CHECKBOX',offer_ids:[8933492,8919715],...formOverrides
  },
  artifacts:{
   form_html:{ref:refs.form,sha256:sha256(html)},
   order_json:{ref:refs.order,sha256:sha256(artifacts[refs.order])}
  },
  attestation:{key_id:'ephemeral-test-key',algorithm:'Ed25519',signature:''}
 };
 const unsigned=Object.fromEntries(Object.entries(bundle).filter(([k])=>k!=='attestation'));
 bundle.attestation.signature=crypto.sign(null,Buffer.from(canonical(unsigned)),privateKey).toString('base64url');
 return {bundle,artifacts,keys:{'ephemeral-test-key':{publicKey,trust_level:'TEST_ONLY',usage:'TEST_ONLY'}}};
}
function verify(args=makeBundle()){
 return verifyProviderEvidenceBundle({bundle:args.bundle,artifacts:args.artifacts,trustedKeys:args.keys,nowMs});
}
test('real observed widgets are explicitly rejected as a two-offer native form',()=>{
 const x=assessNativeWidgetPair(pair);
 assert.equal(x.native_forms_observed,2);
 assert.equal(x.one_checked_radio_per_form,true);
 assert.equal(x.distinct_form_action_ids,true);
 assert.equal(x.one_native_form_with_both_offers,false);
 assert.equal(x.multi_offer_selection_transfer_verified,false);
});
test('signed test fixture verifies exact form/action and unpaid two-line order contract, but is never provider-verified',()=>{
 const x=verify();
 assert.equal(x.evidence_class,'TEST_FIXTURE_ONLY');
 assert.equal(x.provider_verified,false);
 assert.equal(x.form.action_id,'2263999999');
 assert.deepEqual(x.form.selected_offer_ids,[8919715,8933492]);
 assert.equal(x.order.provider_order_id,'TEST-GC-UNPAID-001');
 assert.equal(x.order.status,'UNPAID');
 assert.equal(x.order.amount_due_rub,11690);
 assert.equal(x.order.subtotal_rub,12990);
 assert.equal(x.order.discount_rub,1300);
 assert.throws(()=>assertLiveProviderEvidence(x),{code:'LIVE_PROVIDER_EVIDENCE_REQUIRED'});
 assert.throws(()=>buildNativeMultiOfferCapability(x),{code:'LIVE_PROVIDER_EVIDENCE_REQUIRED'});
});
test('two separate observed widget forms cannot be represented as one multi-offer native form',()=>{
 const html='<form method="post" action="https://study.shkola-dnv.com/pl/lite/block-public/process?id=2263999999"><input type="radio" name="formParams[offer_id][]" value="8933492" checked></form>';
 assert.throws(()=>verify(makeBundle({html})),{code:'NATIVE_FORM_NOT_MULTI_SELECTABLE'});
});
test('one native form with only one selected Offer is rejected',()=>{
 const html='<form method="post" action="https://study.shkola-dnv.com/pl/lite/block-public/process?id=2263999999"><input type="checkbox" name="formParams[offer_id][]" value="8933492" checked></form>';
 assert.throws(()=>verify(makeBundle({html})),{code:'NATIVE_FORM_SELECTED_OFFER_IDS_MISMATCH'});
});
test('wrong action ID or unrelated widget URL is rejected',()=>{
 const badAction=formHtml.replace('id=2263999999','id=2263000000');
 assert.throws(()=>verify(makeBundle({html:badAction})),{code:'NATIVE_FORM_ACTION_ID_MISMATCH'});
 assert.throws(()=>verify(makeBundle({formOverrides:{widget_id:1686693}})),{code:'NATIVE_WIDGET_PUBLIC_URL_MISMATCH'});
});
test('modified evidence artifact is rejected by SHA-256 before provider trust is considered',()=>{
 const x=makeBundle();x.artifacts[refs.order]+=' ';
 assert.throws(()=>verify(x),{code:'PROVIDER_EVIDENCE_ARTIFACT_HASH_MISMATCH'});
});
test('unknown key, invalid signature, stale capture and trust-level mismatch all fail closed',()=>{
 const x=makeBundle();
 assert.throws(()=>verifyProviderEvidenceBundle({bundle:x.bundle,artifacts:x.artifacts,trustedKeys:{},nowMs}),{code:'PROVIDER_EVIDENCE_TRUST_KEY_UNKNOWN'});
 const y=makeBundle();y.bundle.attestation.signature='A'.repeat(86);
 assert.throws(()=>verify(y),{code:'PROVIDER_EVIDENCE_SIGNATURE_INVALID'});
 const z=makeBundle();z.bundle.captured_at='2020-01-01T00:00:00.000Z';
 assert.throws(()=>verify(z),{code:'PROVIDER_EVIDENCE_CAPTURE_TIME_INVALID'});
 const live=makeBundle({captureType:'LIVE_PROVIDER_CAPTURE'});
 assert.throws(()=>verify(live),{code:'PROVIDER_EVIDENCE_TRUST_LEVEL_MISMATCH'});
});
test('wrong total, discount, line count, duplicate Offer, Product/Training mapping or source action fail reconciliation',()=>{
 const cases=[
  [ {...unpaidOrder,amount_due_rub:11691},'NATIVE_UNPAID_AMOUNT_DUE_MISMATCH'],
  [ {...unpaidOrder,discount_rub:1299},'NATIVE_ORDER_DISCOUNT_RECONCILIATION_FAILED'],
  [ {...unpaidOrder,lines:unpaidOrder.lines.slice(0,1)},'NATIVE_ORDER_MUST_HAVE_EXACTLY_TWO_LINES'],
  [ {...unpaidOrder,lines:[unpaidOrder.lines[0],{...unpaidOrder.lines[1],offer_id:8933492}]},'NATIVE_ORDER_LINE_MISMATCH_0_offer_id'],
  [ {...unpaidOrder,lines:[unpaidOrder.lines[0],{...unpaidOrder.lines[1],product_id:1}]},'NATIVE_ORDER_LINE_MISMATCH_0_product_id'],
  [ {...unpaidOrder,source_form_action_id:'2263000000'},'NATIVE_ORDER_NOT_RECONCILED_TO_FORM_ACTION']
 ];
 for(const [order,code] of cases)assert.throws(()=>verify(makeBundle({order})),{code});
});
test('unpaid order carrying any grant is rejected',()=>{
 const order={...unpaidOrder,grants:[{training_id:936022301}]};
 assert.throws(()=>verify(makeBundle({order})),{code:'GRANTS_BEFORE_CONFIRMED_PAYMENT'});
});
test('TEST_ONLY paid fixture validates same-order, same-event 365-day AFTER_PAY grant and fiscal evidence rules',()=>{
 const paid={...unpaidOrder,synthetic:true,status:'PAID',paid_total_rub:11690,amount_due_rub:undefined,
  payment_event_id:'TEST-EVENT-1',
  grants:[
   {offer_id:8933492,product_id:4557988,training_id:936022301,provider_order_id:'TEST-GC-UNPAID-001',duration_days:365,start:'AFTER_PAY',status:'GRANTED',paid_event_id:'TEST-EVENT-1'},
   {offer_id:8919715,product_id:4550895,training_id:933861292,provider_order_id:'TEST-GC-UNPAID-001',duration_days:365,start:'AFTER_PAY',status:'GRANTED',paid_event_id:'TEST-EVENT-1'}
  ],
  receipt:{receipt_id:'TEST-RECEIPT',tax_readback:true},
  consent:{offer_terms_accepted:true},
  duplicate_guard:{verified:true,negative_test_passed:true}
 };
 const x=verify(makeBundle({order:paid}));
 assert.equal(x.order.status,'PAID');
 assert.equal(x.provider_verified,false);
 assert.throws(()=>assertLiveProviderEvidence(x),{code:'LIVE_PROVIDER_EVIDENCE_REQUIRED'});
 const bad={...paid,grants:paid.grants.map((g,i)=>i?g:{...g,training_id:1})};
 assert.throws(()=>verify(makeBundle({order:bad})),{code:'PAID_GRANT_MAPPING_MISMATCH_0'});
 const mixed={...paid,grants:paid.grants.map((g,i)=>i?{...g,paid_event_id:'OTHER'}:g)};
 assert.throws(()=>verify(makeBundle({order:mixed})),{code:'GRANTS_NOT_BOUND_TO_SAME_PAID_EVENT'});
 const noReceipt={...paid,receipt:null};
 assert.throws(()=>verify(makeBundle({order:noReceipt})),{code:'FISCAL_RECEIPT_OR_TAX_MISSING'});
});

const {createPostgresIdempotencyStore,executeProviderSubmissionAfterReservation,classifyExistingReservation}=
 require('./native-order-execution-contract.cjs');
function makeFakePg(){
 const rows=new Map();
 function keyOf(k){return 'BF2026:'+k;}
 const client={release(){},async query(sql,p=[]){
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rowCount:0,rows:[]};
  if(sql.startsWith('INSERT INTO bf2026_native_checkout_idempotency')){
   const key=keyOf(p[0]);if(rows.has(key))return {rowCount:0,rows:[]};
   rows.set(key,{scope:'BF2026',checkout_idempotency_key:p[0],selection_sha256:p[1],state:'RESERVED',
    lease_owner:p[2],lease_expires_at:new Date(Date.now()+Number(p[3])*1000),provider_order_id:null});
   return {rowCount:1,rows:[{state:'RESERVED'}]};
  }
  if(sql.startsWith('SELECT selection_sha256,state,lease_expires_at,provider_order_id')){
   const row=rows.get(keyOf(p[0]));return {rowCount:row?1:0,rows:row?[{...row}]:[]};
  }
  if(sql.startsWith("UPDATE bf2026_native_checkout_idempotency SET lease_owner=")){
   const row=rows.get(keyOf(p[0]));
   if(row&&row.state==='RESERVED'&&row.lease_expires_at<=new Date()){
    row.lease_owner=p[1];row.lease_expires_at=new Date(Date.now()+Number(p[2])*1000);return {rowCount:1,rows:[]};
   }
   return {rowCount:0,rows:[]};
  }
  throw new Error('UNHANDLED_FAKE_TX_SQL '+sql);
 }};
 const pool={connect:async()=>client,async query(sql,p=[]){
  const row=rows.get(keyOf(p[0]));if(!row)return {rowCount:0,rows:[]};
  if(sql.includes("SET state='PROVIDER_SUBMITTING'")){
   if(row.state!=='RESERVED'||row.lease_owner!==p[1])return {rowCount:0,rows:[]};
   row.state='PROVIDER_SUBMITTING';return {rowCount:1,rows:[]};
  }
  if(sql.includes("SET state='ORDER_CREATED'")&&sql.includes("state='PROVIDER_SUBMITTING'")){
   if(row.state!=='PROVIDER_SUBMITTING'||row.lease_owner!==p[1])return {rowCount:0,rows:[]};
   row.state='ORDER_CREATED';row.provider_order_id=p[2];row.order_readback_sha256=p[3];row.evidence_ref=p[4];
   return {rowCount:1,rows:[]};
  }
  if(sql.includes("SET state='PROVIDER_OUTCOME_UNKNOWN'")){
   if(row.state!=='PROVIDER_SUBMITTING'||row.lease_owner!==p[1])return {rowCount:0,rows:[]};
   row.state='PROVIDER_OUTCOME_UNKNOWN';row.last_error_code=p[2];return {rowCount:1,rows:[]};
  }
  if(sql.includes("SET state='ORDER_CREATED'")&&sql.includes("state='PROVIDER_OUTCOME_UNKNOWN'")){
   if(row.state!=='PROVIDER_OUTCOME_UNKNOWN'||row.selection_sha256!==p[1])return {rowCount:0,rows:[]};
   row.state='ORDER_CREATED';row.provider_order_id=p[2];row.order_readback_sha256=p[3];row.evidence_ref=p[4];
   return {rowCount:1,rows:[]};
  }
  throw new Error('UNHANDLED_FAKE_POOL_SQL '+sql);
 }};
 return {pool,rows};
}
test('durable idempotency replays a committed provider order and never creates a second one',async()=>{
 const {pool}=makeFakePg(),store=createPostgresIdempotencyStore(pool);
 const key='a'.repeat(32),selection=sha256({selection:'Lot5+Union'});
 const first=await store.reserve({checkoutIdempotencyKey:key,selectionSha256:selection,ownerToken:'b'.repeat(32)});
 assert.equal(first.status,'NEW');
 await store.markSubmitting({checkoutIdempotencyKey:key,ownerToken:'b'.repeat(32)});
 await store.commit({checkoutIdempotencyKey:key,ownerToken:'b'.repeat(32),providerOrderId:'GC-ORDER-1',
  orderReadbackSha256:'c'.repeat(64),evidenceRef:'getcourse-order-readback'});
 let providerCalls=0;
 const replay=await store.reserve({checkoutIdempotencyKey:key,selectionSha256:selection,ownerToken:'d'.repeat(32)});
 if(replay.status==='NEW')providerCalls++;
 assert.equal(replay.status,'COMMITTED');
 assert.equal(replay.provider_order_id,'GC-ORDER-1');
 assert.equal(providerCalls,0);
});
test('same idempotency key with a changed selection is rejected as a conflict',async()=>{
 const {pool}=makeFakePg(),store=createPostgresIdempotencyStore(pool);
 const key='e'.repeat(32);
 const first=await store.reserve({checkoutIdempotencyKey:key,selectionSha256:'1'.repeat(64),ownerToken:'2'.repeat(32)});
 assert.equal(first.status,'NEW');
 const conflict=await store.reserve({checkoutIdempotencyKey:key,selectionSha256:'3'.repeat(64),ownerToken:'4'.repeat(32)});
 assert.equal(conflict.status,'CONFLICT');
});
test('provider timeout marks outcome unknown and a retry is blocked before another provider call',async()=>{
 const {pool}=makeFakePg(),store=createPostgresIdempotencyStore(pool);
 const key='5'.repeat(32),selection=sha256({selection:'Lot5+Union'}),owner='6'.repeat(32);
 const reservation=await store.reserve({checkoutIdempotencyKey:key,selectionSha256:selection,ownerToken:owner});
 assert.equal(reservation.status,'NEW');
 const payload={checkout_idempotency_key:key,plan:{selection:'Lot5+Union'}};
 let providerCalls=0;
 const provider={createNativeOrder:async()=>{providerCalls++;const e=new Error('socket timeout after request write');e.code='ETIMEDOUT';throw e;}};
 await assert.rejects(()=>executeProviderSubmissionAfterReservation({
  payload,capability:{native_public_form_url:'https://study.shkola-dnv.com/pl/lite/widget/widget?id=1',
   native_form_action_url:'https://study.shkola-dnv.com/pl/lite/block-public/process?id=2'},
  idempotencyStore:store,provider,ownerToken:owner,evidenceTrustStore:{}
 }),{code:'PROVIDER_OUTCOME_UNKNOWN'});
 assert.equal(providerCalls,1);
 const retry=await store.reserve({checkoutIdempotencyKey:key,selectionSha256:selection,ownerToken:'7'.repeat(32)});
 assert.equal(retry.status,'OUTCOME_UNKNOWN');
 assert.equal(providerCalls,1);
});
test('unknown outcome reconciliation requires matching selection digest and readback evidence reference',async()=>{
 const {pool,rows}=makeFakePg(),store=createPostgresIdempotencyStore(pool);
 const key='8'.repeat(32),selection='9'.repeat(64),owner='a'.repeat(32);
 await store.reserve({checkoutIdempotencyKey:key,selectionSha256:selection,ownerToken:owner});
 await store.markSubmitting({checkoutIdempotencyKey:key,ownerToken:owner});
 await store.markOutcomeUnknown({checkoutIdempotencyKey:key,ownerToken:owner,errorCode:'ETIMEDOUT'});
 await assert.rejects(()=>store.reconcileCreated({checkoutIdempotencyKey:key,selectionSha256:'b'.repeat(64),
  providerOrderId:'GC-ORDER-2',orderReadbackSha256:'c'.repeat(64),evidenceRef:'signed-order-readback'}),
  {code:'IDEMPOTENCY_RECONCILIATION_FAILED'});
 await store.reconcileCreated({checkoutIdempotencyKey:key,selectionSha256:selection,
  providerOrderId:'GC-ORDER-2',orderReadbackSha256:'c'.repeat(64),evidenceRef:'signed-order-readback'});
 const row=rows.get('BF2026:'+key);
 assert.equal(row.state,'ORDER_CREATED');
 assert.equal(row.provider_order_id,'GC-ORDER-2');
 const replay=await store.reserve({checkoutIdempotencyKey:key,selectionSha256:selection,ownerToken:'d'.repeat(32)});
 assert.equal(replay.status,'COMMITTED');
});

test('dynamic GetCourse session parameters are ignored only for stable action-ID comparison',()=>{
 const html=formHtml.replace('id=2263999999','id=2263999999&gcSession=ephemeral-secret&gcVisitor=visitor-secret');
 const x=verify(makeBundle({html}));
 assert.equal(x.form.action_id,'2263999999');
 assert.equal(x.form.action_url_stable,'https://study.shkola-dnv.com/pl/lite/block-public/process?id=2263999999');
 assert.equal(JSON.stringify(x).includes('ephemeral-secret'),false);
 assert.equal(JSON.stringify(x).includes('visitor-secret'),false);
});
test('verified evidence result is deeply immutable and cannot be altered after hashing',()=>{
 const x=verify();
 assert.throws(()=>{x.order.lines[0].offer_id=1;},TypeError);
 assert.throws(()=>{x.form.selected_offer_ids.push(1);},TypeError);
 assert.equal(x.order.lines[0].offer_id,8933492);
});
test('test-only signed bundle cannot unlock production submission, touch idempotency, or call a provider',async()=>{
 const {createBoundary}=require('./site-boundary.cjs');
 const {sealSignedSelection,submitSignedSelection}=require('./native-order-execution-contract.cjs');
 const boundary=createBoundary(),secret=Buffer.alloc(32,0x5a);
 const token=sealSignedSelection({adapter:boundary.adapter,input:{kind:'set',items:['rejection_program','union']},
  secret,checkoutIdempotencyKey:'f'.repeat(32),now:2000000000,ttlSeconds:300,nonce:'e'.repeat(32)});
 const fixture=makeBundle();
 let storeCalls=0,providerCalls=0;
 const store={reserve:async()=>{storeCalls++;return {status:'NEW'}},markSubmitting:async()=>{storeCalls++},
  commit:async()=>{storeCalls++},markOutcomeUnknown:async()=>{storeCalls++}};
 const provider={name:'GetCourse',createNativeOrder:async()=>{providerCalls++;return null}};
 await assert.rejects(()=>submitSignedSelection({adapter:boundary.adapter,token,secret,now:2000000100,
  capability:{evidence_bundle:fixture.bundle,evidence_artifacts:fixture.artifacts,independent_reviewed:true},
  idempotencyStore:store,provider,evidenceTrustStore:fixture.keys,nowMs}));
 assert.equal(storeCalls,0);
 assert.equal(providerCalls,0);
});

test('unknown-outcome reconciler refuses TEST_ONLY artifacts and leaves durable state untouched',async()=>{
 const {createBoundary}=require('./site-boundary.cjs');
 const {sealSignedSelection,reconcileUnknownProviderOutcome}=require('./native-order-execution-contract.cjs');
 const boundary=createBoundary(),secret=Buffer.alloc(32,0x5a),fixture=makeBundle();
 const token=sealSignedSelection({adapter:boundary.adapter,input:{kind:'set',items:['rejection_program','union']},
  secret,checkoutIdempotencyKey:'1'.repeat(32),now:2000000000,ttlSeconds:300,nonce:'2'.repeat(32)});
 let reconcileCalls=0;
 const store={reconcileCreated:async()=>{reconcileCalls++;}};
 await assert.rejects(()=>reconcileUnknownProviderOutcome({adapter:boundary.adapter,token,secret,now:2000000100,
  idempotencyStore:store,evidenceBundle:fixture.bundle,evidenceArtifacts:fixture.artifacts,
  evidenceTrustStore:fixture.keys,nowMs}),{code:'LIVE_PROVIDER_EVIDENCE_REQUIRED'});
 assert.equal(reconcileCalls,0);
});
test('TEST_ONLY paid fixture rejects wrong Offer, Product, Training, order, duration, start, status and duplicate-guard evidence',()=>{
 const base={...unpaidOrder,synthetic:true,status:'PAID',paid_total_rub:11690,amount_due_rub:undefined,
  payment_event_id:'TEST-EVENT-1',
  grants:[
   {offer_id:8933492,product_id:4557988,training_id:936022301,provider_order_id:'TEST-GC-UNPAID-001',duration_days:365,start:'AFTER_PAY',status:'GRANTED',paid_event_id:'TEST-EVENT-1'},
   {offer_id:8919715,product_id:4550895,training_id:933861292,provider_order_id:'TEST-GC-UNPAID-001',duration_days:365,start:'AFTER_PAY',status:'GRANTED',paid_event_id:'TEST-EVENT-1'}
  ],
  receipt:{receipt_id:'TEST-RECEIPT',tax_readback:true},consent:{offer_terms_accepted:true},
  duplicate_guard:{verified:true,negative_test_passed:true}
 };
 const variants=[
  [g=>({...g,offer_id:7}),'PAID_GRANT_MAPPING_MISMATCH_0'],
  [g=>({...g,product_id:7}),'PAID_GRANT_MAPPING_MISMATCH_0'],
  [g=>({...g,training_id:7}),'PAID_GRANT_MAPPING_MISMATCH_0'],
  [g=>({...g,provider_order_id:'OTHER'}),'PAID_GRANT_MAPPING_MISMATCH_0'],
  [g=>({...g,duration_days:30}),'PAID_GRANT_MAPPING_MISMATCH_0'],
  [g=>({...g,start:'ON_PURCHASE'}),'PAID_GRANT_MAPPING_MISMATCH_0'],
  [g=>({...g,status:'PENDING'}),'PAID_GRANT_MAPPING_MISMATCH_0']
 ];
 for(const [mutate,code] of variants){
  const bad={...base,grants:base.grants.map((g,i)=>i?g:mutate(g))};
  assert.throws(()=>verify(makeBundle({order:bad})),e=>e.code.startsWith('PAID_GRANT_MAPPING_MISMATCH_'));
 }
 const noGuard={...base,duplicate_guard:{verified:true,negative_test_passed:false}};
 assert.throws(()=>verify(makeBundle({order:noGuard})),{code:'DUPLICATE_GUARD_NOT_PROVEN'});
 const noConsent={...base,consent:{offer_terms_accepted:false}};
 assert.throws(()=>verify(makeBundle({order:noConsent})),{code:'OFFER_TERMS_CONSENT_MISSING'});
});

test('signed manifest cannot lie about selected Offer IDs or omit the attestor',()=>{
 const wrong=makeBundle();wrong.bundle.form.offer_ids=[8933492];
 const unsigned=Object.fromEntries(Object.entries(wrong.bundle).filter(([k])=>k!=='attestation'));
 wrong.bundle.attestation.signature=crypto.sign(null,Buffer.from(canonical(unsigned)),privateKey).toString('base64url');
 assert.throws(()=>verify(wrong),{code:'NATIVE_FORM_DECLARED_OFFER_IDS_MISMATCH'});
 const noAttestor=makeBundle();delete noAttestor.bundle.attested_by;
 const u=Object.fromEntries(Object.entries(noAttestor.bundle).filter(([k])=>k!=='attestation'));
 noAttestor.bundle.attestation.signature=crypto.sign(null,Buffer.from(canonical(u)),privateKey).toString('base64url');
 assert.throws(()=>verify(noAttestor),{code:'PROVIDER_EVIDENCE_ATTESTOR_REQUIRED'});
});
