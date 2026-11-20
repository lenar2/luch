'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createBoundary}=require('./site-boundary.cjs');
const evidence=require('./native-widget-pair-readonly-evidence.json');
const {sealSignedSelection,verifySignedSelection,assessNativeWidgetPair,assertNativeMultiOfferCapability,
 classifyExistingReservation,buildGrantPlan,validateNativeUnpaidOrderReadback,validatePaidGrantReadback,
 submitSignedSelection,createPostgresIdempotencyStore}=require('./native-order-execution-contract.cjs');
const boundary=createBoundary();
const adapter=boundary.adapter;
const secret=Buffer.alloc(32,0x5a);
const input={kind:'set',items:['rejection_program','union']};
function token(now=2000000000){return sealSignedSelection({adapter,input,secret,checkoutIdempotencyKey:'a'.repeat(32),now,ttlSeconds:300,nonce:'b'.repeat(32)});}
test('latest public GetCourse readback is two separate single-offer radio forms, not one native cart',()=>{
 const x=assessNativeWidgetPair(evidence);
 assert.equal(x.native_forms_observed,2);
 assert.equal(x.one_checked_radio_per_form,true);
 assert.equal(x.distinct_form_action_ids,true);
 assert.deepEqual(x.observed_offer_ids,[8919715,8933492]);
 assert.equal(x.one_native_form_with_both_offers,false);
 assert.equal(x.multi_offer_selection_transfer_verified,false);
 assert.equal(evidence.widgets[0].iframe.form.action_id,'2263265127');
 assert.equal(evidence.widgets[1].iframe.form.action_id,'2263282483');
 assert.equal(evidence.widgets[0].iframe.offer_inputs[0].checked,true);
 assert.equal(evidence.widgets[1].iframe.offer_inputs[0].checked,true);
 assert.equal(evidence.widgets[0].iframe.consent.marketing_checked_by_default,false);
 assert.equal(evidence.widgets[1].iframe.consent.marketing_checked_by_default,false);
 assert.equal(evidence.safety.form_submitted,false);
});
test('signed selection binds both exact native lines and the R109 11690 RUB quote',()=>{
 const t=token();
 const p=verifySignedSelection({adapter,token:t,secret,now:2000000100});
 assert.equal(p.scope,'INTERNAL_NATIVE_ORDER_CANDIDATE_ONLY');
 assert.equal(p.selection_key,'set:rejection_program|union');
 assert.equal(p.checkout_idempotency_key,'a'.repeat(32));
 assert.equal(p.plan.quote.subtotal_rub,12990);
 assert.equal(p.plan.quote.total_rub,11690);
 assert.deepEqual(p.plan.lines.map(x=>[x.offer_ids[0],x.product_ids[0],x.training_ids[0],x.grant.start,x.grant.duration_days]),[
  [8933492,4557988,936022301,'AFTER_PAY',365],
  [8919715,4550895,933861292,'AFTER_PAY',365]
 ]);
});
test('signed selection rejects HMAC tampering, expiry and wrong secret',()=>{
 const t=token();
 const parts=t.split('.');
 const bad=parts[0]+'.'+parts[1]+'.'+(parts[2].slice(0,-1)+(parts[2].endsWith('A')?'B':'A'));
 assert.throws(()=>verifySignedSelection({adapter,token:bad,secret,now:2000000100}),{code:'TAMPERED_SELECTION_TOKEN'});
 assert.throws(()=>verifySignedSelection({adapter,token:t,secret,now:2000000400}),{code:'EXPIRED_OR_INVALID_SELECTION'});
 assert.throws(()=>verifySignedSelection({adapter,token:t,secret:Buffer.alloc(32,1),now:2000000100}),{code:'TAMPERED_SELECTION_TOKEN'});
});
test('same stable idempotency key is distinct from token nonce and is signed into the selection',()=>{
 const t=token();const p=verifySignedSelection({adapter,token:t,secret,now:2000000100});
 assert.equal(p.checkout_idempotency_key,'a'.repeat(32));
 assert.equal(p.nonce,'b'.repeat(32));
 assert.notEqual(p.checkout_idempotency_key,p.nonce);
});
test('no provider multi-offer capability exists: fail closed before idempotency or provider calls',async()=>{
 let storeCalls=0,providerCalls=0;
 const store={reserve:async()=>{storeCalls++;return {status:'NEW'}},markSubmitting:async()=>{storeCalls++},commit:async()=>{storeCalls++},markOutcomeUnknown:async()=>{storeCalls++}};
 const provider={name:'GetCourse',createNativeOrder:async()=>{providerCalls++;throw new Error('must not call')}};
 await assert.rejects(()=>submitSignedSelection({adapter,token:token(),secret,now:2000000100,capability:null,idempotencyStore:store,provider}),
  {code:'NATIVE_PROVIDER_EVIDENCE_BUNDLE_REQUIRED'});
 assert.equal(storeCalls,0);
 assert.equal(providerCalls,0);
});
test('capability cannot be inferred from two single-offer widget URLs',()=>{
 const plan=adapter.plan(input);
 const fakeCapability={provider:'GetCourse',mode:'ONE_NATIVE_ORDER_MULTI_OFFER',
  selection_field:'formParams[offer_id][]',selection_encoding:'MULTIPLE_VALUES_IN_ONE_NATIVE_FORM',
  provider_selection_binding_verified:true,native_unpaid_two_line_order_verified:true,independent_reviewed:true,
  form_offer_ids:[8933492,8919715],native_order_offer_ids:[8933492,8919715],
  native_public_form_url:'https://study.shkola-dnv.com/pl/lite/widget/widget?id=1686693',
  native_form_action_url:'https://study.shkola-dnv.com/pl/lite/block-public/process?id=2263265127',
  native_form_get_ref:'widget-get',native_unpaid_order_readback_ref:'order-get',native_order_id:'fake'};
 assert.throws(()=>assertNativeMultiOfferCapability(null,plan),{code:'NATIVE_PROVIDER_EVIDENCE_BUNDLE_REQUIRED'});
 // The evidence we actually have must never be silently upgraded into this capability.
 const observed=assessNativeWidgetPair(evidence);
 assert.equal(observed.one_native_form_with_both_offers,false);
 assert.equal(observed.multi_offer_selection_transfer_verified,false);
 assert.ok(fakeCapability); // shape example only; not accepted or installed.
});
test('idempotency policy replays committed orders, conflicts on changed selection and blocks ambiguous retry',()=>{
 const hash='c'.repeat(64),now=2000000000000;
 assert.equal(classifyExistingReservation(null,hash,now),'NEW');
 assert.equal(classifyExistingReservation({selection_sha256:hash,state:'ORDER_CREATED',provider_order_id:'123'},hash,now),'COMMITTED');
 assert.equal(classifyExistingReservation({selection_sha256:'d'.repeat(64),state:'RESERVED'},hash,now),'CONFLICT');
 assert.equal(classifyExistingReservation({selection_sha256:hash,state:'PROVIDER_SUBMITTING'},hash,now),'OUTCOME_UNKNOWN');
 assert.equal(classifyExistingReservation({selection_sha256:hash,state:'PROVIDER_OUTCOME_UNKNOWN'},hash,now),'OUTCOME_UNKNOWN');
 assert.equal(classifyExistingReservation({selection_sha256:hash,state:'RESERVED',lease_expires_at:new Date(now+1000).toISOString()},hash,now),'IN_PROGRESS');
 assert.equal(classifyExistingReservation({selection_sha256:hash,state:'RESERVED',lease_expires_at:new Date(now-1000).toISOString()},hash,now),'RECLAIM');
});
test('exact grant plan is AFTER_PAY for the matching product/training pair only',()=>{
 const p=adapter.plan(input);
 assert.deepEqual(buildGrantPlan(p),[
  {offer_id:8933492,product_id:4557988,training_id:936022301,trigger:'CONFIRMED_PAID_EVENT_ONLY',start:'AFTER_PAY',duration_days:365},
  {offer_id:8919715,product_id:4550895,training_id:933861292,trigger:'CONFIRMED_PAID_EVENT_ONLY',start:'AFTER_PAY',duration_days:365}
 ]);
});
test('unpaid order validator rejects missing and synthetic order evidence; no fake positive fixture',()=>{
 const p=adapter.plan(input);
 assert.throws(()=>validateNativeUnpaidOrderReadback(null,p),{code:'NATIVE_UNPAID_ORDER_READBACK_REQUIRED'});
 assert.throws(()=>validateNativeUnpaidOrderReadback({provenance:{source:'UNIT_TEST',synthetic:true}},p),{code:'LIVE_PROVIDER_EVIDENCE_REQUIRED'});
});
test('paid grants require both exact trainings tied to the same provider order and paid event',()=>{
 assert.throws(()=>validatePaidGrantReadback(null),{code:'PAID_NATIVE_ORDER_REQUIRED'});
 assert.throws(()=>validatePaidGrantReadback({status:'PAID',paid_total_rub:11690,provider_order_id:'123',grants:[]}),{code:'LIVE_PROVIDER_EVIDENCE_REQUIRED'});
});

