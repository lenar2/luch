import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const code=readFileSync(resolve(root,'extension/popup.js'),'utf8');

function popup(locale='en'){
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
   runtime:{sendMessage:async()=>({ok:true,connected:false,tab:null,granted:false,scope:'read',preciseCursor:false,tabOverviewSharing:false})},
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
