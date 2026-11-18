import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createBroker} from '../broker/server.mjs';
import {makeConsentedTabAdapter} from '../bridge-adapter/consented-tab-adapter.mjs';
import {routeCompanionRequest,EXTENSION_ACTIONS} from '../bridge-integration/browser-companion-routes.mjs';

test('real browser bridge route converts authorized tab AI click to a delivered extension job',async()=>{
 const bridgeToken=crypto.randomBytes(32).toString('hex');
 const broker=createBroker({bridgeToken,pairingCode:'52978641',port:19492});
 const base='http://127.0.0.1:19492';
 const origin='chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
 const adapter=makeConsentedTabAdapter({brokerUrl:base,bridgeTokenProvider:()=>bridgeToken,timeoutMs:14500});
 const ext=async(path,method='GET',body,token)=>{
  const r=await fetch(base+path,{method,headers:{origin,...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  return{status:r.status,result:await r.json()};
 };
 try{
  await broker.listen();
  const pairing=await ext('/pair','POST',{code:'52978641'});
  assert.equal(pairing.status,200);const token=pairing.result.token;
  const grantId='abcdef012345abcdef012345',targetId='ext:19:'+grantId;
  const initial={tabId:19,grantId,url:'https://example.org/test',title:'Synthetic',scope:'read'};
  assert.equal((await ext('/extension/grants','POST',{grants:[initial]},token)).status,200);
  const denied=await routeCompanionRequest('/v1/click',{browser:'chrome',targetId,selector:'#safe'},adapter);
  assert.equal(denied.status,409);assert.equal(denied.body.error,'INTERACTION_APPROVAL_REQUIRED');
  const wrong=await routeCompanionRequest('/v1/click',{browser:'chrome',targetId:'ext:20:'+grantId,selector:'#safe'},adapter);
  assert.equal(wrong.status,409);assert.equal(wrong.body.error,'USER_TAB_PERMISSION_REQUIRED');
  const evalDenied=await routeCompanionRequest('/v1/evaluate',{browser:'chrome',targetId,expression:'1+1'},adapter);
  assert.equal(evalDenied.status,409);
  await ext('/extension/grants','POST',{grants:[{...initial,scope:'interact'}]},token);
  const pending=routeCompanionRequest('/v1/click',{browser:'chrome',targetId,selector:'#safe'},adapter);
  let jobs=(await ext('/extension/jobs','GET',undefined,token)).result.jobs;
  for(let i=0;!jobs.length&&i<20;i++){await new Promise(r=>setTimeout(r,15));jobs=(await ext('/extension/jobs','GET',undefined,token)).result.jobs}
  assert.equal(jobs.length,1);assert.equal(jobs[0].op,'click');assert.equal(jobs[0].args.selector,'#safe');
  assert.deepEqual((await ext('/extension/jobs','GET',undefined,token)).result.jobs,[],'click delivered no more than once');
  await ext('/extension/result','POST',{jobId:jobs[0].id,result:{ok:true,data:{clicked:true,element:{tag:'button'}}}},token);
  const done=await pending;
  assert.equal(done.status,200);assert.equal(done.body.result.clicked,true);
  await ext('/extension/grants','POST',{grants:[]},token);
  const revoked=await routeCompanionRequest('/v1/click',{browser:'chrome',targetId,selector:'#safe'},adapter);
  assert.equal(revoked.status,409);
 }finally{await broker.close()}
});

test('generic consented-tab API exposes the 45 operations implemented in the candidate, not arbitrary evaluation',async()=>{
 const targetId='ext:19:abcdef012345abcdef012345';
 const seen=[];
 const adapter={runAuthorizedAction:async request=>{
  seen.push(request);
  return {data:{operation:request.op}};
 }};
 assert.equal(EXTENSION_ACTIONS.read.length,17);
 assert.equal(EXTENSION_ACTIONS.interact.length,28);
 for(const op of [...EXTENSION_ACTIONS.read,...EXTENSION_ACTIONS.interact]){
  const r=await routeCompanionRequest('/v1/companion/action',{browser:'chrome',targetId,op,args:{}},adapter);
  assert.equal(r.status,200,op);
  assert.equal(r.body.result.operation,op);
 }
 assert.equal(seen.length,45);
 for(const op of ['evaluate','eval','execute_javascript','read_cookies','run_shell','native_mouse_without_permission']){
  const r=await routeCompanionRequest('/v1/companion/action',{browser:'chrome',targetId,op,args:{}},adapter);
  assert.equal(r.status,409,op);
 }
 const invalid=await routeCompanionRequest('/v1/companion/action',{browser:'chrome',targetId,op:'pointer_click',args:[]},adapter);
 assert.equal(invalid.status,400);
 const wrong=await routeCompanionRequest('/v1/companion/action',{browser:'opera',targetId,op:'read_text',args:{}},adapter);
 assert.equal(wrong.status,409);
});
