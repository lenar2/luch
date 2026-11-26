import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createBroker} from '../broker/server.mjs';
import {makeConsentedTabAdapter} from '../bridge-adapter/consented-tab-adapter.mjs';

test('open tabs are private by default, require explicit approval and never expose URL secrets',async()=>{
 const secret=crypto.randomBytes(32).toString('hex');
 const broker=createBroker({bridgeToken:secret,pairingCode:'27483591',port:19544});
 const origin='chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
 async function request(path,{method='GET',body,extensionToken,bridge=false}={}){
  const r=await fetch('http://127.0.0.1:19544'+path,{method,
   headers:{...(extensionToken?{authorization:'Bearer '+extensionToken,origin}:{}),
    ...(bridge?{'x-browser-bridge-token':secret}:{}),
    ...(body?{'content-type':'application/json'}:{})},
   body:body?JSON.stringify(body):undefined
  });
  return {status:r.status,body:await r.json()};
 }
 try{
  await broker.listen();
  const unauthorized=await request('/v1/open-tabs',{bridge:true});
  assert.equal(unauthorized.status,403);
  const paired=await request('/pair',{method:'POST',body:{code:'27483591'},extensionToken:null});
  // /pair always requires a real extension Origin
  assert.equal(paired.status,403);
  const r=await fetch('http://127.0.0.1:19544/pair',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({code:'27483591'})});
  assert.equal(r.status,200);
  const token=(await r.json()).token;
  assert.equal((await request('/v1/open-tabs',{bridge:true})).status,403);
  const published=await request('/extension/tab-overview',{method:'POST',extensionToken:token,body:{
   enabled:true,
   tabs:[{id:11,title:'Research',url:'https://example.com/private/path?token=secret#hash',windowId:3,active:true},
         {id:12,title:'Tasks',url:'https://example.org/tasks',windowId:3,active:false}]
  }});
  assert.equal(published.status,200);assert.equal(published.body.count,2);
  const got=await request('/v1/open-tabs',{bridge:true});
  assert.equal(got.status,200);
  assert.equal(got.body.profileScope,'USER_APPROVED_TAB_METADATA_ONLY');
  assert.equal(got.body.pageContentsShared,false);
  assert.equal(got.body.tabs.length,2);
  assert.equal(got.body.tabs[0].url,'https://example.com/private/path');
  assert.ok(!JSON.stringify(got.body).includes('token=secret'));
  assert.equal((await request('/v1/open-tabs')).status,403,'no anonymous metadata access');
  const revoked=await request('/extension/tab-overview',{method:'POST',extensionToken:token,body:{enabled:false,tabs:[]}});
  assert.equal(revoked.status,200);
  assert.equal((await request('/v1/open-tabs',{bridge:true})).status,403);
 }finally{await broker.close()}
});

test('precise pointer requires interaction grant AND separate cursor consent, never read-only',async()=>{
 const secret=crypto.randomBytes(32).toString('hex');
 const broker=createBroker({bridgeToken:secret,pairingCode:'92746310',port:19545});
 const origin='chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
 const url='http://127.0.0.1:19545';
 const adapter=makeConsentedTabAdapter({brokerUrl:url,bridgeTokenProvider:()=>secret});
 async function extension(path,method,body,token){
  const r=await fetch(url+path,{method,headers:{origin,authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},
   body:body?JSON.stringify(body):undefined});
  return {status:r.status,body:await r.json()};
 }
 try{
  await broker.listen();
  const r=await fetch(url+'/pair',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{"code":"92746310"}'});
  assert.equal(r.status,200);const token=(await r.json()).token;
  const grant={tabId:7,grantId:'a'.repeat(24),url:'https://example.org/',title:'Safe',scope:'read',preciseCursor:false};
  assert.equal((await extension('/extension/grants','POST',{grants:[grant]},token)).status,200);
  const targetId='ext:7:'+grant.grantId;
  await assert.rejects(adapter.runAuthorizedAction({targetId,op:'pointer_move',args:{x:5,y:5}}),/INTERACTION_APPROVAL_REQUIRED/);
  await extension('/extension/grants','POST',{grants:[{...grant,scope:'interact'}]},token);
  await assert.rejects(adapter.runAuthorizedAction({targetId,op:'pointer_click',args:{x:5,y:5}}),/PRECISE_CURSOR_APPROVAL_REQUIRED/);
  await extension('/extension/grants','POST',{grants:[{...grant,scope:'interact',preciseCursor:true}]},token);
  const work=adapter.runAuthorizedAction({targetId,op:'pointer_move',args:{x:5,y:5}});
  let jobs=(await extension('/extension/jobs','GET',undefined,token)).body.jobs;
  for(let i=0;i<15&&!jobs.length;i++){
   await new Promise(r=>setTimeout(r,10));
   jobs=(await extension('/extension/jobs','GET',undefined,token)).body.jobs;
  }
  assert.equal(jobs.length,1);assert.equal(jobs[0].op,'pointer_move');
  const posted=await extension('/extension/result','POST',{jobId:jobs[0].id,result:{ok:true,data:{operation:'pointer_move'}}},token);
  assert.equal(posted.status,200);
  assert.equal((await work).data.operation,'pointer_move');
  await extension('/extension/grants','POST',{grants:[]},token);
  await assert.rejects(adapter.runAuthorizedAction({targetId,op:'pointer_move',args:{x:1,y:1}}),/USER_TAB_PERMISSION_REQUIRED/);
 }finally{await broker.close()}
});
