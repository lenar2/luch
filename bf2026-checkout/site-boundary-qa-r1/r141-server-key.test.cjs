'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {secureRead,credentialStatus,readNativeOrderFields}=require('./r141-server-key.cjs');
const KEY='R141_MOCK_ONLY_NOT_A_REAL_GETCOURSE_SECRET_'.repeat(2);
function temp(t){
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'r141-key-'));
 fs.chmodSync(d,0o700);
 const f=path.join(d,'getcourse_import.key');
 fs.writeFileSync(f,KEY,{mode:0o600});
 t.after(()=>fs.rmSync(d,{recursive:true,force:true}));
 return {d,f};
}
const native=[
 {id:23331550,title:'BF2026 Consent Nonce',type:'string',context_type:'deal',form_id:701330},
 {id:23331559,title:'BF2026 Offer Revision SHA256',type:'string',context_type:'deal',form_id:701330}
];
test('R141 existing key is only read with 0700/0600 owner private filesystem',t=>{
 const {d,f}=temp(t);
 assert.equal(secureRead(f),KEY);
 assert.equal(credentialStatus(f).configured,true);
 fs.chmodSync(f,0o644);
 assert.equal(credentialStatus(f).configured,false);
 fs.chmodSync(f,0o600);fs.chmodSync(d,0o755);
 assert.equal(credentialStatus(f).configured,false);
});
test('R141 read-only field catalog confirms two DEAL fields but NEVER write readiness',async t=>{
 const {f}=temp(t);let count=0;
 const read=await readNativeOrderFields({filePath:f,fetchImpl:async(url,args)=>{
  count++;assert.equal(url,'https://study.shkola-dnv.com/pl/api/account/fields');
  assert.equal(args.method,'POST');assert.equal(args.redirect,'error');
  const body=new URLSearchParams(args.body);
  assert.equal(body.get('action'),'get');assert.equal(body.get('key'),KEY);
  return {status:200,text:async()=>JSON.stringify({success:true,info:native})};
 }});
 assert.equal(count,1);
 assert.equal(read.native_order_fields_readback_verified,true);
 assert.deepEqual(read.fields.map(x=>x.id),[23331550,23331559]);
 assert.equal(read.fields[0].context_type,'deal');
 assert.equal(read.provider_write_capability_verified,false);
 assert.equal(read.callback_process_native_verified,false);
 assert.equal(read.public_release_allowed,false);
 assert(!JSON.stringify(read).includes(KEY));
});
test('R141 wrong field scope or missing data never verifies',async t=>{
 const {f}=temp(t);
 for(const info of [
  [{...native[0],context_type:'user'},native[1]],
  [native[0]],
  [{...native[0],form_id:1},native[1]]
 ]){
  const r=await readNativeOrderFields({filePath:f,fetchImpl:async()=>({
   status:200,text:async()=>JSON.stringify({success:true,info})
  })});
  assert.equal(r.native_order_fields_readback_verified,false);
 }
});
test('R141 missing key / HTTP errors fail before any provider write',async t=>{
 const {f}=temp(t);
 fs.unlinkSync(f);let called=0;
 const r=await readNativeOrderFields({filePath:f,fetchImpl:async()=>{called++;throw Error('never');}});
 assert.equal(r.native_order_fields_readback_verified,false);
 assert.equal(called,0);
});
