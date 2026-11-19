'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const STAGE='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
const stage=process.env.BF2026_STAGE_ONLY==='1';
const quote=stage?require(STAGE+'/server.js').compute:null;
const {buildSetImportPlan}=require('./r130-set-lines.cjs');
const {createImportStep,serializeImportStep,normalizeImportAck,
 createImportTransport,ENDPOINT}=require('./r130-getcourse-import.cjs');
const K='a'.repeat(64),REV='b'.repeat(64),NONCE='A'.repeat(43),DEAL='812345678901234';
test('R130 2/3/4/5 product quotes allocate prices to existing offers and exact one-order total',
 {skip:!stage},()=>{
 const selections=[
  {kind:'set',items:['rejection','union']},
  {kind:'set',items:['rejection','union','dnv']},
  {kind:'set',items:['rejection_program','union','trainer','source'],source_variant:'1'},
  {kind:'set',items:['rejection_program','union','trainer','source','dnv'],source_variant:'2'}
 ];
 for(const selection of selections){
  const q=quote(selection),p=buildSetImportPlan({selection,quoteFn:quote});
  assert.equal(p.items_count,selection.items.length);
  assert.equal(p.provider_writes_required,selection.items.length);
  assert.equal(p.lines.reduce((x,y)=>x+y.discounted_line_price_rub,0),q.total_rub);
  assert.equal(p.desired_order_total_rub,q.total_rub);
  assert.equal(p.per_combination_offers_created,0);
  assert.equal(p.payment_link_released,false);
  for(const line of p.lines){
   assert.ok(Number.isSafeInteger(line.offer_id)&&line.offer_id>0);
   assert.ok(Number.isSafeInteger(line.discounted_line_price_rub)&&line.discounted_line_price_rub>0);
   assert.ok(line.access.every(x=>x.access_days_after_pay===365));
  }
 }
 const source=buildSetImportPlan({selection:{kind:'set',items:['union','source'],source_variant:'2'},quoteFn:quote});
 const src=source.lines.find(x=>x.key==='source');
 assert.equal(src.offer_id,8934987);assert.deepEqual(src.access.map(x=>x.training_id),[934905122,934905123]);
 const trainer=buildSetImportPlan({selection:{kind:'set',items:['trainer','dnv']},quoteFn:quote});
 assert.equal(trainer.lines.find(x=>x.key==='trainer').access[0].training_id,935051957);
});
test('R130 rejects invalid set selections, audio/program overlap and illegal third audio',{skip:!stage},()=>{
 for(const selection of [
  {kind:'set',items:['rejection']},
  {kind:'set',items:['rejection','rejection']},
  {kind:'set',items:['rejection','devaluation','guilt']},
  {kind:'set',items:['rejection_program','rejection']},
  {kind:'set',items:['source','trainer']},
  {kind:'set',items:['rejection','unknown']},
  {kind:'single',lot:1}
 ])assert.throws(()=>buildSetImportPlan({selection,quoteFn:quote}));
});
test('R130 official Import API serializes one line at a time, same order, discounts and unpaid',()=>{
 const lines=[
  {offer_id:8934973,discounted_line_price_rub:3000},
  {offer_id:8919715,discounted_line_price_rub:5400}
 ];
 for(let i=0;i<2;i++){
  const req=createImportStep({line:lines[i],index:i,total:2,dealNumber:DEAL,
   email:'buyer@example.org',nonce:NONCE,offerRevisionSha256:REV});
  assert.equal(req.system.multiple_offers,i?1:0);
  assert.equal(req.system.return_payment_link,0);
  assert.equal(req.deal.deal_number,DEAL);
  assert.equal(req.deal.deal_cost,lines[i].discounted_line_price_rub);
  assert.equal(req.deal.deal_is_paid,0);assert.equal(req.deal.deal_status,'new');
  assert.deepEqual(req.deal.addfields,{
   'BF2026 Consent Nonce':NONCE,'BF2026 Offer Revision SHA256':REV
  });
  const form=new URLSearchParams(serializeImportStep(req,'TEST_ONLY_'+K));
  const decoded=JSON.parse(Buffer.from(form.get('params'),'base64').toString('utf8'));
  assert.deepEqual(decoded,req);assert.equal(form.get('action'),'add');
 }
});
test('R130 strict import acknowledgements keep payment/receipt/grants unverified',()=>{
 const ack={success:true,action:'add',result:{success:true,deal_number:DEAL,deal_id:'123456789'}};
 const result=normalizeImportAck(ack,{dealNumber:DEAL});
 assert.equal(result.deal_id,'123456789');assert.equal(result.public_payment_link,null);
 assert.equal(result.actual_grants_verified,false);
 for(const mutated of [
  {...ack,result:{...ack.result,deal_number:'999999999999999'}},
  {...ack,result:{...ack.result,deal_id:'invalid'}},
  {...ack,success:false},
  {...ack,result:{...ack.result,error:true}},
  {...ack,action:'delete'}
 ])assert.throws(()=>normalizeImportAck(mutated,{dealNumber:DEAL}));
 assert.throws(()=>normalizeImportAck(ack,{dealNumber:DEAL,previousDealId:'987654'}));
});
test('R130 transport is disabled by default; documented endpoint pinned',async()=>{
 const transport=createImportTransport({keyProvider:()=>K,
  fetchImpl:()=>{throw Error('SHOULD_NEVER_CALL')}});
 await assert.rejects(transport.send({}),{code:'R130_GETCOURSE_ORDER_IMPORT_DISABLED_BY_DEFAULT'});
 assert.throws(()=>createImportTransport({endpoint:'https://evil.example/pl/api/deals',
  keyProvider:()=>K,fetchImpl:()=>{}}),{code:'R130_IMPORT_ENDPOINT_NOT_APPROVED'});
 assert.equal(ENDPOINT,'https://study.shkola-dnv.com/pl/api/deals');
});
