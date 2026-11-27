import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const worker=fs.readFileSync(path.join(root,'extension/background.js'),'utf8');
const broker=fs.readFileSync(path.join(root,'broker/server.mjs'),'utf8');
const cloud=fs.readFileSync(path.join(root,'supabase/functions/p029-browser-companion/index.ts'),'utf8');

function createWorker(tabCount=125){
 const tabs=new Map(Array.from({length:tabCount},(_,i)=>[i+10,{
  id:i+10,url:'https://example.org/page/'+i,title:'Tab '+i,
  windowId:1,status:'complete',active:i===0,index:i
 }]));
 const handlers={},storage={local:{auth:{token:'TEST_TOKEN'}},session:{}},sends=[],apiCalls=[];
 const persistence=(scope)=>({
  async get(key){return {[key]:storage[scope][key]}},
  async set(data){Object.assign(storage[scope],data)},
  async remove(key){for(const k of (Array.isArray(key)?key:[key]))delete storage[scope][k]}
 });
 const chrome={
  runtime:{id:'local-extension',getManifest:()=>({version:'0.8.2'}),onMessage:{addListener:cb=>handlers.msg=cb}},
  storage:{local:persistence('local'),session:persistence('session')},
  permissions:{contains:async()=>true,onRemoved:{addListener:cb=>handlers.permissions=cb}},
  tabs:{
   query:async query=>query?.active?[tabs.get(10)]:[...tabs.values()],
   get:async id=>tabs.get(id),
   onUpdated:{addListener:cb=>handlers.updated=cb},
   onCreated:{addListener:cb=>handlers.created=cb},
   onRemoved:{addListener:cb=>handlers.removed=cb}
  },
  action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},
  alarms:{create(){},onAlarm:{addListener:cb=>handlers.alarm=cb}},
  debugger:{
   attach:async()=>{},detach:async()=>{},
   sendCommand:async(_target,command,args)=>sends.push({command,args})
  }
 };
 const fetch=async(url,{body}={})=>{
  const suffix=new URL(url).pathname.split('/').pop();
  apiCalls.push({suffix,data:body?JSON.parse(body):{}});
  return {ok:true,json:async()=>suffix==='health'?{ok:true,paired:true}:{ok:true,jobs:[]}};
 };
 const context=vm.createContext({chrome,fetch,AbortController,URL,Date,
  crypto:crypto.webcrypto,setTimeout,clearTimeout,setInterval:()=>0,console});
 context.self=context;
 context.importScripts=()=>{};
 vm.runInContext(worker,context);
 const message=(op,rest={})=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Timed out: '+op)),4000);
  handlers.msg({op,...rest},{id:chrome.runtime.id},result=>{clearTimeout(timer);resolve(result)});
 });
 return {tabs,handlers,storage,apiCalls,sends,context,message,chrome};
}

// Security audit REPRODUCTIONS: passing means a defect has been demonstrated.
// They are NOT success criteria for production.
test('REGRESSION: pause blocks pin_tab after revocation',async()=>{
 const env=createWorker(1);
 const enabled=await env.message('enable-full');
 assert.equal(enabled.ok,true);
 const id=10,grant=env.storage.session.grants[id];
 let unblock,entered;
 const gate=new Promise(resolve=>unblock=resolve);
 const seen=new Promise(resolve=>entered=resolve);
 env.chrome.tabs.get=async x=>{
   entered();
   await gate;
   return env.tabs.get(x);
 };
 env.chrome.tabs.update=async(x,update)=>{
   const tab=env.tabs.get(x);
   Object.assign(tab,update);
   return tab;
 };
 env.context.task={targetId:'ext:'+id+':'+grant.grantId,op:'pin_tab',args:{}};
 const job=vm.runInContext('performJob(task)',env.context);
 await seen;
 const paused=await env.message('disable-full');
 assert.equal(paused.ok,true);
 assert.equal(Object.keys(env.storage.session.grants).length,0);
 unblock();
 const result=await job;
 assert.equal(result.ok,false,'revoked job must fail');
 assert.match(result.error,/USER_TAB_PERMISSION_REVOKED/);
 assert.equal(env.tabs.get(id).pinned,undefined,'no side effect after revocation');
 console.log('R14_REVOCATION_RACE_BLOCKED',JSON.stringify({resultOk:result.ok,pinnedAfterPause:false,remainingGrants:0}));
});


