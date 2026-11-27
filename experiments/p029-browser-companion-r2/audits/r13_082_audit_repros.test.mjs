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
test('REPRO: pause race permits pin_tab to mutate browser after pause',async()=>{
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
 assert.equal(result.ok,true,'operation should NOT succeed here: audit demonstrates defect');
 assert.equal(env.tabs.get(id).pinned,true,'side effect after owner pause confirms race');
 console.log('AUDIT_REPRO_PAUSE_RACE',JSON.stringify({resultOk:result.ok,pinnedAfterPause:true,remainingGrants:0}));
});

test('REPRO: sensitive hidden and one-time form values are exported by get_form_values',async()=>{
 const puppeteer=require(process.env.LUCH_TEST_PUPPETEER_CORE||'puppeteer-core');
 const executablePath=process.env.LUCH_TEST_BROWSER_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-first-run'],timeout:20000});
 try{
  const page=await browser.newPage();
  const executor=fs.readFileSync(path.join(root,'extension/extended-dom-ops.js'),'utf8');
  await page.setContent('<!doctype html><html><body><form id="form"><input type="hidden" name="csrf" value="EXAMPLE_LOCAL_CSRF"><input type="text" name="otp" value="EXAMPLE_LOCAL_OTP"><input type="password" name="password" value="EXAMPLE_LOCAL_PASSWORD"></form></body></html>');
  await page.evaluate(executor);
  const values=await page.evaluate(()=>window.luchExtendedDomExecutor({op:'get_form_values',args:{selector:'#form'}}));
  assert.equal(values.ok,true);
  const names=values.data.map(x=>x.name);
  assert.ok(names.includes('csrf'),'hidden CSRF token is exported (defect)');
  assert.ok(names.includes('otp'),'OTP is exported (defect)');
  assert.ok(!names.includes('password'),'password input itself is excluded');
  console.log('AUDIT_REPRO_FORM_LEAK',JSON.stringify({hiddenTokenExported:true,otpExported:true,passwordExcluded:true}));
  // A selected DOM subtree can export source-markup password default values.
  const selected=await page.evaluate(()=>{
    const form=document.querySelector('#form'),sel=getSelection(),range=document.createRange();
    range.selectNode(form);sel.removeAllRanges();sel.addRange(range);
    return window.luchExtendedDomExecutor({op:'get_selected_html',args:{}});
  });
  assert.equal(selected.ok,true);
  assert.ok(selected.data.html.includes('EXAMPLE_LOCAL_PASSWORD'),'password value embedded in HTML attributes crosses filter');
  console.log('AUDIT_REPRO_SELECTED_HTML_LEAK',JSON.stringify({defaultPasswordAttributeExported:true}));
 }finally{await browser.close()}
});


test('REPRO: every 5s poll performs O(N) badge and tab reads for 125 tabs',async()=>{
 const env=createWorker(125);
 const enabled=await env.message('enable-full');assert.equal(enabled.ok,true);
 let badgeText=0,badgeBg=0,tabGet=0;
 const originalGet=env.chrome.tabs.get;
 env.chrome.action.setBadgeText=async()=>{badgeText++};
 env.chrome.action.setBadgeBackgroundColor=async()=>{badgeBg++};
 env.chrome.tabs.get=async id=>{tabGet++;return originalGet(id)};
 env.apiCalls.splice(0);
 await vm.runInContext('poll()',env.context);
 const brokerCalls=env.apiCalls.map(x=>x.suffix);
 assert.ok(badgeText>=125,'badge updates scale with count on every poll');
 assert.ok(badgeBg>=125,'background updates scale with count on every poll');
 assert.ok(tabGet>=125,'full pruning enumerates every tab each cycle');
 assert.ok(brokerCalls.filter(x=>x==='grants').length>=2,'duplicate full grant uploads per poll');
 assert.ok(brokerCalls.filter(x=>x==='tab-overview').length>=2,'duplicate tab metadata uploads per poll');
 console.log('AUDIT_REPRO_POLL_AMPLIFICATION',JSON.stringify({tabs:125,badgeText,badgeBg,tabGet,brokerCalls}));
});

test('REPRO: remembered fullMode silently reauthorizes tab grants after restart',async()=>{
 const env=createWorker(3);
 env.storage.local.fullMode=true;
 assert.equal(env.storage.session.grants,undefined);
 await vm.runInContext('poll()',env.context);
 const granted=Object.keys(env.storage.session.grants||{}).length;
 assert.equal(granted,3);
 console.log('AUDIT_REPRO_REAUTHORIZE_ON_RESTART',JSON.stringify({grantsAfterPoll:granted,explicitEnableClickInThisSession:false}));
});