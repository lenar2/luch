import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const code=readFileSync(resolve(root,'extension/popup.js'),'utf8');

function popup(locale='en',state={}){
 const elements=new Map();
 const item=(id)=>{
  if(!elements.has(id))elements.set(id,{
   id, textContent:'', value:'', href:'', placeholder:'', hidden:false, disabled:false,
   listeners:{},classList:{toggle(){},remove(){}},
   setAttribute(){}, addEventListener(type,fn){this.listeners[type]=fn},
   replaceChildren(){},appendChild(){},append(){},click(){this.listeners.click?.()},
  });
  return elements.get(id);
 };
 const context={
  document:{documentElement:{lang:''},body:{classList:{toggle(){},remove(){}}},getElementById:item,createElement(tag){return item('created:'+tag+':'+elements.size)}},
  navigator:{language:locale},
  localStorage:{getItem(){return null},setItem(){}},
  chrome:{
   runtime:{sendMessage:async()=>({ok:true,connected:false,online:false,tab:null,granted:false,scope:'read',preciseCursor:false,tabOverviewSharing:false,...state})},
   permissions:{request:async()=>false}
  },
  setInterval(){return 1},console,
 };
 runInNewContext(code,context,{filename:'popup.js'});
 return {item,context};
}

test('popup executes first render without undefined locale and uses existing-chat setup guide',()=>{
 const {item}=popup('en');
 assert.equal(item('local-setup').href,
  'https://github.com/lenar2/luch/blob/main/docs/CHATGPT_CONNECT.md');
 assert.match(item('setup-steps').textContent||'',/^$/);
 assert.match(item('setup-boundary').textContent,/existing AI chat/);
});

test('Russian locale uses correct URL and real ten-minute code instructions',()=>{
 const {item}=popup('ru-RU');
 assert.equal(item('local-setup').href,
  'https://github.com/lenar2/luch/blob/main/docs/CHATGPT_CONNECT.ru.md');
 assert.match(item('setup-boundary').textContent,/привычном чате/);
});

test('connected/read-granted HEA view prioritizes approved tab and hides advanced tools',async()=>{
 const {item}=popup('en',{connected:true,online:true,granted:true,scope:'read',
  tab:{title:'Example Domain',url:'https://example.com/'}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(item('status').textContent,'Browser paired');
 assert.equal(item('currentTab').textContent,'Example Domain');
 assert.equal(item('headline').textContent,'Your tab. Your choice.');
 assert.equal(item('pairing').hidden,true);
 assert.equal(item('controls').hidden,false);
 assert.equal(item('grant').hidden,true);
 assert.equal(item('interact').hidden,false);
 const html=readFileSync(resolve(root,'extension/popup.html'),'utf8');
 assert.match(html,/<details id="advanced"/);
 assert.ok(html.indexOf('id="feedback"')<html.indexOf('id="controls"'),'errors must be visible before advanced content');
});

test('temporary cloud outage never implies user has unpaired or that remote actions work',async()=>{
 const {item}=popup('ru-RU',{connected:true,online:false,granted:true,scope:'read',
  tab:{title:'Тестовая страница',url:'https://example.com/'}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(item('status').textContent,'Ожидание подключения к облаку');
 assert.equal(item('pairing').hidden,true);
 assert.equal(item('controls').hidden,false);
 assert.equal(item('interact').disabled,true);
 assert.equal(item('list-tabs').disabled,true);
 assert.equal(item('revoke').hidden,false,'local revoke must remain available');
 assert.equal(item('disconnect').disabled,false,'local disconnect must remain available');
});

test('debugger is NOT requested during onboarding, only after optional pointer click',async()=>{
 const {item,context}=popup('ru-RU',{connected:true,online:true,granted:true,scope:'interact',
  tab:{title:'Example Domain',url:'https://example.com/'}});
 await new Promise(resolve=>setImmediate(resolve));
 let requested=0;
 context.chrome.permissions.request=async({permissions})=>{
  assert.deepEqual(Array.from(permissions),['debugger']);
  requested++;
  return false;
 };
 assert.equal(requested,0,'no debugger prompt during initial popup render');
 assert.equal(typeof item('enable-cursor').listeners.click,'function');
 await item('enable-cursor').listeners.click();
 assert.equal(requested,1,'one user-click-driven permission request');
 assert.match(item('feedback').textContent,/Разрешение Opera не предоставлено/);
});
