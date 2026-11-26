import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import crypto from 'node:crypto';

test('precise on-page pointer uses a genuine Chrome debugger input command only after separate tab approval',async()=>{
 const folder=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../extension');
 const code=fs.readFileSync(path.join(folder,'background.js'),'utf8');
 const messages={},storage={local:{},session:{}},debuggerCalls=[];
 const activeTab={id:42,title:'User approved',url:'https://example.org/allowed',active:true,windowId:1};
 let jobs=[],results=[],grants=[],switchOriginOnAttach=false;
 const chrome={
  runtime:{id:'self-test',onMessage:{addListener:cb=>messages.receive=cb}},
  storage:{
   local:{get:async k=>({[k]:storage.local[k]}),set:async o=>Object.assign(storage.local,o),remove:async k=>delete storage.local[k]},
   session:{get:async k=>({[k]:storage.session[k]}),set:async o=>Object.assign(storage.session,o),remove:async k=>delete storage.session[k]}
  },
  permissions:{contains:async({permissions})=>permissions.every(p=>p==='tabs'||p==='debugger'),
   onRemoved:{addListener:cb=>messages.permissionRemoved=cb}},
  tabs:{
   query:async q=>q?.active?[activeTab]:[activeTab],
   get:async id=>id===42?activeTab:Promise.reject(Error('not found')),
   onUpdated:{addListener:cb=>messages.updated=cb},
   onRemoved:{addListener:cb=>messages.removed=cb}
  },
  action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},
  scripting:{executeScript:async({func})=>{
   const name=String(func);
   if(func?.name==='luchDomExecutor')return [{result:{ok:true,data:{safe:true},url:activeTab.url}}];
   if(name.includes('innerWidth')&&name.includes('innerHeight'))return [{result:{width:900,height:650}}];
   return [{result:true}];
  }},
  debugger:{
   attach:async(source,protocol)=>{assert.equal(source.tabId,42);assert.equal(protocol,'1.3');debuggerCalls.push('attach');if(switchOriginOnAttach)activeTab.url='https://other.example/navigated'},
   sendCommand:async(source,method,args)=>{
    assert.equal(source.tabId,42);assert.equal(method,'Input.dispatchMouseEvent');
    debuggerCalls.push(args.type);
   },
   detach:async(source)=>{assert.equal(source.tabId,42);debuggerCalls.push('detach')}
  },
  alarms:{create:()=>{},onAlarm:{addListener:cb=>messages.alarm=cb}}
 };
 async function fetchMock(url,init){
  if(url.endsWith('/pair'))return {ok:true,json:async()=>({ok:true,token:'MOCK-SESSION-12345678901234567890'})};
  if(url.endsWith('/health'))return {ok:true,json:async()=>({ok:true,paired:true})};
  if(url.endsWith('/extension/grants')){grants=JSON.parse(init.body).grants;return {ok:true,json:async()=>({ok:true})}}
  if(url.endsWith('/extension/tab-overview'))return {ok:true,json:async()=>({ok:true})};
  if(url.endsWith('/extension/jobs')){const fresh=jobs.splice(0);return {ok:true,json:async()=>({ok:true,jobs:fresh})}};
  if(url.endsWith('/extension/result')){results.push(JSON.parse(init.body));return {ok:true,json:async()=>({ok:true})}};
  throw new Error('fetch route unexpected '+url);
 }
 const ctx=vm.createContext({chrome,fetch:fetchMock,AbortController,setTimeout,clearTimeout,Date,URL,crypto:crypto.webcrypto,console,setInterval(){}});
 ctx.self=ctx;
 ctx.importScripts=file=>vm.runInContext(fs.readFileSync(path.join(folder,file),'utf8'),ctx);
 vm.runInContext(code,ctx);
 const send=async(op,extra={})=>new Promise(resolve=>{const sent=messages.receive({op,...extra},{id:'self-test'},resolve);assert.equal(sent,true)});
 const login=await send('pair',{code:'12345678'});assert.equal(login.ok,true);
 const read=await send('grant-active');assert.equal(read.ok,true);
 const blocked=await send('precise-cursor',{enabled:true});assert.equal(blocked.ok,false);
 const interact=await send('allow-interaction');assert.equal(interact.ok,true);
 const enabled=await send('precise-cursor',{enabled:true});assert.equal(enabled.ok,true);
 assert.equal(grants[0].preciseCursor,true);
 jobs.push({id:'first',targetId:'ext:42:'+grants[0].grantId,op:'pointer_click',args:{x:65,y:90}});
 await new Promise(resolve=>{messages.alarm({name:'luch-poll'});setTimeout(resolve,65)});
 for(let i=0;i<15&&!results.length;i++)await new Promise(r=>setTimeout(r,20));
 assert.equal(results.length,1,JSON.stringify(results));
 assert.equal(results[0].result.ok,true,JSON.stringify(results[0]));
 assert.deepEqual(debuggerCalls,['attach','mouseMoved','mousePressed','mouseReleased','detach']);
 // Navigation between permission probe and debugger attach must never fire a click.
 switchOriginOnAttach=true;
 const eventsBefore=debuggerCalls.filter(x=>x==='mousePressed').length;
 jobs.push({id:'origin-race',targetId:'ext:42:'+grants[0].grantId,op:'pointer_click',args:{x:65,y:90}});
 messages.alarm({name:'luch-poll'});
 for(let i=0;i<15&&results.length<2;i++)await new Promise(r=>setTimeout(r,20));
 assert.equal(results.length,2);
 assert.equal(results[1].result.error,'TAB_ORIGIN_CHANGED');
 assert.equal(debuggerCalls.filter(x=>x==='mousePressed').length,eventsBefore,'no click after origin change');
 assert.equal(debuggerCalls.at(-1),'detach');
 activeTab.url='https://example.org/allowed';switchOriginOnAttach=false;
 const stop=await send('precise-cursor',{enabled:false});assert.equal(stop.ok,true);
 const before=debuggerCalls.length;
 jobs.push({id:'second',targetId:'ext:42:'+grants[0].grantId,op:'pointer_click',args:{x:65,y:90}});
 messages.alarm({name:'luch-poll'});
 for(let i=0;i<15&&results.length<3;i++)await new Promise(r=>setTimeout(r,20));
 assert.equal(results.length,3);
 assert.equal(results[2].result.error,'PRECISE_CURSOR_APPROVAL_REQUIRED');
 assert.equal(debuggerCalls.length,before);
});
