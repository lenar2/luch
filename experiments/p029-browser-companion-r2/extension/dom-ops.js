'use strict';
// Deliberately self-contained: Chrome serializes this function into the ONE
// user-approved tab; no remote code or string evaluation is executed.
function luchDomExecutor({op,args={}}){
 const MAX_TEXT=65536, MAX_ITEMS=80;
 const clean=s=>String(s??'').slice(0,400);
 const snippet=s=>String(s??'').replace(/\s+/g,' ').trim().slice(0,280);
 const url=()=>location.href;
 const describe=el=>el?({tag:el.tagName?.toLowerCase()||'',role:clean(el.getAttribute?.('role')||''),
  text:snippet(el.innerText||el.textContent||''),id:clean(el.id||''),name:clean(el.getAttribute?.('name')||''),
  label:clean(el.getAttribute?.('aria-label')||''),href:clean(el.href||''),
  type:clean(el.getAttribute?.('type')||'')}):null;
 const safe=(s,limit=300)=>String(s??'').slice(0,limit);
 const selector=String(args.selector??'').slice(0,500);
 const target=()=>{
  if(!selector)throw new Error('SELECTOR_REQUIRED');
  try{return document.querySelector(selector)}catch{throw new Error('INVALID_SELECTOR')}
 };
 const allowedElement=el=>{
  if(!el)throw new Error('ELEMENT_NOT_FOUND');
  if(el.closest?.('input[type="password"],input[type="file"],[data-luch-no-ai],[autocomplete="current-password"],[autocomplete="new-password"]'))throw new Error('SENSITIVE_ELEMENT_DENIED');
  return el;
 };
 const actionGuard=el=>{
  allowedElement(el);
  // Inspect the actionable ancestor too: a cursor may hit a <span> inside a
  // payment/submit button, not the button node itself.
  const action=el.closest?.('button,a,input,select,[role="button"],[role="link"]')||el;
  allowedElement(action);
  const label=[action.innerText,action.textContent,action.value,action.getAttribute?.('aria-label'),
   el.innerText,el.textContent].filter(Boolean).join(' ').slice(0,220);
  // No hidden text/label veto: the authenticated command and tab grant are authority.
  return el;
 };
 const result=(data)=>({ok:true,source:'USER_CONSENTED_TAB',url:url(),data});
 const scrollReturn=()=>({scrollX:Math.round(window.scrollX),scrollY:Math.round(window.scrollY)});
 try{
 if(op==='read_text'){
   const el=selector?target():document.body;allowedElement(el);
   return result({text:String(el?.innerText||'').slice(0,MAX_TEXT),title:safe(document.title,180)});
 }
 if(op==='inspect_page'){
   const headings=Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).slice(0,MAX_ITEMS).map(e=>({level:e.tagName.toLowerCase(),text:snippet(e.innerText)}));
   const links=Array.from(document.querySelectorAll('a[href]')).slice(0,MAX_ITEMS).map(e=>({text:snippet(e.innerText),href:safe(e.href,1024)}));
   const forms=Array.from(document.querySelectorAll('form')).slice(0,20).map(e=>({id:safe(e.id),action:safe(e.action,1024),fields:Array.from(e.querySelectorAll('input,textarea,select')).slice(0,35).map(f=>({tag:f.tagName.toLowerCase(),type:safe(f.type),name:safe(f.name),required:!!f.required})).filter(f=>f.type!=='password')}));
   const tables=Array.from(document.querySelectorAll('table')).slice(0,20).map(e=>({rows:Math.min(e.rows?.length||0,9999),text:snippet(e.innerText).slice(0,400)}));
   return result({title:safe(document.title,180),description:safe(document.querySelector('meta[name="description"]')?.content,400),headings,links,forms,tables,selection:safe(window.getSelection?.()?.toString(),2000)});
 }
 if(op==='get_links')return result(Array.from(document.querySelectorAll('a[href]')).slice(0,MAX_ITEMS).map(e=>({text:snippet(e.innerText),href:safe(e.href,1024)})));
 if(op==='get_headings')return result(Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).slice(0,MAX_ITEMS).map(e=>({level:e.tagName.toLowerCase(),text:snippet(e.innerText)})));
 if(op==='get_forms')return result(Array.from(document.querySelectorAll('form')).slice(0,30).map(e=>({id:safe(e.id),action:safe(e.action,1024),fields:Array.from(e.querySelectorAll('input,textarea,select')).slice(0,35).filter(f=>f.type!=='password').map(f=>({tag:f.tagName.toLowerCase(),type:safe(f.type),name:safe(f.name),required:!!f.required}))})));
 if(op==='get_tables')return result(Array.from(document.querySelectorAll('table')).slice(0,MAX_ITEMS).map(e=>({rows:e.rows?.length||0,text:snippet(e.innerText).slice(0,500)})));
 if(op==='get_selection')return result(safe(window.getSelection?.()?.toString(),MAX_TEXT));
 if(op==='query_elements'){
   if(!selector)throw new Error('SELECTOR_REQUIRED');
   let found;try{found=document.querySelectorAll(selector)}catch{throw new Error('INVALID_SELECTOR')}
   return result(Array.from(found).slice(0,MAX_ITEMS).map(describe).filter(Boolean));
 }
 if(op==='find_text'){
  const needle=safe(args.text,500).trim();if(!needle)throw new Error('TEXT_REQUIRED');
  const body=String(document.body?.innerText||'').slice(0,MAX_TEXT);
  const lower=body.toLocaleLowerCase(),term=needle.toLocaleLowerCase();let at=0;const matches=[];
  while(matches.length<20&&(at=lower.indexOf(term,at))!==-1){matches.push({offset:at,context:body.slice(Math.max(0,at-75),at+term.length+75)});at+=term.length}
  return result({count:matches.length,matches});
 }
 if(op==='accessibility_snapshot'){
  return result(Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,a,button,input,textarea,select,[role]')).slice(0,200).filter(e=>e.type!=='password').map(describe).filter(Boolean));
 }
 if(op==='verify_pointer_target'){
  const x=Number(args.x),y=Number(args.y);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=window.innerWidth||y>=window.innerHeight)throw new Error('POINTER_OUTSIDE_VIEWPORT');
  const el=document.elementFromPoint(x,y);
  actionGuard(el);
  return result({safe:true,element:describe(el)});
 }
 if(op==='hit_test'){
  const x=Number(args.x),y=Number(args.y);if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('COORDINATES_REQUIRED');
  return result(describe(document.elementFromPoint(x,y)));
 }
 if(op==='get_element')return result(describe(allowedElement(target())));
 if(op==='scroll_position')return result(scrollReturn());
 if(op==='focus'){const el=allowedElement(target());el.focus();return result(describe(el))}
 if(op==='hover'){const el=allowedElement(target());el.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,cancelable:true,view:window}));return result(describe(el))}
 if(op==='scroll_into_view'){const el=allowedElement(target());el.scrollIntoView({block:'center',behavior:'instant'});return result(describe(el))}
 if(op==='scroll'){
  const dx=Number(args.dx||0),dy=Number(args.dy||0);
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.abs(dx)>5000||Math.abs(dy)>5000)throw new Error('SCROLL_OUT_OF_RANGE');
  window.scrollBy({left:dx,top:dy,behavior:'instant'});return result(scrollReturn());
 }
 if(op==='scroll_to'){
  const x=Number(args.x||0),y=Number(args.y||0);
  if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1000000||Math.abs(y)>1000000)throw new Error('SCROLL_OUT_OF_RANGE');
  window.scrollTo({left:x,top:y,behavior:'instant'});return result(scrollReturn());
 }
 if(op==='fill'||op==='insert_text'||op==='type_text'){
  const el=allowedElement(target());const type=(el.type||'').toLowerCase();
  if(!['INPUT','TEXTAREA'].includes(el.tagName)&&!el.isContentEditable)throw new Error('TEXT_FIELD_REQUIRED');
  if(['password','file','hidden','submit','button','checkbox','radio'].includes(type))throw new Error('SENSITIVE_ELEMENT_DENIED');
  const value=String(args.text??'').slice(0,10000);
  if(el.isContentEditable){el.textContent=value;el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));}
  else {
    const descriptor=Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value');
    if(descriptor?.set)descriptor.set.call(el,value);else el.value=value;
    el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  return result({updated:true,selector,characters:value.length});
 }
 if(op==='select_option'){
   const el=allowedElement(target());if(el.tagName!=='SELECT')throw new Error('SELECT_REQUIRED');
   const value=safe(args.value,500);if(!Array.from(el.options).some(x=>x.value===value))throw new Error('OPTION_NOT_FOUND');
   el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));return result({updated:true,selector});
 }
 if(op==='check_element'){
   const el=allowedElement(target());if(el.tagName!=='INPUT'||!['checkbox','radio'].includes(el.type))throw new Error('CHECKBOX_OR_RADIO_REQUIRED');
   el.checked=!!args.checked;el.dispatchEvent(new Event('change',{bubbles:true}));return result({updated:true,checked:el.checked});
 }
 if(op==='click'||op==='click_at'||op==='double_click'||op==='click_accessible'){
   const el=op==='click_at'?document.elementFromPoint(Number(args.x),Number(args.y)):target();
   actionGuard(el);el.click();
   if(op==='double_click')el.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,view:window}));
   return result({clicked:true,element:describe(el)});
 }
 throw new Error('OPERATION_NOT_SUPPORTED_IN_EXTENSION');
 }catch(e){return {ok:false,error:safe(e?.message||'DOM_ACTION_FAILED',100)}}
}
self.luchDomExecutor=luchDomExecutor;
