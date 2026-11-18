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
 assert.equal(man.name,'LUCH Browser Companion');assert.equal(man.version,'0.4.0');
 assert.equal(man.manifest_version,3);
 assert.ok(!JSON.stringify({manifest:man,html}).includes('QA'));
 assert.ok(html.includes('id="revoke"')&&html.includes('id="disconnect"'));
 assert.ok(popup.includes('luch_locale'));
});
test('minimized scoped permissions, fixed local broker, no remotely supplied scripts',()=>{
 assert.deepEqual([...man.permissions].sort(),['activeTab','alarms','scripting','storage'].sort());
 assert.deepEqual(man.host_permissions,['http://127.0.0.1:9248/*']);
 for(const flag of ['debugger','cookies','history','webRequest','nativeMessaging','<all_urls>'])assert.ok(!JSON.stringify(man).includes(flag));
 assert.ok(code.includes("job?.kind!=='read_text'"));
 assert.ok(code.includes("TAB_ORIGIN_CHANGED"));
 assert.ok(code.includes("const TTL_MS=15*60*1000"));
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
 const pages=new Map([[11,{id:11,url:'https://example.org/one',title:'One'}],[12,{id:12,url:'https://other.example/two',title:'Other'}]]);
 let active=11,failGrants=false,remoteGrants=[],token='TEST-TOKEN';
 const chrome={
  runtime:{id:'abc',onMessage:{addListener:cb=>{handlers.message=cb}}},
  storage:{
   local:{get:async key=>({[key]:store.local[key]}),set:async v=>Object.assign(store.local,v),remove:async k=>{delete store.local[k]}},
   session:{get:async key=>({[key]:store.session[key]}),set:async v=>Object.assign(store.session,v),remove:async k=>{delete store.session[k]}}
  },
  tabs:{
   query:async q=>q?.active?[pages.get(active)]:[...pages.values()],
   get:async id=>{if(!pages.has(id))throw Error('not found');return pages.get(id)},
   onUpdated:{addListener:cb=>handlers.updated=cb},
   onRemoved:{addListener:cb=>handlers.removed=cb}
  },
  action:{
   setBadgeText:async({tabId,text})=>badges.set(tabId,text),
   setBadgeBackgroundColor:async()=>{}
  },
  scripting:{executeScript:async ({target,func})=>[{result:target.tabId===active ? true : null}]},
  alarms:{create(){},onAlarm:{addListener:cb=>handlers.alarm=cb}}
 };
 async function fetchStub(url,init){
  if(url.endsWith('/pair'))return {ok:true,json:async()=>({ok:true,token})};
  if(url.endsWith('/extension/jobs'))return {ok:true,json:async()=>({ok:true,jobs:[]})};
  if(url.endsWith('/extension/grants')){
   if(failGrants)throw Error('BROKER_UNREACHABLE');
   remoteGrants=JSON.parse(init.body).grants;return{ok:true,json:async()=>({ok:true})};
  }
  if(url.endsWith('/extension/disconnect')){remoteGrants=[];return{ok:true,json:async()=>({ok:true})}}
  throw Error('unknown');
 }
 const context=vm.createContext({chrome,fetch:fetchStub,AbortController,setTimeout,clearTimeout,Date,URL,crypto:crypto.webcrypto,console,setInterval(){return 0}});
 vm.runInContext(code,context);
 async function send(op,extra={}){
  return await new Promise((resolve,reject)=>{
   const accepted=handlers.message({op,...extra},{id:'abc'},resolve);
   assert.equal(accepted,true);
   setTimeout(()=>reject(Error('message timeout')),500);
  });
 }
 const pair=await send('pair',{code:'12345678'});assert.equal(pair.ok,true);
 assert.equal((await send('status')).connected,true);assert.equal(remoteGrants.length,0);
 const first=await send('grant-active');assert.equal(first.ok,true);
 assert.equal(remoteGrants.length,1);assert.equal(remoteGrants[0].tabId,11);
 assert.equal(badges.get(11),'ON');
 assert.equal((await send('status')).granted,true);
 assert.ok(!(await send('status')).tab?.url?.includes('other.example'));
 const rev=await send('revoke-active');assert.equal(rev.ok,true);assert.equal(remoteGrants.length,0);assert.equal(badges.get(11),'');
 failGrants=true;
 const failed=await send('grant-active');assert.equal(failed.ok,false);
 assert.equal(Object.keys(store.session.grants).length,0,'unpublished grant must not remain after network failure');
 failGrants=false;
 const success=await send('grant-active');assert.equal(success.ok,true);
 pages.get(11).url='https://different.example/changed';
 await handlers.updated(11,{url:'https://different.example/changed'});
 assert.equal(remoteGrants.length,0,'origin navigation revokes');
 const disc=await send('disconnect');assert.equal(disc.ok,true);assert.equal((await send('status')).connected,false);
});
