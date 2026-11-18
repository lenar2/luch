'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createBoundary}=require('./site-boundary.cjs');
const {createFallbackBoundary}=require('./fallback-site-bridge.cjs');
const adapter=createBoundary().adapter;
const bridge=createFallbackBoundary({adapter});
const input={kind:'set',items:['rejection_program','union']};
test('site bridge computes exact R109 11690 quote with line-level discount provenance without any provider call',()=>{
 const q=bridge.quote(input);
 assert.equal(q.http_status,200);assert.equal(q.ok,true);
 assert.equal(q.quote.total_rub,11690);
 assert.equal(q.quote.lines.length,2);
 assert.deepEqual(q.quote.lines.map(x=>[x.offer_id,x.allocated_price_rub]),[[8933492,6290],[8919715,5400]]);
 assert.equal(q.provider_order_status,'NOT_CREATED');
 assert.equal(q.checkout_url,null);
 assert.equal(q.sales_ready,false);
});
test('all documented fallback modes fail closed at 503 without real native evidence',()=>{
 for(const mode of ['NATIVE_ONE_OFFER_MULTIPLE_PRODUCTS','NATIVE_GETCOURSE_CART','SEQUENTIAL_IMPORT_DEALS','UNKNOWN']){
  const x=bridge.start(input,{mode});
  assert.equal(x.http_status,503);assert.equal(x.ok,false);
  assert.equal(x.route_enabled,false);assert.equal(x.verified_sale_routes_increment,0);
  assert.equal(x.order_created,false);assert.equal(x.provider_write_performed,false);
  assert.equal(x.grant_write_performed,false);assert.equal(x.checkout_url,null);assert.equal(x.payment_link,null);
 }
});
test('caller-supplied boolean provider attestations cannot open the bundle fallback',()=>{
 const x=bridge.start(input,{mode:'NATIVE_ONE_OFFER_MULTIPLE_PRODUCTS',
  evidence:{bundleReadback:{},unpaidReadback:{},paidReadback:{},verifiedAttestation:true}});
 assert.equal(x.http_status,503);assert.equal(x.route_enabled,false);assert.equal(x.payment_link,null);
});
test('site bridge rejects client-side total override and unsupported selection before quote or route',()=>{
 assert.throws(()=>bridge.quote({...input,total_rub:12990}),{code:'CLIENT_PRICING_OVERRIDE_FORBIDDEN'});
 assert.throws(()=>bridge.quote({kind:'single',lot:5}),{code:'UNVERIFIED_NATIVE_LOT5_UNION_MAPPING'});
});
