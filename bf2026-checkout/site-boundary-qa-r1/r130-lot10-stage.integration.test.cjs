'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const STAGE='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&
 process.env.BF2026_R130_LOT10_STAGE_PORT==='18776'&&
 process.env.BF2026_STAGE_PG_POOL_MODULE===STAGE+'/stage-pool-module.cjs';
test('R130 real isolated site HTTP and PostgreSQL: dynamic 2-5 offers, discount, rejection, no charge', {skip:!enabled},async t=>{
 const {pool}=require(STAGE+'/stage-pool-module.cjs');
 const base='http://127.0.0.1:18776',preview='http://127.0.0.1:18777';
 t.after(()=>pool.end());
 async function request(url,{method='GET',body,origin='https://wf.tati-lar.ru'}={}){
  const headers={};if(origin)headers.origin=origin;
  if(body!==undefined)headers['content-type']='application/json';
  const r=await fetch(url,{method,headers,redirect:'error',
   body:body===undefined?undefined:JSON.stringify(body)});
  return {status:r.status,body:await r.json()};
 }
 await t.test('provider Import API disabled, zero released routes',async()=>{
  for(const host of [base,preview]){
   const s=await request(host+'/api/checkout/set/status');
   assert.equal(s.status,200);assert.equal(s.body.live_provider_import_enabled,false);
   assert.equal(s.body.sale_ready,false);assert.equal(s.body.public_release_allowed,false);
   assert.equal(s.body.checkout_url,null);
  }
  const global=await request(base+'/api/checkout/status');
  assert.equal(global.status,200);assert.equal(global.body.sales_ready,false);
  assert.equal(global.body.verified_sale_routes,0);
 });
 await t.test('existing 2-item set native offers and discounted total',async()=>{
  const body={kind:'set',items:['rejection','union']};
  const a=await request(base+'/api/checkout/set/plan',{method:'POST',body});
  assert.equal(a.status,200);
  assert.equal(a.body.order.expected_single_order,true);
  assert.deepEqual(a.body.order.expected_line_items.map(x=>x.offer_id),[8934973,8919715]);
  assert.equal(a.body.quote.total_rub,8400);
  assert.equal(a.body.order.expected_line_items.reduce((v,l)=>v+l.line_price_rub,0),8400);
  assert.equal(a.body.order.create_new_offer_count,0);
  assert.equal(a.body.checkout_url,null);
 });
 await t.test('5-item plan retains full Trainer and Source II dual training rights',async()=>{
  const body={kind:'set',items:['rejection_program','union','trainer','source','dnv'],source_variant:'2'};
  const a=await request(preview+'/api/checkout/set/plan',{method:'POST',body});
  assert.equal(a.status,200);
  assert.equal(a.body.order.expected_line_items.length,5);
  assert.equal(a.body.order.expected_payment_total_rub,37820);
  assert.equal(a.body.order.expected_line_items.reduce((v,l)=>v+l.line_price_rub,0),37820);
  const trainer=a.body.order.expected_line_items.find(x=>x.offer_id===8934247);
  assert.deepEqual(trainer.product_training_pairs.map(x=>x.training_id),[935051957]);
  const source=a.body.order.expected_line_items.find(x=>x.offer_id===8934987);
  assert.deepEqual(source.product_training_pairs.map(x=>x.training_id),[934905122,934905123]);
  assert.equal(a.body.public_release_allowed,false);
 });
 await t.test('forged client Offer, amount, checkbox or illegal source variant rejected',async()=>{
  for(const body of [
   {kind:'set',items:['rejection','union'],offer_id:123},
   {kind:'set',items:['rejection','union'],consent_checked:true},
   {kind:'set',items:['rejection','union'],price_rub:1},
   {kind:'set',items:['rejection','devaluation','guilt']},
   {kind:'set',items:['rejection_program','rejection']},
   {kind:'set',items:['source','union']},
   {kind:'set',items:['rejection']},
   {kind:'set',items:['rejection','union','dnv','trainer','source','guilt'],source_variant:'2'}
  ]){
   const r=await request(base+'/api/checkout/set/plan',{method:'POST',body});
   assert.equal(r.status,422);assert.equal(r.body.public_release_allowed,false);
  }
 });
 await t.test('wrong website Origin is blocked',async()=>{
  const r=await request(base+'/api/checkout/set/plan',{
   method:'POST',body:{kind:'set',items:['rejection','union']},origin:'https://attacker.invalid'
  });
  assert.equal(r.status,403);
 });
 await t.test('native GetCourse writes were not triggered; stage SQL ledger empty',async()=>{
  for(const table of [
   'bf2026_r130_set_order_intents','bf2026_r130_set_order_steps'
  ]){
   const q=await pool.query('SELECT count(*)::int n FROM '+table);
   assert.equal(q.rows[0].n,0);
  }
  for(const table of ['bf2026_r127_consent_challenges',
   'bf2026_getcourse_readback_once']){
   const q=await pool.query('SELECT count(*)::int n FROM '+table);
   assert.equal(q.rows[0].n,0);
  }
 });
});
