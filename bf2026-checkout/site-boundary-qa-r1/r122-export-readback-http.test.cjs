'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {createQARouter}=require('./r121-bundle-qa-http.cjs');
const key='R122_TEST_QA_KEY_'.padEnd(32,'x');
async function serve(t,router){
 const s=http.createServer((req,res)=>router(req,res,new URL(req.url,'http://localhost').pathname));
 await new Promise((ok,err)=>{s.once('error',err);s.listen(0,'127.0.0.1',ok)});
 t.after(()=>new Promise(ok=>s.close(ok)));
 return 'http://127.0.0.1:'+s.address().port+'/api/checkout/_qa/native-bundle-readback/';
}
async function post(base,body,auth=true){
 const r=await fetch(base+'export-readback',{method:'POST',headers:{
  'content-type':'application/json','x-bf2026-idempotency-key':'a'.repeat(32),...(auth?{'x-qa':key}:{})},body:JSON.stringify(body)});
 return {status:r.status,body:await r.json()};
}
test('R122 export-readback route fails closed until API key provider configured',async t=>{
 const router=createQARouter({qaAuthorized:req=>req.headers['x-qa']===key});
 const base=await serve(t,router);
 const unauth=await fetch(base+'status');assert.equal(unauth.status,404);
 const status=await fetch(base+'status',{headers:{'x-qa':key}});
 assert.equal(status.status,503);
 const s=await status.json();assert.equal(s.export_reader_configured,false);
 const r=await post(base,{});assert.equal(r.status,503);
 assert.equal(r.body.code,'GETCOURSE_READBACK_SECRET_OR_LEDGER_UNCONFIGURED');
 assert.equal(r.body.receipt_verified,false);assert.equal(r.body.grants_verified,false);
});
test('R122 export-readback route returns only sanitized read-only order/payment fields',async t=>{
 let calls=0;
 const exportReader={async readBundleOrderAndPayment(){calls++;return {
  state:'VERIFIED_UNPAID_ORDER',source:'GETCOURSE_EXPORT_API_READONLY',
  deal_id:'924624456',order_number:'71994',user_id:'524210421',
  email:'must-not-leak@example.invalid',offer_id:8935004,order_total_rub:11690,
  order_status:'new',paid_total_rub:0,payment_record_verified:false,
  receipt_verified:true,grants_verified:true
 }}};
 const router=createQARouter({qaAuthorized:req=>req.headers['x-qa']===key,exportReader,
  readbackOnce:async id=>{assert.equal(id,'a'.repeat(32));return exportReader.readBundleOrderAndPayment()}});
 const base=await serve(t,router);
 const r=await post(base,{});assert.equal(r.status,200);assert.equal(calls,1);
 assert.equal(r.body.state,'VERIFIED_UNPAID_ORDER');
 assert.equal(r.body.deal_id,'924624456');assert.equal(r.body.offer_id,8935004);
 assert.equal(r.body.order_total_rub,11690);assert.equal(r.body.order_status,'new');
 assert.equal(r.body.payment_record_verified,false);
 assert.equal(r.body.receipt_verified,false);assert.equal(r.body.grants_verified,false);
 assert.equal(r.body.provider_signature_verified,false);assert.equal(r.body.release_allowed,false);
 assert.equal('user_id' in r.body,false);assert.equal('email' in r.body,false);
 const bad=await post(base,{event_id:'caller-controlled'});assert.equal(bad.status,422);
 assert.equal(calls,1);
});
