import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>readFileSync(resolve(root,f),'utf8');

test('Original LUCH green logo and feature count are in the initial browser popup',()=>{
 const html=read('extension/popup.html');
 const css=read('extension/popup.css');
 assert.match(html,/<html lang="en">/);
 assert.match(html,/src="assets\/luch-brand-r22.svg"/);
 assert.match(html,/id="brand-name">LUCH<\/strong>/);
 assert.match(html,/id="feature-count">100<\/strong>/);
 for(const id of ['cap-read','cap-navigate','cap-interact','cap-capture'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(css,/--ink:#143c43/);
 assert.match(css,/--canvas:#f4f8f6/);
 assert.doesNotMatch(html,/connection-journey|hero-illustration/);
 assert.doesNotMatch(html,/class="capability-grid"/);
});

function render(savedLocale,navigatorLanguage='ru-RU'){
 const elements=new Map();
 function item(id){
  if(!elements.has(id))elements.set(id,{textContent:'',value:'',hidden:false,disabled:false,listeners:{},
   classList:{toggle(){},remove(){}},setAttribute(){},addEventListener(key,fn){this.listeners[key]=fn},
   replaceChildren(){},appendChild(){}});
  return elements.get(id);
 }
 const document={documentElement:{lang:'en'},body:{classList:{toggle(){},remove(){}}},getElementById:item,createElement:()=>item('created')};
 const localStorage={getItem:()=>savedLocale,setItem(key,value){savedLocale=value}};
 const chrome={runtime:{sendMessage:async()=>({ok:true,connected:false,online:false,fullMode:false,tab:null})}};
 runInNewContext(read('extension/popup.js'),{document,localStorage,chrome,navigator:{language:navigatorLanguage},setInterval(){}});
 return {item,document,localStorage};
}
test('English is the default even on Russian OS; brand remains LUCH in both languages',()=>{
 const {item,document}=render(null);
 assert.equal(document.documentElement.lang,'en');
 assert.equal(item('brand-name').textContent,'LUCH');
 assert.equal(item('brand-subtitle').textContent,'BROWSER COMPANION');
 assert.equal(item('feature-caption').textContent,'BROWSER OPERATIONS');
 assert.equal(item('cap-read').textContent,'Read & analyze pages');
 item('locale').listeners.change({target:{value:'ru'}});
 assert.equal(document.documentElement.lang,'ru');
 assert.equal(item('brand-name').textContent,'LUCH');
 assert.equal(item('brand-subtitle').textContent,'БРАУЗЕР-КОМПАНЬОН');
 assert.equal(item('feature-caption').textContent,'ОПЕРАЦИЙ В БРАУЗЕРЕ');
 assert.equal(item('cap-read').textContent,'Чтение и анализ страниц');
 item('locale').listeners.change({target:{value:'en'}});
 assert.equal(document.documentElement.lang,'en');
 assert.equal(item('cap-read').textContent,'Read & analyze pages');
});
test('Previously selected Russian remains selected after extension update',()=>{
 const {item,document}=render('ru');
 assert.equal(document.documentElement.lang,'ru');
 assert.equal(item('brand-name').textContent,'LUCH');
});
