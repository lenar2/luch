'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs');
const {createBoundary}=require('./site-boundary.cjs');
const {
 prepareTrustedOrderPayload,verifyTrustedOrderPayload,verifyIndependentReview,
 createNativeOrderSiteIntegration,createNativeOrderPostgresStore,validateProviderCheckoutUrl
}=require('./native-order-site-integration.cjs');
const {canonical,sha256}=require('./native-order-execution-contract.cjs');
const {createBoundary:unused}=require('./site-boundary.cjs');
const adapter=createBoundary().adapter,secret=Buffer.alloc(32,0x5a);
const input={kind:'set',items:['rejection_program','union']};
const key='a'.repeat(32);
function prepared(opts={}){return prepareTrustedOrderPayload({adapter,input,secret,checkoutIdempotencyKey:key,now:2000000000,nonce:'b'.repeat(32),...opts})}
test('server recomputes trusted 11690 order payload with exact two native lines and 365d AFTER_PAY grants',()=>{
 const x=prepared(),v=verifyTrustedOrderPayload({adapter,token:x.signed_order_payload,secret,now:2000000001}),p=v.payload;
 assert.equal(x.quote.subtotal_rub,12990);assert.equal(x.quote.discount_percent,10);
 assert.equal(x.quote.discount_rub,1300);assert.equal(x.quote.total_rub,11690);
 assert.equal(p.schema,'bf2026.getcourse.trusted-order-payload.v1');
 assert.equal(p.selection_key,'set:rejection_program|union');
 assert.deepEqual(p.lines.map(l=>[l.offer_id,l.product_id,l.training_id,l.quantity,l.unit_price_rub]),[
  [8933492,4557988,936022301,1,6990],[8919715,4550895,933861292,1,6000]]);
 assert.deepEqual(p.lines.map(l=>[l.grant.trigger,l.grant.start,l.grant.duration_days]),[
  ['CONFIRMED_PAID_EVENT_ONLY','AFTER_PAY',365],['CONFIRMED_PAID_EVENT_ONLY','AFTER_PAY',365]]);
 assert.deepEqual(p.reconciliation.internal_discount_allocation.map(l=>[l.discount_allocation_rub,l.reconciled_line_total_rub]),[[700,6290],[600,5400]]);
 assert.equal(p.reconciliation.internal_discount_allocation.reduce((s,l)=>s+l.discount_allocation_rub,0),1300);
 assert.equal(p.reconciliation.internal_discount_allocation.reduce((s,l)=>s+l.reconciled_line_total_rub,0),11690);
 assert.equal(p.pricing.provider_discount_mode,'ONE_NATIVE_ORDER_LEVEL_CONDITIONAL_DISCOUNT');
 assert.equal(p.pricing.provider_promotion_ref,null);
 assert.equal(p.grant_policy.external_grant_writes,false);
 assert.equal(p.provenance.client_price_or_offer_ids_accepted,false);
 assert.equal(x.provider_order_status,'NOT_CREATED');assert.equal(x.route_enabled,false);assert.equal(x.checkout_url,null);
});
test('selection order is canonical but client price, Offer and coupon overrides are rejected',()=>{
 const reverse=prepareTrustedOrderPayload({adapter,input:{kind:'set',items:['union','rejection_program']},secret,checkoutIdempotencyKey:key,now:2000000000,nonce:'b'.repeat(32)});
 assert.equal(verifyTrustedOrderPayload({adapter,token:reverse.signed_order_payload,secret,now:2000000001}).payload.selection_key,'set:rejection_program|union');
 for(const bad of [
  {...input,total_rub:1},{...input,offer_ids:[1]},{...input,discount_percent:99},
  {...input,coupon:'FREE'},{...input,items:['rejection_program','union'],prices:[1,1]},
  {kind:'set',items:['rejection_program']},{kind:'single',lot:5}
 ])assert.throws(()=>prepareTrustedOrderPayload({adapter,input:bad,secret,checkoutIdempotencyKey:key,now:2000000000,nonce:'b'.repeat(32)}));
});
test('signed trusted order envelope rejects tamper, expiry, wrong HMAC and stale payload',()=>{
 const x=prepared(),token=x.signed_order_payload,parts=token.split('.');
 const tampered=parts[0]+'.'+parts[1].slice(0,-1)+(parts[1].endsWith('A')?'B':'A')+'.'+parts[2];
 assert.throws(()=>verifyTrustedOrderPayload({adapter,token:tampered,secret,now:2000000001}),{code:'ORDER_ENVELOPE_SIGNATURE_INVALID'});
 assert.throws(()=>verifyTrustedOrderPayload({adapter,token,secret,now:2000000400}),{code:'ORDER_ENVELOPE_EXPIRED_OR_INVALID'});
 assert.throws(()=>verifyTrustedOrderPayload({adapter,token,secret:Buffer.alloc(32,1),now:2000000001}),{code:'ORDER_ENVELOPE_SIGNATURE_INVALID'});
});
test('independent review requires a separate pinned Ed25519 reviewer and binds exact provider bundle',()=>{
 const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
 const bundle={schema:'bf2026.getcourse.provider-evidence.v1',provider:'GetCourse',capture_type:'LIVE_PROVIDER_CAPTURE',attested_by:'site-engineer',
  form:{widget_id:1686745,action_id:'2263283894'},order:{provider_order_id:'GC-UNPAID-1'}};
 const unsigned={schema:'bf2026.getcourse.native-capability-review.v1',provider:'GetCourse',
  scope:'LOT5_UNION_NATIVE_MULTI_OFFER_11690',decision:'PASS',reviewer_id:'independent-qa',
  reviewed_at:new Date(2000000000000).toISOString(),evidence_bundle_sha256:sha256(canonical(bundle)),
  legal_consent_negative_test_passed:true,duplicate_guard_negative_test_passed:true,
  legal_consent_negative_test_ref:'qa://consent-negative-1',duplicate_guard_negative_test_ref:'qa://duplicate-negative-1',
  widget_id:1686745,form_action_id:2263283894,provider_order_id:'GC-UNPAID-1'};
 const signature=crypto.sign(null,Buffer.from(canonical(unsigned)),privateKey).toString('base64url');
 const review={...unsigned,attestation:{algorithm:'Ed25519',key_id:'qa-key',signature}};
 const keys={'qa-key':{publicKey,trust_level:'INDEPENDENT_QA_REVIEWER',usage:'BF2026_GETCOURSE_NATIVE_CAPABILITY_REVIEW'}};
 const valid=verifyIndependentReview({review,evidenceBundle:bundle,reviewerKeys:keys,nowMs:2000000000000});
 assert.equal(valid.provider_order_id,'GC-UNPAID-1');
 const {assertReviewMatchesEvidence}=require('./native-order-site-integration.cjs');
 assert.throws(()=>assertReviewMatchesEvidence({...valid,reviewer_id:'site-engineer'},{attested_by:'site-engineer',form:{widget_id:1686745,action_id:'2263283894'},order:{provider_order_id:'GC-UNPAID-1'}}),{code:'INDEPENDENT_REVIEWER_MUST_DIFFER_FROM_CAPTURE_ATTESTOR'});
 assert.throws(()=>verifyIndependentReview({review,evidenceBundle:{...bundle,form:{widget_id:1}},reviewerKeys:keys,nowMs:2000000000000}),{code:'INDEPENDENT_REVIEW_EVIDENCE_MISMATCH'});
 assert.throws(()=>verifyIndependentReview({review,evidenceBundle:bundle,reviewerKeys:{'qa-key':{...keys['qa-key'],trust_level:'TEST_ONLY'}},nowMs:2000000000000}),{code:'INDEPENDENT_REVIEW_TRUST_KEY_INVALID'});
});
test('site integration prepare is local; start stays HOLD without trusted native evidence',async()=>{
 let reserves=0,providerCalls=0;
 const store={reserve:async()=>{reserves++;return {status:'NEW'}},bindPayload:async()=>{},markSubmitting:async()=>{},commit:async()=>{},markOutcomeUnknown:async()=>{}};
 const provider={name:'GetCourse',mode:'NATIVE_MULTI_OFFER_FORM',createNativeOrder:async()=>{providerCalls++;}};
 const integration=createNativeOrderSiteIntegration({adapter,secret,store,provider});
 const p=integration.prepare(input,{checkoutIdempotencyKey:key,now:2000000000,nonce:'b'.repeat(32)});
 assert.equal(p.quote.total_rub,11690);
 await assert.rejects(()=>integration.start({signedOrderPayload:p.signed_order_payload,now:2000000001}),{code:'NATIVE_PROVIDER_CAPABILITY_HOLD'});
 assert.equal(reserves,0);assert.equal(providerCalls,0);
});
test('provider checkout URL is HTTPS and exact GetCourse host only',()=>{
 assert.equal(validateProviderCheckoutUrl('https://study.shkola-dnv.com/pl/lite/pay?id=1'),'https://study.shkola-dnv.com/pl/lite/pay?id=1');
 for(const u of ['http://study.shkola-dnv.com/pay','https://evil.invalid/pay',
  'https://study.shkola-dnv.com.evil.invalid/pay','https://u:p@study.shkola-dnv.com/pay',
  'https://study.shkola-dnv.com/pay#frag'])assert.throws(()=>validateProviderCheckoutUrl(u),{code:'PROVIDER_CHECKOUT_URL_UNTRUSTED'});
});
function makeFakePg(){
 const rows=new Map(),events=new Map(),paidIds=new Set();
 const k=x=>'BF2026:'+x;
 async function run(sql,p=[]){
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rowCount:0,rows:[]};
  if(sql.startsWith('INSERT INTO bf2026_native_checkout_idempotency')){
   const id=k(p[0]);if(rows.has(id))return {rowCount:0,rows:[]};
   rows.set(id,{scope:'BF2026',checkout_idempotency_key:p[0],selection_sha256:p[1],state:'RESERVED',
    lease_owner:p[2],lease_expires_at:new Date(Date.now()+Number(p[3])*1000),provider_order_id:null,
    trusted_order_payload_sha256:null,paid_event_id:null});
   return {rowCount:1,rows:[{state:'RESERVED'}]};
  }
  if(sql.startsWith('SELECT selection_sha256,state,lease_expires_at,provider_order_id')){
   const row=rows.get(k(p[0]));return {rowCount:row?1:0,rows:row?[{...row}]:[]};
  }
  if(sql.startsWith('UPDATE bf2026_native_checkout_idempotency SET lease_owner=')){
   const row=rows.get(k(p[0]));if(row&&row.state==='RESERVED'&&row.lease_expires_at<=new Date()){
    row.lease_owner=p[1];row.lease_expires_at=new Date(Date.now()+Number(p[2])*1000);return {rowCount:1,rows:[]};}
   return {rowCount:0,rows:[]};
  }
  if(sql.startsWith('SELECT state,selection_sha256,trusted_order_payload_sha256')){
   const row=rows.get(k(p[0]));return {rowCount:row?1:0,rows:row?[{...row}]:[]};
  }
  if(sql.startsWith("UPDATE bf2026_native_checkout_idempotency SET state='ORDER_CREATED'")&&sql.includes("state='PROVIDER_OUTCOME_UNKNOWN'")){
   const row=rows.get(k(p[0]));if(!row||row.state!=='PROVIDER_OUTCOME_UNKNOWN'||row.selection_sha256!==p[1]||row.trusted_order_payload_sha256!==p[5])return {rowCount:0,rows:[]};
   row.state='ORDER_CREATED';row.provider_order_id=p[2];return {rowCount:1,rows:[]};
  }
  if(sql.startsWith('SELECT state,provider_order_id,trusted_order_payload_sha256')){
   const row=rows.get(k(p[0]));return {rowCount:row?1:0,rows:row?[{...row}]:[]};
  }
  if(sql.startsWith('INSERT INTO bf2026_native_checkout_paid_events')){
   const id=p[0]+':'+p[1];if(events.has(id)||paidIds.has(p[1]))return {rowCount:0,rows:[]};
   const row={provider_order_id:p[0],paid_event_id:p[1],checkout_idempotency_key:p[2],
    paid_total_rub:p[3],paid_readback_sha256:p[4],evidence_ref:p[5]};
   events.set(id,row);paidIds.add(p[1]);return {rowCount:1,rows:[row]};
  }
  if(sql.startsWith('SELECT checkout_idempotency_key,paid_total_rub,paid_readback_sha256,evidence_ref')){
   const row=events.get(p[0]+':'+p[1]);return {rowCount:row?1:0,rows:row?[{...row}]:[]};
  }
  if(sql.startsWith('UPDATE bf2026_native_checkout_idempotency SET paid_event_id=')){
   const row=rows.get(k(p[0]));if(!row||row.state!=='ORDER_CREATED'||row.provider_order_id!==p[4]||
    row.trusted_order_payload_sha256!==p[5]||(row.paid_event_id&&row.paid_event_id!==p[1]))return {rowCount:0,rows:[]};
   row.paid_event_id=p[1];row.paid_readback_sha256=p[2];row.paid_evidence_ref=p[3];return {rowCount:1,rows:[]};
  }
  throw new Error('UNHANDLED_FAKE_PG_TX '+sql);
 }
 const client={query:run,release(){}};
 const pool={connect:async()=>client,query:async(sql,p=[])=>{
  if(sql.startsWith("UPDATE bf2026_native_checkout_idempotency SET trusted_order_payload_sha256=")){
   const row=rows.get(k(p[0]));if(!row||row.state!=='RESERVED'||row.lease_owner!==p[1]||
    row.selection_sha256!==p[3]||(row.trusted_order_payload_sha256&&row.trusted_order_payload_sha256!==p[2]))return {rowCount:0,rows:[]};
   row.trusted_order_payload_sha256=p[2];return {rowCount:1,rows:[]};
  }
  if(sql.includes("SET state='PROVIDER_SUBMITTING'")){
   const row=rows.get(k(p[0]));if(!row||row.state!=='RESERVED'||row.lease_owner!==p[1])return {rowCount:0,rows:[]};
   row.state='PROVIDER_SUBMITTING';return {rowCount:1,rows:[]};
  }
  if(sql.includes("SET state='ORDER_CREATED'")&&sql.includes("state='PROVIDER_SUBMITTING'")){
   const row=rows.get(k(p[0]));if(!row||row.state!=='PROVIDER_SUBMITTING'||row.lease_owner!==p[1])return {rowCount:0,rows:[]};
   row.state='ORDER_CREATED';row.provider_order_id=p[2];return {rowCount:1,rows:[]};
  }
  if(sql.includes("SET state='PROVIDER_OUTCOME_UNKNOWN'")){
   const row=rows.get(k(p[0]));if(!row||row.state!=='PROVIDER_SUBMITTING'||row.lease_owner!==p[1])return {rowCount:0,rows:[]};
   row.state='PROVIDER_OUTCOME_UNKNOWN';return {rowCount:1,rows:[]};
  }
  throw new Error('UNHANDLED_FAKE_PG '+sql);
 }};
 return {pool,rows,events};
}
test('Postgres store binds payload hash, commits one provider order and deduplicates paid event',async()=>{
 const {pool,rows}=makeFakePg(),store=createNativeOrderPostgresStore(pool);
 const key='c'.repeat(32),sel='d'.repeat(64),payload='e'.repeat(64),owner='f'.repeat(32);
 assert.equal((await store.reserve({checkoutIdempotencyKey:key,selectionSha256:sel,ownerToken:owner})).status,'NEW');
 await store.bindPayload({checkoutIdempotencyKey:key,selectionSha256:sel,payloadSha256:payload,ownerToken:owner});
 await store.markSubmitting({checkoutIdempotencyKey:key,ownerToken:owner});
 await store.commit({checkoutIdempotencyKey:key,ownerToken:owner,providerOrderId:'GC-ORDER-42',
  orderReadbackSha256:'1'.repeat(64),evidenceRef:'artifact://native-order-42'});
 const event={checkoutIdempotencyKey:key,providerOrderId:'GC-ORDER-42',paidEventId:'GC-PAY-42',
  payloadSha256:payload,paidReadbackSha256:'2'.repeat(64),evidenceRef:'artifact://paid-order-42',paidTotalRub:11690};
 assert.equal((await store.recordPaidVerification(event)).status,'RECORDED');
 assert.equal((await store.recordPaidVerification(event)).status,'REPLAY');
 assert.equal(rows.get('BF2026:'+key).paid_event_id,'GC-PAY-42');
 await assert.rejects(()=>store.recordPaidVerification({...event,paidReadbackSha256:'3'.repeat(64)}),{code:'PAID_EVENT_IDEMPOTENCY_CONFLICT'});
});

