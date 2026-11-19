'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createGetCourseImportAdapter,DEFAULT_KEY_FILE}=require('./r144-getcourse-import-adapter.cjs');
const KEY='R144_MOCK_ONLY_NEVER_A_REAL_GETCOURSE_KEY_'.repeat(2);
function temp(t){
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'r144-key-'));fs.chmodSync(d,0o700);
 const f=path.join(d,'private.key');fs.writeFileSync(f,KEY,{mode:0o600});
 t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return f;
}
const fields=[
 {id:23331550,title:'BF2026 Consent Nonce',type:'string',context_type:'deal',form_id:701330},
 {id:23331559,title:'BF2026 Offer Revision SHA256',type:'string',context_type:'deal',form_id:701330}
];
test('R144 defaults only to the owner-confirmed private key path',()=>{
 assert.equal(DEFAULT_KEY_FILE,'/app/private/getcourse-import.key');
});
test('R144 successful fields response grants READ-ONLY capability only',async t=>{
 const filePath=temp(t);let calls=0;
 const a=createGetCourseImportAdapter({filePath,fetchImpl:async(url,init)=>{
  calls++;assert.equal(url,'https://study.shkola-dnv.com/pl/api/account/fields');
  assert.equal(init.method,'POST');assert.equal(init.redirect,'error');
  const body=new URLSearchParams(init.body);
  assert.equal(body.get('action'),'Get');assert.equal(body.get('key'),KEY);
  return {status:200,text:async()=>JSON.stringify({success:true,info:fields})};
 }});
 const r=await a.probeReadOnly();
 assert.equal(calls,1);assert.equal(r.ok,true);assert.equal(r.auth_state,'READ_ONLY_AUTHENTICATED');
 assert.equal(r.account_id,67138);assert.equal(r.api_key_row_id,54763);
 assert.equal(r.native_order_fields_readback_verified,true);
 assert.equal(r.provider_write_capability_verified,false);
 assert.equal(r.realtime_checkout_supported,false);
 assert.equal(r.live_unpaid_order_readback_supported,false);
 assert.equal(r.payment_link_supported,false);
 assert.equal(r.public_release_allowed,false);assert.equal(r.secret_exposed,false);
 assert(!JSON.stringify(r).includes(KEY));
});
test('R144 901 stays fail-closed and is not mislabeled as an outage',async t=>{
 const filePath=temp(t);
 const a=createGetCourseImportAdapter({filePath,fetchImpl:async()=>({
  status:200,text:async()=>JSON.stringify({success:false,error_code:901,error_message:'not returned'})
 })});
 const r=await a.probeReadOnly();
 assert.equal(r.ok,false);assert.equal(r.auth_state,'UNAUTHORIZED');
 assert.equal(r.code,'R141_GETCOURSE_901_UNAUTHORIZED_ACCOUNT_OR_KEY');
 assert.equal(r.provider_error_code,901);assert.equal(r.public_release_allowed,false);
});
test('R144 denies order creation, live readback and link calls without network activity',async t=>{
 const filePath=temp(t);let calls=0;
 const a=createGetCourseImportAdapter({filePath,fetchImpl:async()=>{calls++;throw Error('not called')}});
 assert.equal((await a.createUnpaidOrder({})).code,'R144_GETCOURSE_IMPORT_API_NOT_REALTIME_CHECKOUT');
 assert.equal((await a.readUnpaidOrder({})).code,'R144_GETCOURSE_EXPORT_API_NOT_REALTIME_READBACK');
 assert.equal((await a.getPaymentLink({})).code,'R144_GETCOURSE_PAYMENT_LINK_NOT_AVAILABLE');
 assert.equal(calls,0);
});
test('R144 HTTP 200 success=false is never authentication success',async t=>{
 const filePath=temp(t);
 const a=createGetCourseImportAdapter({filePath,fetchImpl:async()=>({
  status:200,text:async()=>JSON.stringify({success:false,error_code:901})
 })});
 const r=await a.probeReadOnly();
 assert.equal(r.ok,false);assert.equal(r.provider_write_capability_verified,false);
 assert.equal(r.public_release_allowed,false);
});
test('R144 missing key does not issue a request',async t=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'r144-bad-'));fs.chmodSync(d,0o700);
 const f=path.join(d,'missing.key');t.after(()=>fs.rmSync(d,{recursive:true,force:true}));
 let calls=0;const a=createGetCourseImportAdapter({filePath:f,fetchImpl:async()=>{calls++;}});
 const r=await a.probeReadOnly();
 assert.equal(calls,0);assert.equal(r.ok,false);assert.equal(r.auth_state,'UNKNOWN');
 assert.equal(r.code,'R141_KEY_NOT_PROVISIONED');
});
