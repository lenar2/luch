import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../extension/dom-ops.js',import.meta.url),'utf8');
function app(){
 const document={
  title:'Test Article',body:{innerText:'A useful example article',textContent:'A useful example article'},
  querySelector(s){return selectors[s]||null},
  querySelectorAll(s){if(s==='h1,h2,h3,h4,h5,h6')return [heading];if(s==='a[href]')return [link];if(s==='table')return [];if(s==='form')return [];if(s==='h1,h2,h3,h4,h5,h6,a,button,input,textarea,select,[role]')return [heading,link,input,password];if(s==='#q')return [input];return []},
  elementFromPoint(){return link}
 };
 const base={innerText:'',textContent:'',id:'',getAttribute:()=>null,closest:()=>null,dispatchEvent:()=>true};
 const heading={...base,tagName:'H1',innerText:'Hello LUCH'};
 const link={...base,tagName:'A',innerText:'Explore',href:'https://example.org/news',click:()=>{link.clicked=(link.clicked||0)+1}};
 const input={...base,tagName:'INPUT',type:'text',getAttribute:s=>s==='type'?'text':null,value:'',focus:()=>{input.focused=true},dispatchEvent:()=>true};
 const password={...base,tagName:'INPUT',type:'password',value:'hidden',closest:s=>s.includes('password')?password:null};
 const danger={...base,tagName:'BUTTON',innerText:'Delete account',value:'',click:()=>{danger.clicked=true}};
 const submit={...base,tagName:'BUTTON',innerText:'Go',closest:s=>s==='form'?{tagName:'FORM'}:null,click:()=>{submit.clicked=true}};
 const transfer={...base,tagName:'BUTTON',innerText:'Transfer funds',click:()=>{transfer.clicked=true}};
 const russianPayment={...base,tagName:'BUTTON',innerText:'Оплатить счёт',click:()=>{russianPayment.clicked=true}};
 const selectors={'#q':input,'#password':password,'#danger':danger,'#submit':submit,'#link':link,'#transfer':transfer,'#ru-pay':russianPayment};
 const ctx=vm.createContext({document,window:{scrollX:0,scrollY:0,scrollBy(){},scrollTo(){},getSelection(){return{toString:()=>''}}},location:{href:'https://example.org/news'},Event:class{constructor(type){this.type=type}},MouseEvent:class{constructor(type){this.type=type}},InputEvent:class{},HTMLTextAreaElement:class{},HTMLInputElement:class{}});
 ctx.self=ctx;vm.runInContext(source,ctx);
 return {run:(op,args)=>ctx.luchDomExecutor({op,args}),input,link,danger,submit,transfer,russianPayment};
}
test('DOM operations inspect visible content and bounded forms without password values',()=>{
 const {run}=app();
 assert.equal(run('read_text').data.text,'A useful example article');
 assert.equal(run('get_headings').data[0].text,'Hello LUCH');
 assert.equal(run('get_links').data[0].href,'https://example.org/news');
 assert.equal(run('find_text',{text:'USEFUL'}).data.count,1);
 assert.equal(run('query_elements',{selector:'#q'}).data[0].type,'text');
 assert.ok(!JSON.stringify(run('accessibility_snapshot')).includes('hidden'));
});
test('interactive operations update user-approved input and block sensitive changes',()=>{
 const {run,input,link,danger,submit,transfer,russianPayment}=app();
 assert.equal(run('fill',{selector:'#q',text:'value'}).ok,true);
 assert.equal(input.value,'value');
 assert.equal(run('click',{selector:'#link'}).ok,true);assert.equal(link.clicked,1);
 assert.equal(run('fill',{selector:'#password',text:'bad'}).error,'SENSITIVE_ELEMENT_DENIED');
 assert.equal(run('click',{selector:'#danger'}).error,'HIGH_IMPACT_CLICK_NEEDS_USER');
 assert.equal(run('click',{selector:'#submit'}).error,'FORM_SUBMISSION_NEEDS_USER');
 assert.equal(run('click',{selector:'#transfer'}).error,'HIGH_IMPACT_CLICK_NEEDS_USER');
 assert.equal(run('click',{selector:'#ru-pay'}).error,'HIGH_IMPACT_CLICK_NEEDS_USER');
 assert.equal(danger.clicked,undefined);
 assert.equal(submit.clicked,undefined);assert.equal(transfer.clicked,undefined);assert.equal(russianPayment.clicked,undefined);
 assert.equal(run('eval',{code:'alert(1)'}).error,'OPERATION_NOT_SUPPORTED_IN_EXTENSION');
});