test('PostgreSQL idempotency adapter uses transactional unique reservation and conditional state writes',async()=>{
 const calls=[];
 const client={query:async(sql,params)=>{calls.push({sql,params,scope:'tx'});return sql.startsWith('INSERT INTO')?{rowCount:1,rows:[{state:'RESERVED'}]}:{rowCount:0,rows:[]};},release:()=>{}};
 const pool={connect:async()=>client,query:async(sql,params)=>{calls.push({sql,params,scope:'pool'});return {rowCount:1,rows:[]};}};
 const store=createPostgresIdempotencyStore(pool);
 const reserved=await store.reserve({checkoutIdempotencyKey:'a'.repeat(32),selectionSha256:'c'.repeat(64),ownerToken:'b'.repeat(32)});
 assert.equal(reserved.status,'NEW');
 await store.markSubmitting({checkoutIdempotencyKey:'a'.repeat(32),ownerToken:'b'.repeat(32)});
 await store.commit({checkoutIdempotencyKey:'a'.repeat(32),ownerToken:'b'.repeat(32),providerOrderId:'GC-123',orderReadbackSha256:'d'.repeat(64),evidenceRef:'native-order-readback'});
 assert.ok(calls.some(x=>x.sql==='BEGIN'));
 assert.ok(calls.some(x=>x.sql==='COMMIT'));
 assert.ok(calls.some(x=>x.sql.includes("state='PROVIDER_SUBMITTING'")&&x.sql.includes("state='RESERVED'")));
 assert.ok(calls.some(x=>x.sql.includes("state='ORDER_CREATED'")&&x.sql.includes("state='PROVIDER_SUBMITTING'")));
});
test('PostgreSQL ambiguous-submit path records unknown and only reconciles from native readback',async()=>{
 const calls=[];
 const client={query:async(sql,params)=>{calls.push(sql);return sql.startsWith('INSERT INTO')?{rowCount:1,rows:[]}:{rowCount:0,rows:[]};},release:()=>{}};
 const pool={connect:async()=>client,query:async(sql,params)=>{calls.push(sql);return {rowCount:1,rows:[]};}};
 const store=createPostgresIdempotencyStore(pool);
 await store.reserve({checkoutIdempotencyKey:'e'.repeat(32),selectionSha256:'f'.repeat(64),ownerToken:'1'.repeat(32)});
 await store.markSubmitting({checkoutIdempotencyKey:'e'.repeat(32),ownerToken:'1'.repeat(32)});
 await store.markOutcomeUnknown({checkoutIdempotencyKey:'e'.repeat(32),ownerToken:'1'.repeat(32),errorCode:'TIMEOUT'});
 await store.reconcileCreated({checkoutIdempotencyKey:'e'.repeat(32),selectionSha256:'f'.repeat(64),providerOrderId:'GC-456',orderReadbackSha256:'2'.repeat(64),evidenceRef:'independent-native-readback'});
 assert.ok(calls.some(x=>x.includes("state='PROVIDER_OUTCOME_UNKNOWN'")));
 assert.ok(calls.some(x=>x.includes("state='ORDER_CREATED'")&&x.includes("state='PROVIDER_OUTCOME_UNKNOWN'")));
});
test('SQL migration declares durable unique checkout key and unique provider order ID',()=>{
 const sql=require('node:fs').readFileSync(require('node:path').join(__dirname,'native-order-idempotency.sql'),'utf8');
 assert.match(sql,/PRIMARY KEY\s*\(scope, checkout_idempotency_key\)/i);
 assert.match(sql,/UNIQUE INDEX[\s\S]*provider_order_id/i);
 assert.match(sql,/PROVIDER_OUTCOME_UNKNOWN/);
});
