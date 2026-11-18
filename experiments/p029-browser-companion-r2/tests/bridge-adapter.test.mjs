import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createBroker} from '../broker/server.mjs';
import {makeConsentedTabAdapter} from '../bridge-adapter/consented-tab-adapter.mjs';

test('adapter rejects off-device endpoints and missing credentials',()=>{
 const secret=()=>crypto.randomBytes(32).toString('hex');
 for(const addr of ['https://example.com','http://localhost:9248','http://169.254.169.254:9248','http://127.0.0.1:9248/evil','http://username@127.0.0.1:9248'])
  assert.throws(()=>makeConsentedTabAdapter({brokerUrl:addr,bridgeTokenProvider:secret}),/BROKER_ENDPOINT_NOT_LOOPBACK/);
 assert.throws(()=>makeConsentedTabAdapter({}),/LOCAL_BRIDGE_CREDENTIAL_MISSING/);
});
test('adapter returns explicit permission required, validates target, reads one only approved tab, revokes fail-closed',async()=>{
 const token=crypto.randomBytes(32).toString('hex'),pair='41792358',extOrigin='chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
 const broker=createBroker({bridgeToken:token,pairingCode:pair,port:19488});
 const client=makeConsentedTabAdapter({brokerUrl:'http://127.0.0.1:19488',bridgeTokenProvider:()=>token,timeoutMs:6000});
 const ext=async(route,method,body,auth)=>{
  const r=await fetch('http://127.0.0.1:19488'+route,{method,headers:{origin:extOrigin,...(auth?{authorization:'Bearer '+auth}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,body:await r.json()};
 };
 try{
  await broker.listen();
  const cold=await client.listAuthorizedTabs();
  assert.equal(cold.profileScope,'USER_TAB_PERMISSION_REQUIRED');assert.deepEqual(cold.tabs,[]);
  await assert.rejects(()=>client.readAuthorizedText({targetId:'cdp-target'}),/WRONG_PROFILE/);
  const paired=await ext('/pair','POST',{code:pair});
  assert.equal(paired.status,200);const session=paired.body.token;
  let tabs=await client.listAuthorizedTabs();assert.deepEqual(tabs.tabs,[]);assert.equal(tabs.nativeSessionAttached,true);
  const grantId='abcdef012345abcdef012345',targetId='ext:17:'+grantId;
  const approved={tabId:17,grantId,url:'https://example.org/page',title:'Example page',expiresAt:Date.now()+120000};
  const g=await ext('/extension/grants','POST',{grants:[approved]},session);assert.equal(g.status,200);
  tabs=await client.listAuthorizedTabs();assert.equal(tabs.tabs.length,1);assert.equal(tabs.tabs[0].id,targetId);
  await assert.rejects(()=>client.readAuthorizedText({targetId:'ext:18:'+grantId}),/USER_TAB_PERMISSION_REQUIRED/);
  await assert.rejects(()=>client.readAuthorizedText({targetId,selector:'input'}),/SELECTOR_NOT_AVAILABLE/);
  const pending=client.readAuthorizedText({targetId});
  // Explicit extension job execution from a synthetic page, not user data.
  let jobs;
  for(let i=0;i<20;i++){
   const rs=await ext('/extension/jobs','GET',undefined,session); jobs=rs.body.jobs||[];
   if(jobs.length)break;
   await new Promise(r=>setTimeout(r,20));
  }
  assert.equal(jobs.length,1);
  const answer=await ext('/extension/result','POST',{jobId:jobs[0].id,result:{ok:true,text:'APPROVED_SYNTHETIC_TEXT',title:'Example page'}},session);
  assert.equal(answer.status,200);
  const read=await pending;
  assert.equal(read.text,'APPROVED_SYNTHETIC_TEXT');assert.equal(read.source,'USER_CONSENTED_TAB');
  await ext('/extension/grants','POST',{grants:[]},session);
  await assert.rejects(()=>client.readAuthorizedText({targetId}),/USER_TAB_PERMISSION_REQUIRED/);
  await ext('/extension/disconnect','POST',{},session);
  tabs=await client.listAuthorizedTabs();assert.equal(tabs.profileScope,'USER_TAB_PERMISSION_REQUIRED');
 }finally{await broker.close();}
});
test('missing broker fails explicitly, never invents isolated targets',async()=>{
 const client=makeConsentedTabAdapter({brokerUrl:'http://127.0.0.1:19489',bridgeTokenProvider:()=>crypto.randomBytes(32).toString('hex'),timeoutMs:500});
 await assert.rejects(()=>client.listAuthorizedTabs(),/BROWSER_COMPANION_UNAVAILABLE/);
});
