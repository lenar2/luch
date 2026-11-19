'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {verifyCallback,ingest,createStore,SCHEMA,HOST}=require('./getcourse-callback-hint.cjs');
function fixture(secret){
 const body={schema:SCHEMA,account_host:HOST,deal_id:'924624456',deal_number:'71994',
  offers:['8935004'],status:'payed',cost_money_value:'11690',payed_money:'11690',
  payed_at:new Date().toISOString(),created_at:new Date().toISOString()};
 return {rawBody:Buffer.from(JSON.stringify(body)),authorization:'Bearer '+secret.toString('hex'),
  accountHost:HOST,secret};
}
test('R122 callback authenticates shared secret and exact account/order/offer identity; still only a hint',async()=>{
 const secret=crypto.randomBytes(32),input=fixture(secret);
 const event=verifyCallback(input);
 assert.equal(event.provider_order_id,'924624456');assert.equal(event.order_number,'71994');
 assert.equal(event.offer_id,8935004);assert.equal(event.status_hint,'PAID');
 assert.equal(event.auth_method,'BEARER_SHARED_SECRET');
 assert.equal(event.provider_signature_verified,false);
 assert.equal(event.payment_verified,false);assert.equal(event.grants_verified,false);
 assert.equal(event.grant_writes,0);
});
test('R122 callback rejects bad secret, wrong account, wrong deal, offer, price, or extra PII',()=>{
 const secret=crypto.randomBytes(32),input=fixture(secret);
 assert.throws(()=>verifyCallback({...input,authorization:'Bearer '+'00'.repeat(32)}),{code:'GETCOURSE_CALLBACK_SHARED_SECRET_INVALID'});
 assert.throws(()=>verifyCallback({...input,accountHost:'wrong.example'}),{code:'GETCOURSE_CALLBACK_ACCOUNT_IDENTITY_MISMATCH'});
 for(const mutate of [
  b=>b.deal_id='1',b=>b.deal_number='1',b=>b.offers=['8934207'],
  b=>b.cost_money_value='12990',b=>b.status='payed',b=>b.payed_money='100',
  b=>b.email='buyer@example.test'
 ]){
  const b=JSON.parse(input.rawBody);mutate(b);
  assert.throws(()=>verifyCallback({...input,rawBody:Buffer.from(JSON.stringify(b))}));
 }
});
test('R122 callback exact replay deduplicates by raw body digest',async()=>{
 const secret=crypto.randomBytes(32),input=fixture(secret),rows=new Map();
 const store={async accept(e){if(rows.has(e.event_id))return {status:'DUPLICATE_HINT_ONLY',duplicate:true};rows.set(e.event_id,e);return {status:'ACCEPTED_HINT_ONLY',duplicate:false}}};
 const a=await ingest({...input,store}),b=await ingest({...input,store});
 assert.equal(a.status,'ACCEPTED_HINT_ONLY');assert.equal(a.payment_verified,false);
 assert.equal(b.status,'DUPLICATE_HINT_ONLY');assert.equal(b.duplicate,true);
 assert.equal(rows.size,1);
});
