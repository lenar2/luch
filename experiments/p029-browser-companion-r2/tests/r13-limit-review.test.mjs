import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

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
 return {tabs,handlers,storage,apiCalls,sends,context,message};
}

test('full browser mode publishes all 125 tabs without the former silent 80-tab cutoff',async()=>{
 const testEnv=createWorker(125);
 const enabled=await testEnv.message('enable-full');
 assert.equal(enabled.ok,true,JSON.stringify(enabled));
 const grants=testEnv.storage.session.grants;
 assert.equal(Object.keys(grants).length,125);
 assert.ok(Object.values(grants).every(x=>x.scope==='interact'&&x.preciseCursor===true));
 const published=testEnv.apiCalls.filter(x=>x.suffix==='grants').at(-1).data.grants;
 assert.equal(published.length,125);
 const overview=testEnv.apiCalls.filter(x=>x.suffix==='tab-overview').at(-1).data.tabs;
 assert.equal(overview.length,125);
 const status=await testEnv.message('status');
 assert.equal(status.fullMode,true);
 const paused=await testEnv.message('disable-full');
 assert.equal(paused.ok,true);
 assert.equal(Object.keys(testEnv.storage.session.grants).length,0);
 assert.equal((await testEnv.message('status')).fullMode,false);
});

test('out-of-capacity browser is explicitly rejected rather than silently truncating',async()=>{
 const env=createWorker(501);
 const result=await env.message('enable-full');
 assert.equal(result.ok,false);
 assert.match(result.error,/BROWSER_TAB_CAPACITY_EXCEEDED/);
 assert.equal(env.storage.local.fullMode,undefined);
 assert.ok(!env.apiCalls.some(x=>x.suffix==='grants'&&x.data.grants?.length===500));
});

test('keyboard accepts F24 and punctuation with CDP key events on approved browser tab',async()=>{
 const env=createWorker(1);
 const enabled=await env.message('enable-full');
 assert.equal(enabled.ok,true);
 const grant=env.storage.session.grants[10];
 for(const [key,virtual] of [['F24',135],[';',186],['Insert',45]]){
  env.context.task={targetId:`ext:10:${grant.grantId}`,op:'key_chord',args:{key,modifiers:2}};
  const result=await vm.runInContext('performJob(task)',env.context);
  assert.equal(result.ok,true,key+' '+JSON.stringify(result));
  const events=env.sends.splice(0);
  assert.deepEqual(events.map(x=>x.command),['Input.dispatchKeyEvent','Input.dispatchKeyEvent']);
  assert.ok(events.every(x=>x.args.windowsVirtualKeyCode===virtual&&x.args.modifiers===2));
 }
});

test('transport bounds are consistent, justified, and do not silently omit tabs',()=>{
 assert.match(worker,/const MAX_TRANSPORT_TABS=500;/);
 assert.doesNotMatch(worker,/\.slice\(0,80\)/);
 assert.match(broker,/MAX_GRANTS=500, MAX_OVERVIEW_TABS=500/);
 assert.match(cloud,/grants\.length>500/);
 assert.match(cloud,/body\.tabs\.length>500/);
 assert.match(cloud,/\.limit\(500\)/);
 assert.match(worker,/timeout=Math\.min\(Math\.max\(Number\(args\.timeoutMs\)\|\|5000,50\),40000\)/);
 assert.match(cloud,/timeoutMs: z\.number\(\)\.int\(\)\.min\(50\)\.max\(40000\)/);
 assert.match(broker,/waitMs=\(op==='wait_for_url'\|\|op==='wait_for_load'\)\?48000:11000/);
});