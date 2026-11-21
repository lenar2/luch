import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import crypto from 'node:crypto';

const here=path.dirname(fileURLToPath(import.meta.url));
const ext=path.join(here,'../extension');
const code=fs.readFileSync(path.join(ext,'background.js'),'utf8');
const man=JSON.parse(fs.readFileSync(path.join(ext,'manifest.json'),'utf8'));
const html=fs.readFileSync(path.join(ext,'popup.html'),'utf8');
const popup=fs.readFileSync(path.join(ext,'popup.js'),'utf8');

test('public identity is LUCH Browser Companion without QA and uses MV3',()=>{
 assert.equal(man.name,'LUCH Browser Companion');assert.equal(man.version,'0.7.0');
 assert.equal(man.manifest_version,3);
 assert.ok(!JSON.stringify({manifest:man,html}).includes('QA'));
 assert.ok(html.includes('id="revoke"')&&html.includes('id="disconnect"')&&html.includes('id="interact"'));
 assert.ok(popup.includes('luch_locale'));
});
test('minimized scoped permissions, cloud relay only, no remotely supplied scripts',()=>{
 assert.deepEqual([...man.permissions].sort(),['activeTab','alarms','scripting','storage'].sort());
 assert.deepEqual(man.host_permissions,['https://api.lenarsalimov.ru/luch/browser/*']);
 for(const flag of ['cookies','history','webRequest','nativeMessaging','<all_urls>'])assert.ok(!JSON.stringify(man).includes(flag));
 assert.deepEqual([...man.optional_permissions].sort(),['tabs','debugger'].sort());
 assert.ok(!man.permissions.includes('debugger')&&man.optional_permissions.includes('debugger')&&!man.permissions.includes('tabs'));
 assert.ok(code.includes("const BASE='https://api.lenarsalimov.ru/luch/browser'"));
 assert.ok(code.includes('const READ_OPS'));assert.ok(code.includes('const INTERACT_OPS'));
 assert.ok(code.includes("TAB_ORIGIN_CHANGED"));
 assert.ok(!code.includes('TTL_MS'));assert.ok(!code.includes('expiresAt'));
});
test('icons are real PNG 16 / 32 / 48 / 128',()=>{
 for(const size of [16,32,48,128]){
  const image=fs.readFileSync(path.join(ext,'assets',`icon-${size}.png`));
  assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(image.readUInt32BE(16),size);assert.equal(image.readUInt32BE(20),size);
 }
});
test('grants through service worker, isolated tab, broker error rollback, revoke and disconnect',async()=>{
 const handlers={},store={local:{},session:{}},badges=new Map();
 const pages=new Map([[11,{id:11,windowId:1,url:'https://example.org/one',title:'One'}],[12,{id:12,windowId:2,url:'https://other.example/two',title:'Other'}]]);
 const selected=[];
 let active=11,failGrants=false,healthDown=false,cloudRevoked=false,disconnectDown=false,remoteGrants=[],token='TEST-TOKEN',healthReads=0,jobReads=0;
 const chrome={
  runtime:{id:'abc',onMessage:{addListener:cb=>{handlers.message=cb}}},
  storage:{
   local:{get:async key=>({[key]:store.local[key]}),set:async v=>Object.assign(store.local,v),remove:async k=>{delete store.local[k]}},
   session:{get:async key=>({[key]:store.session[key]}),set:async v=>Object.assign(store.session,v),remove:async k=>{delete store.session[k]}}
  },
  tabs:{
   query:async q=>q?.active?[pages.get(active)]:[...pages.values()],
   get:async id=>{if(!pages.has(id))throw Error('not found');return pages.get(id)},
   update:async(id,props)=>{selected.push({id,props});active=id;return pages.get(id)},
   onUpdated:{addListener:cb=>handlers.updated=cb},
   onRemoved:{addListener:cb=>handlers.removed=cb}
  },
  permissions:{contains:async({permissions})=>permissions.every(p=>p==='tabs'),onRemoved:{addListener:cb=>handlers.permRemoved=cb}},
  windows:{update:async(id,props)=>{selected.push({windowId:id,props})}},
  action:{
   setBadgeText:async({tabId,text})=>badges.set(tabId,text),
   setBadgeBackgroundColor:async()=>{}
  },
  scripting:{executeScript:async ({target,func})=>[{result:target.tabId===active ? true : null}]},
  alarms:{create(){},onAlarm:{addListener:cb=>handlers.alarm=cb}}
 };
 async function fetchStub(url,init){
  if(url.endsWith('/pair'))return {ok:true,json:async()=>({ok:true,token})};
  if(url.endsWith('/health')){healthReads++;assert.equal(init.headers.Authorization,'Bearer '+token);if(healthDown)throw Error('NetworkError');return {ok:true,json:async()=>({ok:true,paired:!cloudRevoked,authorizedTabs:remoteGrants.length})}}
  if(url.endsWith('/extension/tab-overview'))return{ok:true,json:async()=>({ok:true,shared:false})};
  if(url.endsWith('/extension/jobs')){jobReads++;return {ok:true,json:async()=>({ok:true,jobs:[]})}}
  if(url.endsWith('/extension/grants')){
   if(failGrants)throw Error('BROKER_UNREACHABLE');
   remoteGrants=JSON.parse(init.body).grants;return{ok:true,json:async()=>({ok:true})};
  }
  if(url.endsWith('/extension/disconnect')){if(disconnectDown)throw Error('NetworkError');remoteGrants=[];return{ok:true,json:async()=>({ok:true})}}
  throw Error('unknown');
 }
 const context=vm.createContext({chrome,fetch:fetchStub,AbortController,setTimeout,clearTimeout,Date,URL,crypto:crypto.webcrypto,console,setInterval(){return 0}});
 context.self=context;
 context.importScripts=file=>vm.runInContext(fs.readFileSync(path.join(ext,file),'utf8'),context);
 vm.runInContext(code,context);
 async function send(op,extra={}){
  return await new Promise((resolve,reject)=>{
   const accepted=handlers.message({op,...extra},{id:'abc'},resolve);
   assert.equal(accepted,true);
   setTimeout(()=>reject(Error('message timeout')),500);
  });
 }
 const pair=await send('pair',{code:'12345678'});assert.equal(pair.ok,true);
 const overview=await send('list-open-tabs');
 assert.equal(overview.ok,true);assert.equal(overview.tabs.length,2);
 assert.ok(overview.tabs[0].url.startsWith('https://example.org/one'));
 assert.equal((await send('share-tab-overview',{enabled:true})).sharing,true);
 assert.equal((await send('share-tab-overview',{enabled:false})).sharing,false);
 assert.equal((await send('activate-open-tab',{tabId:12})).activated,true);
 assert.equal(selected[0].id,12);
 assert.equal(selected[0].props.active,true);
 assert.equal(selected[1].windowId,2);
 assert.equal(Object.keys(store.session.grants||{}).length,0,'switching tabs must not grant page contents');
 assert.equal((await send('activate-open-tab',{tabId:999})).ok,false);
 active=11;
 const jobsBeforeStatus=jobReads;
 assert.equal((await send('status')).connected,true);assert.equal(remoteGrants.length,0);
 assert.equal(jobReads,jobsBeforeStatus,'status must not consume queued extension jobs');
 assert.equal(healthReads,1,'status must use the read-only authenticated health endpoint');
 const first=await send('grant-active');assert.equal(first.ok,true);
 assert.equal(remoteGrants.length,1);assert.equal(remoteGrants[0].tabId,11);
 assert.equal(badges.get(11),'ON');
 assert.equal((await send('status')).granted,true);
 assert.equal((await send('status')).scope,'read');
 const interactive=await send('allow-interaction');assert.equal(interactive.ok,true);
 assert.equal((await send('status')).scope,'interact');
 assert.equal(remoteGrants[0].scope,'interact');
 assert.ok(!(await send('status')).tab?.url?.includes('other.example'));
 // Transient cloud outages must not delete the pairing or stored tab grants.
 healthDown=true;
 const offline=await send('status');
 assert.equal(offline.connected,true);
 assert.equal(offline.online,false);
 assert.equal(Boolean(store.local.auth?.token),true);
 assert.equal(Object.keys(store.session.grants||{}).length,1);
 healthDown=false;
 assert.equal((await send('status')).online,true);
 const previousGrant=remoteGrants[0];
 const rev=await send('revoke-active');assert.equal(rev.ok,true);assert.equal(remoteGrants.length,0);assert.equal(badges.get(11),'');
 // A job claimed before the user clicked Revoke must not be allowed to use
 // the old poll snapshot after consent was removed.
 context.pendingRevokedJob={op:'read_text',targetId:'ext:'+previousGrant.tabId+':'+previousGrant.grantId,args:{selector:'body'}};
 const stale=await vm.runInContext('performJob(pendingRevokedJob)',context);
 assert.equal(stale.ok,false);assert.equal(stale.error,'USER_TAB_PERMISSION_REQUIRED');
 failGrants=true;
 const failed=await send('grant-active');assert.equal(failed.ok,false);
 assert.equal(Object.keys(store.session.grants).length,0,'unpublished grant must not remain after network failure');
 failGrants=false;
 const success=await send('grant-active');assert.equal(success.ok,true);
 // During a network outage, revocation is immediate on the extension side.
 // Reconnection then replaces the cloud grant set with the empty current one.
 failGrants=true;
 const pendingRevoke=await send('revoke-active');
 assert.equal(pendingRevoke.ok,true);assert.equal(pendingRevoke.pendingSync,true);
 assert.equal(Object.keys(store.session.grants||{}).length,0);
 failGrants=false;
 await vm.runInContext('poll()',context);
 assert.equal(remoteGrants.length,0,'cloud grant must be removed by next successful poll');
 const restored=await send('grant-active');assert.equal(restored.ok,true);
 pages.get(11).url='https://different.example/changed';
 await handlers.updated(11,{url:'https://different.example/changed'});
 assert.equal(remoteGrants.length,0,'origin navigation revokes');
 const disc=await send('disconnect');assert.equal(disc.ok,true);assert.equal(disc.cloudRevoked,true);assert.equal((await send('status')).connected,false);
 const pairedAgain=await send('pair',{code:'12345678'});assert.equal(pairedAgain.ok,true);
 cloudRevoked=true;
 const revokedStatus=await send('status');assert.equal(revokedStatus.connected,false);assert.equal(Boolean(store.local.auth),false,'explicit server revocation ends pairing');
 const pairedThird=await send('pair',{code:'12345678'});assert.equal(pairedThird.ok,true);
 cloudRevoked=false;disconnectDown=true;
 const localOnly=await send('disconnect');assert.equal(localOnly.ok,true);
 assert.equal(localOnly.cloudRevoked,false,'must not silently claim cloud token was revoked during outage');
 assert.equal(Boolean(store.local.auth),false);
});
