'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const crypto=require('node:crypto');
const {createSetOrderWorker}=require('./r130-set-order-worker.cjs');
const {createImportTransport,ENDPOINT}=require('./r130-getcourse-import.cjs');
const STAGE='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&
 process.env.BF2026_R130_LOCAL_FAKE_PROVIDER_ONLY==='1'&&
 process.env.BF2026_R115_DB_POOL_MODULE===STAGE+'/stage-pool-module.cjs';
test('R130 real PG16 + local HTTP mock of documented Import API: one order, all lines, replay and partial timeout HOLD',
 {skip:!enabled},async t=>{
 const {pool}=require(STAGE+'/stage-pool-module.cjs');
 const {compute}=require(STAGE+'/server.js');
 const nonce=crypto.randomBytes(32).toString('base64url'),revision='a'.repeat(64);
 const key=()=>crypto.randomBytes(32).toString('hex');
 const keys=[];
 const received=[];
 let failAfter=Infinity;
 const stub=http.createServer(async(req,res)=>{
  let bytes='';
  for await(const chunk of req)bytes+=chunk;
  const form=new URLSearchParams(bytes),p=JSON.parse(Buffer.from(form.get('params'),'base64').toString('utf8'));
  received.push({url:req.url,method:req.method,
   action:form.get('action'),key_present:Boolean(form.get('key')),
   deal_number:p.deal.deal_number,offer_id:p.deal.offer_id,
   deal_cost:p.deal.deal_cost,paid:p.deal.deal_is_paid,
   multiple:p.system.multiple_offers,return_link:p.system.return_payment_link,
   addfields:p.deal.addfields});
  res.setHeader('Content-Type','application/json');
  if(received.length===failAfter){
   res.writeHead(503);res.end(JSON.stringify({success:false,error:'TEST_ONLY_FAULT'}));return;
  }
  res.writeHead(200);
  res.end(JSON.stringify({success:true,action:'add',result:{
   success:true,deal_id:'991300123',deal_number:p.deal.deal_number}}));
 });
 await new Promise(resolve=>stub.listen(0,'127.0.0.1',resolve));
 const host='http://127.0.0.1:'+stub.address().port;
 const transport=createImportTransport({allowProviderNetwork:true,
  keyProvider:()=> 'TEST_ONLY_IMPORT_KEY_'+crypto.randomBytes(30).toString('hex'),
  fetchImpl:(url,opts)=>{
   assert.equal(url,ENDPOINT);
   return fetch(host,opts);
  }});
 const worker=createSetOrderWorker({pool,quoteFn:compute,transport,
  allowExternalWrites:true,testOnly:true});
 t.after(async()=>{
  try{
   await pool.query('DELETE FROM bf2026_r130_set_order_steps WHERE intent_key=ANY($1::char(64)[])',[keys]);
   await pool.query('DELETE FROM bf2026_r130_set_order_intents WHERE intent_key=ANY($1::char(64)[])',[keys]);
  }finally{stub.close();await pool.end()}
 });
 const selection={kind:'set',items:['rejection_program','union','trainer','source','dnv'],source_variant:'2'};
 const k=key();keys.push(k);
 const payload={idempotencyKey:k,selection,email:'r130-test-only@example.invalid',
  nonce,offerRevisionSha256:revision};
 const first=await worker.prepare(payload);
 assert.equal(first.plan.items_count,5);
 assert.equal(first.status.state,'PREPARED');
 assert.equal(first.status.public_payment_link,null);
 assert.equal(first.duplicate,false);
 const dupe=await worker.prepare(payload);
 assert.equal(dupe.duplicate,true);
 await assert.rejects(worker.prepare({...payload,selection:{kind:'set',items:['union','trainer']}}),
  {code:'R130_IDEMPOTENCY_KEY_BODY_CHANGED'});
 const complete=await worker.assembleOnce(payload);
 assert.equal(complete.state,'ALL_IMPORT_ACKED_HOLD_NATIVE_READBACK');
 assert.equal(complete.imported_line_count,5);
 assert.equal(complete.public_payment_link,null);
 assert.equal(complete.payment_verified,false);
 assert.equal(complete.actual_grants_verified,false);
 assert.equal(received.length,5);
 assert.equal(new Set(received.map(x=>x.deal_number)).size,1,'ALL lines same one order number');
 assert.deepEqual(received.map(x=>x.multiple),[0,1,1,1,1]);
 assert.equal(received.reduce((s,x)=>s+x.deal_cost,0),first.plan.desired_order_total_rub);
 assert.equal(received.every(x=>x.action==='add'&&x.method==='POST'&&x.paid===0&&
  x.return_link===0&&x.addfields['BF2026 Consent Nonce']===nonce),true);
 assert.equal((await worker.assembleOnce(payload)).state,'ALL_IMPORT_ACKED_HOLD_NATIVE_READBACK');
 assert.equal(received.length,5,'retry of completed import must not send duplicate writes');
 const rows=await pool.query('SELECT state,offer_id,line_amount_rub FROM bf2026_r130_set_order_steps WHERE intent_key=$1 ORDER BY step_index',[k]);
 assert.equal(rows.rows.length,5);
 assert.equal(rows.rows.every(x=>x.state==='ACKED'),true);
 // Second order: first position ACK, second response uncertain -> never retry.
 const selection2={kind:'set',items:['rejection','union','dnv']};
 const k2=key();keys.push(k2);
 const p2={...payload,idempotencyKey:k2,selection:selection2,
  nonce:crypto.randomBytes(32).toString('base64url')};
 await worker.prepare(p2);
 const previous=received.length;
 failAfter=previous+2;
 const partial=await worker.assembleOnce(p2);
 assert.equal(partial.state,'PROVIDER_UNKNOWN_MANUAL_RECONCILIATION');
 assert.equal(partial.imported_line_count,1);
 assert.equal(partial.public_payment_link,null);
 assert.equal(received.length,previous+2);
 const retry=await worker.assembleOnce(p2);
 assert.equal(retry.state,'PROVIDER_UNKNOWN_MANUAL_RECONCILIATION');
 assert.equal(received.length,previous+2,'UNKNOWN step cannot be automatically retried');
 const disabled=createSetOrderWorker({pool,quoteFn:compute,transport});
 const blocked=await disabled.assembleOnce(p2);
 assert.equal(blocked.state,'HOLD_GETCOURSE_IMPORT_DISABLED');
 assert.equal(blocked.provider_requests_sent,0);
 console.log('R130_STAGE_FAKE_IMPORT_ONLY',JSON.stringify({
  one_getcourse_order_number:received[0].deal_number,
  lines_first_order:5,canonical_total:first.plan.desired_order_total_rub,
  repeated_success_writes:0,partial_order_automatic_retries:0,
  native_provider_requests:0,public_payment_links:0,unverified_access_grants:true
 }));
});
