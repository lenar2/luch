'use strict';
// Self-contained function injected into an explicitly authorized website tab.
// No eval, remote JS, cookie access or reading password/file input values.
function luchExtendedDomExecutor({op,args={}}){
 const short=(v,n=250)=>String(v??'').slice(0,n);
 const maxItems=80, result=data=>({ok:true,url:location.href,data});
 const selector=short(args.selector,500);
 const find=()=>{
  if(!selector)throw Error('SELECTOR_REQUIRED');
  let el;try{el=document.querySelector(selector)}catch{throw Error('INVALID_SELECTOR')}
  if(!el)throw Error('ELEMENT_NOT_FOUND');
  if(secretField(el)||el.closest?.('[data-luch-no-ai]'))throw Error('SENSITIVE_ELEMENT_DENIED');
  return el;
 };
 const describe=el=>({tag:el.tagName.toLowerCase(),id:short(el.id),role:short(el.getAttribute('role')),text:short(el.innerText||el.textContent,160),name:short(el.getAttribute('name')),type:short(el.getAttribute('type'))});
 const secretField=el=>{
  const id=String(el.name||el.id||el.getAttribute?.('autocomplete')||'');
  return /(?:pass(?:word|key)?|secret|token|otp|one[-_ ]?time|two[-_ ]?factor|2fa|mfa|recovery|verification|csrf|auth(?:orization|entication)?|api[-_ ]?key)/i.test(id)||
   el.matches?.('input[type="password"],input[type="file"],input[type="hidden"],[autocomplete="one-time-code"],[autocomplete="current-password"],[autocomplete="new-password"]');
 };
 const sensitive=el=>secretField(el)||el.closest?.('[data-luch-no-ai]')||el.matches?.('[data-luch-no-ai]');

 const limited=nodes=>Array.from(nodes).filter(el=>!sensitive(el)).slice(0,maxItems);
 const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,left:r.left,bottom:r.bottom,right:r.right}};
 const css=el=>getComputedStyle(el);
 const valueOf=el=>el.isContentEditable?el.textContent:el.value;
 const edit=(el,value)=>{
  if(el.isContentEditable){el.textContent=value}
  else if(el.matches('input:not([type="password"]):not([type="file"]),textarea')){
   const p=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
   const descriptor=Object.getOwnPropertyDescriptor(p,'value');
   if(descriptor?.set)descriptor.set.call(el,value);else el.value=value;
  }else throw Error('EDITABLE_FIELD_REQUIRED');
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  return result({updated:true,length:String(value).length});
 };
 const safeUrl=v=>{try{const u=new URL(v,location.href);u.search='';u.hash='';return short(u.href,1024)}catch{return ''}};
 const num=(v,limit)=>{const n=Number(v);if(!Number.isFinite(n)||Math.abs(n)>limit)throw Error('INVALID_NUMBER');return n};
 try{
  if(op==='get_document_info')return result({url:location.href,title:short(document.title),readyState:document.readyState,lang:document.documentElement.lang,charset:document.characterSet,contentType:document.contentType,doctype:document.doctype?.name||null});
  if(op==='get_viewport')return result({width:innerWidth,height:innerHeight,devicePixelRatio:devicePixelRatio,scrollX,scrollY,screenWidth:screen.width,screenHeight:screen.height});
  if(op==='get_images')return result(limited(document.images).map(el=>({src:safeUrl(el.currentSrc||el.src),alt:short(el.alt),width:el.naturalWidth,height:el.naturalHeight,loading:el.loading})));
  if(op==='get_media')return result(limited(document.querySelectorAll('audio,video')).map(el=>({tag:el.tagName.toLowerCase(),src:safeUrl(el.currentSrc||el.src),duration:Number.isFinite(el.duration)?el.duration:null,paused:el.paused,muted:el.muted,controls:el.controls})));
  if(op==='get_buttons')return result(limited(document.querySelectorAll('button,input[type="button"],input[type="submit"],[role="button"]')).map(el=>({...describe(el),disabled:!!el.disabled})));
  if(op==='get_inputs')return result(limited(document.querySelectorAll('input,textarea,select,[contenteditable="true"]')).map(el=>({...describe(el),required:!!el.required,disabled:!!el.disabled,checked:el.checked===true,placeholder:short(el.placeholder)})));
  if(op==='get_labels')return result(limited(document.querySelectorAll('label')).map(el=>({text:short(el.innerText),for:short(el.htmlFor),control:el.control?.id||null})));
  if(op==='get_attributes')return result(Array.from(find().attributes).slice(0,maxItems).filter(a=>!/^on/i.test(a.name)&&!/(password|token|secret|authorization)/i.test(a.name)).map(a=>({name:a.name,value:short(a.value,500)})));
  if(op==='get_computed_style'){
   const el=find(),styles=css(el),keys=Array.isArray(args.properties)?args.properties.slice(0,40):['display','visibility','opacity','color','background-color','font-size','position','pointer-events'];
   return result(Object.fromEntries(keys.map(k=>[short(k,80),short(styles.getPropertyValue(short(k,80)),200)])));
  }
  if(op==='get_rect')return result(rect(find()));
  if(op==='get_visibility'){
   const el=find(),r=rect(el),s=css(el);
   return result({visible:!el.hidden&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.width>0&&r.height>0,rect:r,display:s.display,visibility:s.visibility,opacity:s.opacity});
  }
  if(op==='get_form_values'){
   const form=find();if(form.tagName!=='FORM')throw Error('FORM_REQUIRED');
   return result(limited(form.querySelectorAll('input,textarea,select')).filter(el=>!secretField(el))
    .map(el=>({name:short(el.name),type:short(el.type),value:short(valueOf(el),1000),checked:el.checked===true})));
  }
  if(op==='get_element_state'){
   const el=find();return result({...describe(el),disabled:!!el.disabled,required:!!el.required,checked:!!el.checked,selected:!!el.selected,hidden:!!el.hidden,focused:document.activeElement===el,ariaExpanded:el.getAttribute('aria-expanded'),ariaPressed:el.getAttribute('aria-pressed')});
  }
  if(op==='get_ancestors'){const all=[];let el=find();while(el&&el.nodeType===1&&all.length<24){all.push(describe(el));el=el.parentElement}return result(all)}
  if(op==='get_descendants')return result(limited(find().querySelectorAll('*')).map(describe));
  if(op==='get_shadow_elements'){
   const matches=[],query=short(args.query||'*',200),queue=[document],limit=1000;let visited=0;
   while(queue.length&&visited<limit&&matches.length<maxItems){
    const root=queue.shift(),nodes=root.querySelectorAll('*');
    for(const node of nodes){if(++visited>limit)break;if(node.shadowRoot)queue.push(node.shadowRoot);
     try{if(node.matches(query)&&!sensitive(node))matches.push(describe(node))}catch{throw Error('INVALID_QUERY')}
     if(matches.length>=maxItems)break;
    }
   }return result(matches);
  }
  if(op==='get_iframes')return result(limited(document.querySelectorAll('iframe,frame')).map(el=>({title:short(el.title),name:short(el.name),src:safeUrl(el.src),rect:rect(el)})));
  if(op==='get_dom_statistics')return result({elements:document.getElementsByTagName('*').length,links:document.links.length,forms:document.forms.length,images:document.images.length,buttons:document.querySelectorAll('button,[role="button"]').length,inputs:document.querySelectorAll('input,textarea,select').length,iframes:document.querySelectorAll('iframe').length});
  if(op==='get_selected_html'){
   const selection=window.getSelection();
   if(!selection?.rangeCount)return result({html:'',text:''});
   const box=document.createElement('div');
   box.appendChild(selection.getRangeAt(0).cloneContents());
   // Do not export arbitrary DOM attributes: a default password, hidden CSRF
   // token or opaque session identifier may be embedded in the HTML itself.
   for(const node of [...box.querySelectorAll('*')]){
    if(sensitive(node)){node.replaceWith(document.createTextNode('[redacted]'));continue}
    if(['SCRIPT','STYLE','TEMPLATE','IFRAME','OBJECT','EMBED'].includes(node.tagName)){
     node.remove();continue
    }
    for(const attr of [...node.attributes])node.removeAttribute(attr.name);
   }
   return result({html:short(box.innerHTML,20000),text:short(box.textContent,20000)});
  }
  if(op==='get_performance'){const nav=performance.getEntriesByType('navigation')[0];return result({navigation:nav?{type:nav.type,duration:nav.duration,domContentLoaded:nav.domContentLoadedEventEnd,loadEnd:nav.loadEventEnd,transferSize:nav.transferSize}:null,now:performance.now()})}
  if(op==='get_resources')return result(performance.getEntriesByType('resource').slice(-80).map(r=>({name:safeUrl(r.name),type:short(r.initiatorType),duration:r.duration,transferSize:r.transferSize||0})));
  if(op==='get_active_element')return result(document.activeElement?describe(document.activeElement):null);
  if(op==='blur'){find().blur();return result({blurred:true})}
  if(op==='clear_field')return edit(find(),'');
  if(op==='append_text'){const el=find();return edit(el,String(valueOf(el)||'')+short(args.text,10000))}
  if(op==='insert_at_cursor'){
   const el=find(),text=short(args.text,10000);
   if(typeof el.setRangeText!=='function')throw Error('INPUT_SELECTION_REQUIRED');
   el.setRangeText(text,el.selectionStart,el.selectionEnd,'end');
   el.dispatchEvent(new Event('input',{bubbles:true}));
   return result({inserted:true,selectionStart:el.selectionStart});
  }
  if(op==='select_text'){
   const el=find();if(typeof el.select==='function')el.select();
   else if(el.isContentEditable){const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(el);selection.removeAllRanges();selection.addRange(range)}
   else throw Error('TEXT_SELECTION_UNSUPPORTED');
   return result({selected:true});
  }
  if(op==='set_selection_range'){const el=find();if(typeof el.setSelectionRange!=='function')throw Error('INPUT_SELECTION_REQUIRED');el.setSelectionRange(num(args.start,1000000),num(args.end,1000000));return result({start:el.selectionStart,end:el.selectionEnd})}
  if(['toggle_details','open_details','close_details'].includes(op)){
   const el=find();if(el.tagName!=='DETAILS')throw Error('DETAILS_REQUIRED');
   el.open=op==='open_details'?true:op==='close_details'?false:!el.open;
   return result({open:el.open});
  }
  if(op==='submit_form'){const el=find();if(el.tagName!=='FORM')throw Error('FORM_REQUIRED');el.requestSubmit();return result({submissionRequested:true})}
  if(op==='reset_form'){const el=find();if(el.tagName!=='FORM')throw Error('FORM_REQUIRED');el.reset();return result({reset:true})}
  if(op==='scroll_element'){const el=find();el.scrollBy({left:num(args.dx||0,5000),top:num(args.dy||0,5000),behavior:'instant'});return result({left:el.scrollLeft,top:el.scrollTop})}
  if(op==='scroll_element_to'){const el=find();el.scrollTo({left:num(args.x||0,1000000),top:num(args.y||0,1000000),behavior:'instant'});return result({left:el.scrollLeft,top:el.scrollTop})}
  if(op==='set_range_value'){const el=find();if(!el.matches('input[type="range"]'))throw Error('RANGE_INPUT_REQUIRED');const n=num(args.value,100000000);if(n<Number(el.min||0)||n>Number(el.max||100))throw Error('RANGE_OUT_OF_BOUNDS');return edit(el,String(n))}
  throw Error('OPERATION_NOT_SUPPORTED');
 }catch(e){return {ok:false,error:short(e?.message||'EXTENDED_DOM_FAILED',100)}}
}
self.luchExtendedDomExecutor=luchExtendedDomExecutor;
