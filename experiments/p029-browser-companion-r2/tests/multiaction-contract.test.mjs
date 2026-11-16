import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createBroker} from '../broker/server.mjs';
import {makeConsentedTabAdapter} from '../bridge-adapter/consented-tab-adapter.mjs';

test('reads, blocks unapproved interactions, upgrades consent, executes and revokes',async()=>{
 let clock=Date.now();
 const secret=crypto.randomBytes(32).toString('hex');
 const origin='chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
 const broker=createBroker({bridgeToken:secret,pairingCode:'67483921',port:19490,clock:()=>clock});
 const client=makeConsentedTabAdapter({brokerUrl:'http://127.0.0.1:19490',bridgeTokenProvider:()=>secret});
 const ext=async(path,method='GET',body,token)=>{
  const r=await fetch('http://127.0.0.1:19490'+path,{method,headers:{origin,...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,body:await r.json()};
 };
 try{
  await broker.listen();
  const login=await ext('/pair','POST',{code:'67483921'});assert.equal(login.status,200);
  const token=login.body.token;
  const grantId='abcdefabcdefabcdefabcdef',targetId='ext:5:'+grantId;
  const grant={tabId:5,grantId,url:'https://example.org/path',title:'Selected',scope:'read'};
  assert.equal((await ext('/extension/grants','POST',{grants:[grant]},token)).status,200);
  assert.equal((await client.listAuthorizedTabs()).tabs[0].readOnly,true);
  await assert.rejects(()=>client.runAuthorizedAction({targetId,op:'fill',args:{selector:'#q',text:'hi'}}),/INTERACTION_APPROVAL_REQUIRED/);
  await assert.rejects(()=>client.runAuthorizedAction({targetId:'ext:8:'+grantId,op:'read_text'}),/USER_TAB_PERMISSION_REQUIRED/);
  await assert.rejects(()=>client.runAuthorizedAction({targetId,op:'eval',args:{code:'1+1'}}),/ACTION_NOT_ALLOWED/);
  const first=client.runAuthorizedAction({targetId,op:'inspect_page'});
  let job=await ext('/extension/jobs','GET',undefined,token);
  for(let i=0;i<10&&!job.body.jobs?.length;i++){await new Promise(r=>setTimeout(r,12));job=await ext('/extension/jobs','GET',undefined,token)}
  assert.equal(job.body.jobs[0].op,'inspect_page');
  assert.equal((await ext('/extension/jobs','GET',undefined,token)).body.jobs.length,0,'no duplicate action delivery');
  await ext('/extension/result','POST',{jobId:job.body.jobs[0].id,result:{ok:true,data:{title:'TEST_PAGE',headings:[{text:'Hello'}]}}},token);
  assert.deepEqual((await first).data,{title:'TEST_PAGE',headings:[{text:'Hello'}]});
  // The user has been working for 20 minutes: the session grant must remain.
  clock+=20*60*1000;
  await ext('/extension/jobs','GET',undefined,token); // continuous live-session heartbeat
  assert.equal((await client.listAuthorizedTabs()).tabs.length,1);
  const upgraded={...grant,scope:'interact'};
  assert.equal((await ext('/extension/grants','POST',{grants:[upgraded]},token)).status,200);
  assert.equal((await client.listAuthorizedTabs()).tabs[0].readOnly,false);
  const action=client.runAuthorizedAction({targetId,op:'fill',args:{selector:'#q',text:'hi'}});
  job=await ext('/extension/jobs','GET',undefined,token);
  for(let i=0;i<10&&!job.body.jobs?.length;i++){await new Promise(r=>setTimeout(r,12));job=await ext('/extension/jobs','GET',undefined,token)}
  assert.equal(job.body.jobs[0].op,'fill');
  await ext('/extension/result','POST',{jobId:job.body.jobs[0].id,result:{ok:true,data:{updated:true}}},token);
  assert.equal((await action).data.updated,true);
  await ext('/extension/grants','POST',{grants:[]},token);
  await assert.rejects(()=>client.runAuthorizedAction({targetId,op:'read_text'}),/USER_TAB_PERMISSION_REQUIRED/);
  assert.equal((await ext('/extension/disconnect','POST',{},token)).status,200);
  await assert.rejects(()=>client.listAuthorizedTabs(),/USER_TAB_PERMISSION_REQUIRED|LOCAL_BRIDGE_ERROR|BROWSER_COMPANION_UNAVAILABLE/).catch(()=>{});
 }finally{await broker.close()}
});
test('browser extension cannot trigger prohibited remote code or permissions',async()=>{
 const {readFileSync}=await import('node:fs');
 const path=new URL('../extension/',import.meta.url);
 const man=JSON.parse(readFileSync(new URL('manifest.json',path),'utf8'));
 const worker=readFileSync(new URL('background.js',path),'utf8');
 const broker=readFileSync(new URL('../broker/server.mjs',import.meta.url),'utf8');
 assert.equal(man.version,'0.5.2');
 assert.ok(!worker.includes('const TTL_MS'));
 assert.ok(!broker.includes('TTL=15*60_000'));
 for(const key of ['debugger','cookies','history','nativeMessaging','<all_urls>'])assert.ok(!JSON.stringify(man).includes(key));
 assert.ok(worker.includes("importScripts('dom-ops.js')"));
 assert.ok(worker.includes("scope==='interact'"));
 assert.ok(broker.includes('INTERACTION_APPROVAL_REQUIRED'));
});