test('unknown provider outcome can only reconcile with the same signed payload hash and native order readback',async()=>{
 const {pool,rows}=makeFakePg(),store=createNativeOrderPostgresStore(pool);
 const key='7'.repeat(32),sel='8'.repeat(64),payload='9'.repeat(64),owner='a'.repeat(32);
 await store.reserve({checkoutIdempotencyKey:key,selectionSha256:sel,ownerToken:owner});
 await store.bindPayload({checkoutIdempotencyKey:key,selectionSha256:sel,payloadSha256:payload,ownerToken:owner});
 await store.markSubmitting({checkoutIdempotencyKey:key,ownerToken:owner});
 await store.markOutcomeUnknown({checkoutIdempotencyKey:key,ownerToken:owner,errorCode:'ETIMEDOUT'});
 await assert.rejects(()=>store.reconcileCreated({checkoutIdempotencyKey:key,selectionSha256:sel,payloadSha256:'b'.repeat(64),
  providerOrderId:'GC-ORDER-UNKNOWN',orderReadbackSha256:'c'.repeat(64),evidenceRef:'artifact://readback'}),{code:'IDEMPOTENCY_RECONCILIATION_PAYLOAD_MISMATCH'});
 const ok=await store.reconcileCreated({checkoutIdempotencyKey:key,selectionSha256:sel,payloadSha256:payload,
  providerOrderId:'GC-ORDER-UNKNOWN',orderReadbackSha256:'c'.repeat(64),evidenceRef:'artifact://readback'});
 assert.equal(ok.status,'RECONCILED');assert.equal(rows.get('BF2026:'+key).provider_order_id,'GC-ORDER-UNKNOWN');
});

test('paid event cannot be recorded for unknown, wrong-order or unbound payload',async()=>{
 const {pool}=makeFakePg(),store=createNativeOrderPostgresStore(pool);
 await assert.rejects(()=>store.recordPaidVerification({checkoutIdempotencyKey:'a'.repeat(32),
  providerOrderId:'GC-1',paidEventId:'EV-1',payloadSha256:'b'.repeat(64),
  paidReadbackSha256:'c'.repeat(64),evidenceRef:'artifact://x',paidTotalRub:11690}),{code:'PAID_EVENT_NOT_BOUND_TO_CREATED_ORDER'});
});
test('SQL migration adds signed payload binding and unique native paid-event ledger',()=>{
 const sql=fs.readFileSync(__dirname+'/native-order-site-integration.sql','utf8');
 assert.match(sql,/trusted_order_payload_sha256/);
 assert.match(sql,/bf2026_native_checkout_paid_events/);
 assert.match(sql,/UNIQUE\s*\(paid_event_id\)/);
 assert.match(sql,/FOREIGN KEY\s*\(scope,\s*checkout_idempotency_key\)/);
});