test('R14.3 permission gate: optional debugger is not mandatory for ordinary control',async()=>{
 const e=createWorker(2);
 e.chrome.permissions.contains=async req=>!req.permissions?.includes('debugger');
 const enabled=await e.message('enable-full');
 assert.equal(enabled.ok,true,JSON.stringify(enabled));
 const grants=e.storage.session.grants;
 assert.equal(grants[10].preciseCursor,false);
 assert.equal(grants[11].preciseCursor,false);
 e.context.task={targetId:'ext:10:'+grants[10].grantId,op:'pointer_move',args:{x:12,y:12}};
 const refused=await vm.runInContext('performJob(task)',e.context);
 assert.equal(refused.ok,false);
 assert.match(refused.error,/PRECISE_CURSOR_APPROVAL_REQUIRED/);
 // Permission alone does not elevate other tabs.
 e.chrome.permissions.contains=async()=>true;
 const approved=await e.message('precise-cursor',{enabled:true});
 assert.equal(approved.ok,true,JSON.stringify(approved));
 assert.equal(e.storage.session.grants[10].preciseCursor,true);
 assert.equal(e.storage.session.grants[11].preciseCursor,false);
 // Event-driven synchronization preserves that exact-tab opt-in.
 e.tabs.get(11).title='Changed';
 await e.handlers.updated(11,{title:'Changed'});
 await new Promise(r=>setTimeout(r,290));
 assert.equal(e.storage.session.grants[11].preciseCursor,false);
 e.tabs.get(10).title='Changed active';
 await e.handlers.updated(10,{title:'Changed active'});
 await new Promise(r=>setTimeout(r,290));
 assert.equal(e.storage.session.grants[10].preciseCursor,true);
 // Cross-origin navigation discards the previous tab's cursor grant.
 e.tabs.get(10).url='https://other.example.net/';
 await e.handlers.updated(10,{url:'https://other.example.net/'});
 await new Promise(r=>setTimeout(r,290));
 assert.equal(e.storage.session.grants[10].preciseCursor,false);
});

test('R14.3 denied mandatory downloads permission does not persist full mode',async()=>{
 const e=createWorker(1);
 e.chrome.permissions.contains=async req=>!req.permissions?.includes('downloads');
 const result=await e.message('enable-full');
 assert.equal(result.ok,false);
 assert.match(result.error,/BROWSER_CAPABILITIES_PERMISSION_REQUIRED/);
 assert.equal(e.storage.local.fullMode,undefined);
});

for(const operation of ['navigate','close_tab','download_url']){
 test('R14.3 revoke during tab lookup prevents '+operation,async()=>{
  const e=createWorker(1);
  assert.equal((await e.message('enable-full')).ok,true);
  const grant=e.storage.session.grants[10];
  let release,entered;
  const gate=new Promise(r=>release=r), seen=new Promise(r=>entered=r);
  e.chrome.tabs.get=async id=>{entered();await gate;return e.tabs.get(id)};
  let writes=0;
  e.chrome.tabs.update=async()=>{writes++;throw new Error('UNEXPECTED_UPDATE')};
  e.chrome.tabs.remove=async()=>{writes++;throw new Error('UNEXPECTED_REMOVE')};
  e.chrome.downloads={download:async()=>{writes++;throw new Error('UNEXPECTED_DOWNLOAD')}};
  e.context.task={targetId:'ext:10:'+grant.grantId,op:operation,
    args:{url:'https://example.org/next'}};
  const pending=vm.runInContext('performJob(task)',e.context);
  await seen;
  const paused=await e.message('disable-full');
  assert.equal(paused.ok,true);
  release();
  const result=await pending;
  assert.equal(result.ok,false,JSON.stringify(result));
  assert.match(result.error,/USER_TAB_PERMISSION_REVOKED/);
  assert.equal(writes,0,'no mutable side effect after revocation');
 });
}


test('R14.3 extended form submission blocks cross-origin race before requestSubmit',()=>{
 const source=fs.readFileSync(path.join(root,'extension/extended-dom-ops.js'),'utf8');
 let submitted=false;
 const el={tagName:'FORM',name:'safe',id:'f',getAttribute:()=>null,matches:()=>false,closest:()=>null,requestSubmit:()=>{submitted=true}};
 const context=vm.createContext({
  location:{href:'https://changed.example.net/',origin:'https://changed.example.net'},
  document:{querySelector:()=>el},
  console
 });
 context.self=context;vm.runInContext(source,context);
 const result=context.luchExtendedDomExecutor({op:'submit_form',args:{selector:'#f'},expectedOrigin:'https://original.example.org'});
 assert.equal(result.ok,false);
 assert.equal(result.error,'TAB_ORIGIN_CHANGED_BEFORE_ACTION');
 assert.equal(submitted,false);
});
