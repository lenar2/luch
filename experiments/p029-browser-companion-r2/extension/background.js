'use strict';
// LUCH Browser Companion v0.5: one-click read access, separately approved
// interactive access. Both last until the user revokes, tab is closed, browser
// session ends, or the tab changes origin. No arbitrary 15-minute cutoff.
importScripts('dom-ops.js','extended-dom-ops.js');
const BASE='https://api.lenarsalimov.ru/luch/browser';
// Bound request memory, not browser permissions. Never truncate the owner's tabs silently.
const MAX_TRANSPORT_TABS=500;
const READ_OPS=Object.freeze([
 'read_text','inspect_page','get_links','get_headings','get_forms','get_tables',
 'get_selection','query_elements','find_text','accessibility_snapshot',
 'hit_test','get_element','scroll_position','screenshot','tab_info','window_info','list_open_tabs',
 'get_document_info','get_viewport','get_images','get_media','get_buttons','get_inputs','get_labels','get_attributes','get_computed_style','get_rect','get_visibility','get_form_values','get_element_state','get_ancestors','get_descendants','get_shadow_elements','get_iframes','get_dom_statistics','get_selected_html','get_performance','get_resources','get_active_element','list_windows','get_zoom','get_tab_language','get_tab_details','get_browser_capabilities','downloads_list','wait_for_url','wait_for_load'
]);
const INTERACT_OPS=Object.freeze([
 'focus','hover','scroll_into_view','scroll','scroll_to','fill','insert_text',
 'type_text','select_option','check_element','click','click_at','double_click',
 'click_accessible','navigate','reload','back','forward','activate_tab',
 'close_tab','new_tab','new_window','window_set',
 'blur','clear_field','append_text','insert_at_cursor','select_text','set_selection_range','toggle_details','open_details','close_details','submit_form','reset_form','scroll_element','scroll_element_to','set_range_value','duplicate_tab','pin_tab','unpin_tab','mute_tab','unmute_tab','move_tab','discard_tab','set_zoom','press_key','key_chord','download_url'
]);
const EXTENDED_DOM=new Set(["get_document_info", "get_viewport", "get_images", "get_media", "get_buttons", "get_inputs", "get_labels", "get_attributes", "get_computed_style", "get_rect", "get_visibility", "get_form_values", "get_element_state", "get_ancestors", "get_descendants", "get_shadow_elements", "get_iframes", "get_dom_statistics", "get_selected_html", "get_performance", "get_resources", "get_active_element", "blur", "clear_field", "append_text", "insert_at_cursor", "select_text", "set_selection_range", "toggle_details", "open_details", "close_details", "submit_form", "reset_form", "scroll_element", "scroll_element_to", "set_range_value"]);
const BROWSER_EXTRAS=new Set(["list_windows", "get_zoom", "get_tab_language", "get_tab_details", "get_browser_capabilities", "duplicate_tab", "pin_tab", "unpin_tab", "mute_tab", "unmute_tab", "move_tab", "discard_tab", "set_zoom", "downloads_list", "wait_for_url", "wait_for_load", "press_key", "key_chord", "download_url"]);
const POINTER_OPS=Object.freeze(['pointer_move','pointer_click','pointer_double_click','pointer_drag','pointer_wheel']);
const POINTER=new Set(POINTER_OPS);
const READ=new Set(READ_OPS), INTERACT=new Set([...INTERACT_OPS,...POINTER_OPS]);
const PAGE_READ=new Set(READ_OPS.filter(x=>!['screenshot','tab_info','window_info','list_open_tabs',...BROWSER_EXTRAS].includes(x)));
const PAGE_WRITE=new Set(INTERACT_OPS.filter(x=>!['navigate','reload','back','forward','activate_tab','close_tab','new_tab','new_window','window_set',...BROWSER_EXTRAS].includes(x)));
let working=false;
const now=()=>Date.now();
const originOf=url=>{try{const u=new URL(url);return u.protocol==='http:'||u.protocol==='https:'?u.origin:null}catch{return null}};
const cleanUrl=url=>{try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error();return u.href}catch{throw new Error('INVALID_WEB_URL')}};
const safeTitle=s=>String(s||'').slice(0,180);
const tabSummary=t=>{
 const url=cleanTabUrl(t.url);
 if(!url||!Number.isSafeInteger(t.id))return null;
 return {id:t.id,title:safeTitle(t.title),url,windowId:Number(t.windowId)||0,active:!!t.active};
};
const cleanTabUrl=value=>{
 try{const u=new URL(value);
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;
  u.hash='';u.search='';
  return u.href.slice(0,2048);
 }catch{return null}
};
const tabOverview=async()=>{
 if(!await chrome.permissions.contains({permissions:['tabs']}))throw new Error('ALL_TABS_PERMISSION_REQUIRED');
 const all=await chrome.tabs.query({});
 const tabs=all.map(tabSummary).filter(Boolean);
 if(tabs.length>MAX_TRANSPORT_TABS)throw new Error('BROWSER_TAB_CAPACITY_EXCEEDED');
 return tabs;
};
async function publishTabOverview(auth){
 const session=(await chrome.storage.session.get('tabOverviewSharing')).tabOverviewSharing===true;
 if(!auth?.token)return;
 let tabs=[];
 if(session){try{tabs=await tabOverview()}catch{await chrome.storage.session.remove('tabOverviewSharing')}}
 await api('/extension/tab-overview',{method:'POST',token:auth.token,data:{enabled:session&&tabs.length>=0&&await chrome.permissions.contains({permissions:['tabs']}),tabs}});
}
const numeric=(value,name,min=0,max=10000)=>{
 const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw new Error(name+'_OUT_OF_RANGE');return n
};
async function pointerAction(tab,op,args,grantId){
 if(!await chrome.permissions.contains({permissions:['debugger']}))throw new Error('PRECISE_CURSOR_PERMISSION_REQUIRED');
 // The queued job was granted at poll time. Re-check live tab origin and
 // the exact user consent immediately before each native Input event.
 const expectedOrigin=originOf(tab.url);
 const ensureLiveApproval=async()=>{
  const liveTab=await chrome.tabs.get(tab.id);
  if(originOf(liveTab.url)!==expectedOrigin)throw new Error('TAB_ORIGIN_CHANGED');
  const live=await state(),grant=live.grants[tab.id];
  if(!live.auth||!grant||grant.grantId!==grantId||grant.origin!==expectedOrigin||
     grant.scope!=='interact'||grant.preciseCursor!==true)
   throw new Error('PRECISE_CURSOR_APPROVAL_REVOKED');
 };
 const root={tabId:tab.id};
 const bounds=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>({width:window.innerWidth,height:window.innerHeight})});
 const view=bounds?.[0]?.result;
 if(!view||!view.width||!view.height)throw new Error('POINTER_VIEWPORT_NOT_AVAILABLE');
 const x=numeric(args.x,'X',0,view.width),y=numeric(args.y,'Y',0,view.height);
 const to=op==='pointer_drag'?{x:numeric(args.toX,'DESTINATION_X',0,view.width),y:numeric(args.toY,'DESTINATION_Y',0,view.height)}:null;
 const probe=async(x,y)=>{
  const r=await chrome.scripting.executeScript({target:{tabId:tab.id},func:self.luchDomExecutor,args:[{op:'verify_pointer_target',args:{x,y}}]});
  if(r?.[0]?.result?.ok!==true)throw new Error(r?.[0]?.result?.error||'UNSAFE_POINTER_TARGET');
 };
 if(['pointer_click','pointer_double_click','pointer_drag'].includes(op)){
  await probe(x,y);
  if(to){
   // A drag crosses intermediate elements, not only its endpoints.
   for(let k=1;k<=6;k++)await probe(x+(to.x-x)*k/6,y+(to.y-y)*k/6);
  }
 }
 const dev=root;let attached=false,pressed=false;
 const move=async(x,y,buttons=0)=>{await ensureLiveApproval();return chrome.debugger.sendCommand(dev,'Input.dispatchMouseEvent',{type:'mouseMoved',x,y,buttons})};
 const press=async(x,y,clickCount=1)=>{
  await ensureLiveApproval();
  await chrome.debugger.sendCommand(dev,'Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount});
  pressed=true;
 };
 const release=async(x,y,clickCount=1)=>{
  await ensureLiveApproval();
  await chrome.debugger.sendCommand(dev,'Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount});
  pressed=false;
 };
 try{
  await ensureLiveApproval();
  await chrome.debugger.attach(dev,'1.3');attached=true;
  await ensureLiveApproval();
  if(op==='pointer_move')await move(x,y);
  if(op==='pointer_click'||op==='pointer_double_click'){
   await move(x,y);
   for(let k=1;k<=(op==='pointer_double_click'?2:1);k++){await press(x,y,k);await release(x,y,k)}
  }
  if(op==='pointer_drag'){
   await move(x,y);await press(x,y);
   for(let k=1;k<=6;k++)await move(x+(to.x-x)*k/6,y+(to.y-y)*k/6,1);
   await release(to.x,to.y);
  }
  if(op==='pointer_wheel'){
   const deltaX=numeric(args.deltaX??0,'WHEEL_X',-2000,2000);
   const deltaY=numeric(args.deltaY??0,'WHEEL_Y',-2000,2000);
   await ensureLiveApproval();
   await chrome.debugger.sendCommand(dev,'Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX,deltaY});
  }
  return {ok:true,data:{operation:op,pageCoordinates:{x,y},...(to?{destination:to}:{})},source:'USER_APPROVED_PRECISE_CURSOR'};
 }finally{
  if(attached){
   // Release a held button only if we are still on the same origin; never
   // send a synthetic click-up to a newly navigated page.
   if(pressed)try{
    const live=await chrome.tabs.get(tab.id);
    if(originOf(live.url)===expectedOrigin)
     await chrome.debugger.sendCommand(dev,'Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1});
   }catch{}
   try{await chrome.debugger.detach(dev)}catch{}
  }
 }
}

const makeNonce=()=>Array.from(crypto.getRandomValues(new Uint8Array(12)),v=>v.toString(16).padStart(2,'0')).join('');
async function state(){
 const [auth,record,owned]=await Promise.all([
  chrome.storage.local.get('auth'),chrome.storage.session.get('grants'),chrome.storage.session.get('ownedTabs')]);
 return {auth:auth.auth||null,grants:record.grants||{},owned:owned.ownedTabs||[]};
}
async function setGrants(grants){
 await chrome.storage.session.set({grants});
 const active=new Set(Object.keys(grants).map(Number));
 const all=await chrome.tabs.query({});
 for(const t of all){if(!Number.isSafeInteger(t.id))continue;
  await chrome.action.setBadgeText({tabId:t.id,text:active.has(t.id)?(grants[t.id].scope==='interact'?'AI':'ON'):''});
  if(active.has(t.id))await chrome.action.setBadgeBackgroundColor({tabId:t.id,color:grants[t.id].scope==='interact'?'#b7794b':'#317a54'});
 }
}
async function api(path,{method='GET',data,token}={}){
 const headers={'Accept':'application/json'};
 if(token)headers.Authorization='Bearer '+token;
 if(data!==undefined)headers['Content-Type']='application/json';
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),7500);
 try{const response=await fetch(BASE+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data),signal:ctl.signal,cache:'no-store'});
  const body=await response.json();if(!response.ok||!body.ok)throw new Error(body.error||'BROKER_ERROR');return body;
 }finally{clearTimeout(timer)}
}
async function activeTab(){const t=(await chrome.tabs.query({active:true,currentWindow:true}))[0];return t&&originOf(t.url)?t:null}
async function prune(grants){
 let changed=false;
 for(const [key,g] of Object.entries(grants)){
  try{const t=await chrome.tabs.get(Number(key));
   if(originOf(t.url)!==g.origin){delete grants[key];changed=true}
   else if(t.url!==g.url||t.title!==g.title){g.url=t.url;g.title=safeTitle(t.title);changed=true}
  }catch{delete grants[key];changed=true}
 }
 if(changed)await setGrants(grants);
 return grants;
}
let grantPublishQueue=Promise.resolve();
function publishGrants(auth,_grants){
 if(!auth?.token)return Promise.resolve();
 // A poll and a user revocation may overlap. Serialize publications and
 // read the LATEST session grants at send time, never a stale poll snapshot.
 const send=async()=>{
  const current=await state();
  if(current.auth?.token!==auth.token)return;
  const list=Object.values(current.grants).map(g=>({tabId:g.tabId,grantId:g.grantId,url:g.url,title:g.title,scope:g.scope,preciseCursor:g.preciseCursor===true}));
  await api('/extension/grants',{method:'POST',token:auth.token,data:{grants:list}});
 };
 grantPublishQueue=grantPublishQueue.catch(()=>{}).then(send);
 return grantPublishQueue;
}
// Owner explicitly enables browser-wide scope once in the popup. This does
// not bypass Chrome's optional host/extension permission dialog.
const FULL_ORIGINS=['http://*/*','https://*/*'];
async function fullModeEnabled(){return (await chrome.storage.local.get('fullMode')).fullMode===true}
async function refreshFullGrants(){
 if(!await fullModeEnabled())return false;
 if(!await chrome.permissions.contains({origins:FULL_ORIGINS}))return false;
 if(!await chrome.permissions.contains({permissions:['tabs']}))return false;
 const s=await state();if(!s.auth?.token)return false;
 const active=await chrome.tabs.query({}),grants={},cursor=await chrome.permissions.contains({permissions:['debugger']});
 const eligible=active.filter(t=>originOf(t.url)&&Number.isSafeInteger(t.id));
 if(eligible.length>MAX_TRANSPORT_TABS){
  await chrome.storage.session.set({fullModeError:'BROWSER_TAB_CAPACITY_EXCEEDED'});
  throw new Error('BROWSER_TAB_CAPACITY_EXCEEDED');
 }
 await chrome.storage.session.remove('fullModeError');
 for(const t of eligible){
  const current=s.grants[t.id];
  const same=current&&current.origin===originOf(t.url);
  grants[t.id]={tabId:t.id,grantId:same?current.grantId:makeNonce(),url:t.url,
   origin:originOf(t.url),title:safeTitle(t.title),scope:'interact',preciseCursor:cursor};
 }
 await setGrants(grants);
 await publishGrants(s.auth,grants);
 await chrome.storage.session.set({tabOverviewSharing:true});
 await publishTabOverview(s.auth);
 return true;
}
async function disableFullMode(){
 await chrome.storage.local.remove('fullMode');
 const s=await state();
 await chrome.storage.session.remove('tabOverviewSharing');
 await chrome.storage.session.remove('fullModeError');
 await setGrants({});
 try{await Promise.all([publishGrants(s.auth,{}),publishTabOverview(s.auth)])}
 catch{return {message:'Full browser automation stopped locally; cloud sync pending',pendingSync:true}}
 return {message:'Full browser automation stopped',pendingSync:false};
}

async function grantActive(scope='read'){
 if(scope!=='read'&&scope!=='interact')throw new Error('INVALID_SCOPE');
 const t=await activeTab();if(!t)throw new Error('Open an ordinary webpage');
 const s=await state();if(!s.auth)throw new Error('Pair LUCH Companion first');
 // A real user must click this extension in THIS tab to obtain activeTab access.
 await chrome.scripting.executeScript({target:{tabId:t.id},func:()=>Boolean(document.body)});
 const existing=s.grants[t.id];
 // An explicit interaction grant includes read access; no redundant read approval.
 const g=existing?{...existing,scope}:{
  tabId:t.id,grantId:makeNonce(),url:t.url,origin:originOf(t.url),title:safeTitle(t.title),scope,preciseCursor:false
 };
 if(existing&&existing.origin!==originOf(t.url))throw new Error('ORIGIN_CHANGED_REAPPROVAL_REQUIRED');
 const previous=existing;
 s.grants[t.id]=g;
 try{await setGrants(s.grants);await publishGrants(s.auth,s.grants)}
 catch(e){if(previous)s.grants[t.id]=previous;else delete s.grants[t.id];await setGrants(s.grants);throw e}
 return {message:scope==='interact'?'Interactions allowed on this tab until you revoke':'This tab is available to LUCH until you revoke'};
}
async function revokeActive(){
 const s=await state(),t=await activeTab();
 if(!t||!s.grants[t.id])throw new Error('NO_APPROVED_TAB_TO_REVOKE');
 // Drop the local grant first: the MV3 worker must deny all new commands
 // immediately, even if the cloud is temporarily unreachable.
 delete s.grants[t.id];
 await setGrants(s.grants);
 try{await publishGrants(s.auth,s.grants)}
 catch{return {message:'Local tab access revoked; cloud sync pending',pendingSync:true}}
 return {message:'Sharing stopped for this tab',pendingSync:false};
}
async function disconnect(){
 const s=await state();let cloudRevoked=!s.auth;
 // Stop locally FIRST, so a queued browser command cannot begin while the
 // remote token is being invalidated. Never claim remote revoke on outage.
 await Promise.all([chrome.storage.local.remove('auth'),chrome.storage.local.remove('fullMode'),chrome.storage.session.remove('grants'),chrome.storage.session.remove('ownedTabs'),chrome.storage.session.remove('tabOverviewSharing')]);
 await setGrants({});
 if(s.auth){try{await api('/extension/disconnect',{method:'POST',token:s.auth.token});cloudRevoked=true}catch{}}
 return {message:cloudRevoked?'Browser disconnected from LUCH':'Browser access stopped locally; revoke the device in your AI when online',cloudRevoked};
}
async function performJob(job){
 // A claimed job is NOT consent. Re-read live extension session after every
 // poll so revoking a tab or disconnecting stops pending commands.
 const current=await state();
 if(!current.auth)return {ok:false,error:'DEVICE_DISCONNECTED'};
 const grants=current.grants,owned=current.owned;
 const g=grants[Number(String(job?.targetId||'').split(':')[1])];
 if(!g||('ext:'+g.tabId+':'+g.grantId)!==job.targetId)return {ok:false,error:'USER_TAB_PERMISSION_REQUIRED'};
 const op=String(job.op|| (job.kind==='read_text'?'read_text':''));
 if(!READ.has(op)&&!INTERACT.has(op))return {ok:false,error:'ACTION_NOT_ALLOWED'};
 if(INTERACT.has(op)&&g.scope!=='interact')return {ok:false,error:'INTERACTION_APPROVAL_REQUIRED'};
 let t;try{t=await chrome.tabs.get(g.tabId)}catch{return {ok:false,error:'TAB_CLOSED'}};
 if(originOf(t.url)!==g.origin)return {ok:false,error:'TAB_ORIGIN_CHANGED'};
 const args=job.args&&typeof job.args==='object'&&!Array.isArray(job.args)?job.args:{};
 try{
  if(PAGE_READ.has(op)||PAGE_WRITE.has(op)){
   const latest=(await state()).grants[g.tabId];
   if(!latest||latest.grantId!==g.grantId||latest.origin!==g.origin||
      (INTERACT.has(op)&&latest.scope!=='interact'))
    return {ok:false,error:'USER_TAB_PERMISSION_REVOKED'};
   const r=await chrome.scripting.executeScript({target:{tabId:g.tabId},func:EXTENDED_DOM.has(op)?self.luchExtendedDomExecutor:self.luchDomExecutor,args:[{op,args}]});
   const result=r?.[0]?.result;
   if(!result||!result.ok)return {ok:false,error:result?.error||'NO_SCRIPT_RESULT'};
   if(originOf(result.url)!==g.origin)return {ok:false,error:'TAB_CONTENT_MISMATCH'};
   return {ok:true,data:result.data,title:safeTitle(t.title),source:'USER_CONSENTED_TAB',...(op==='read_text'?{text:String(result.data?.text||'').slice(0,65536)}:{})};
  }
  if(POINTER.has(op)){
   if(!g.preciseCursor)return {ok:false,error:'PRECISE_CURSOR_APPROVAL_REQUIRED'};
   return await pointerAction(t,op,args,g.grantId);
  }
  if(op==='list_open_tabs'){
   if(!(await chrome.storage.session.get('tabOverviewSharing')).tabOverviewSharing)
    return {ok:false,error:'ALL_TABS_USER_APPROVAL_REQUIRED'};
   return {ok:true,data:{tabs:await tabOverview(),pageContentsShared:false,scope:'USER_APPROVED_TAB_METADATA_ONLY'}};
  }
  if(op==='get_browser_capabilities'){
   const names=['tabs','debugger','downloads'];
   const allowed={};for(const permission of names)allowed[permission]=await chrome.permissions.contains({permissions:[permission]});
   return {ok:true,data:{version:chrome.runtime.getManifest().version,permissions:allowed,operations:READ_OPS.length+INTERACT_OPS.length+POINTER_OPS.length}};
  }
  if(op==='list_windows'){
   if(!await chrome.permissions.contains({permissions:['tabs']}))throw Error('ALL_TABS_PERMISSION_REQUIRED');
   const ws=await chrome.windows.getAll({populate:false});
   return {ok:true,data:ws.map(w=>({id:w.id,focused:w.focused,state:w.state,type:w.type,left:w.left,top:w.top,width:w.width,height:w.height}))};
  }
  if(op==='get_zoom')return {ok:true,data:{factor:await chrome.tabs.getZoom(g.tabId)}};
  if(op==='get_tab_language')return {ok:true,data:{language:await chrome.tabs.detectLanguage(g.tabId)}};
  if(op==='get_tab_details')return {ok:true,data:{id:t.id,title:safeTitle(t.title),url:cleanTabUrl(t.url),status:t.status,pinned:!!t.pinned,muted:!!t.mutedInfo?.muted,audible:!!t.audible,discarded:!!t.discarded,index:t.index,windowId:t.windowId,groupId:t.groupId}};
  if(['duplicate_tab','pin_tab','unpin_tab','mute_tab','unmute_tab','move_tab','discard_tab','set_zoom'].includes(op)){
   if(op==='duplicate_tab'){
    const next=await chrome.tabs.duplicate(g.tabId);
    await chrome.storage.session.set({ownedTabs:[...owned,next.id]});
    return {ok:true,data:{tabId:next.id,duplicated:true,requiresApproval:!(await fullModeEnabled())}};
   }
   if(op==='pin_tab'||op==='unpin_tab'){await chrome.tabs.update(g.tabId,{pinned:op==='pin_tab'});return {ok:true,data:{pinned:op==='pin_tab'}}}
   if(op==='mute_tab'||op==='unmute_tab'){await chrome.tabs.update(g.tabId,{muted:op==='mute_tab'});return {ok:true,data:{muted:op==='mute_tab'}}}
   if(op==='move_tab'){
    const index=Number(args.index);if(!Number.isSafeInteger(index)||index<0||index>10000)throw Error('INVALID_TAB_INDEX');
    const config={index};if(args.windowId!==undefined){const id=Number(args.windowId);if(!Number.isSafeInteger(id)||id<0)throw Error('INVALID_WINDOW_ID');config.windowId=id}
    const moved=await chrome.tabs.move(g.tabId,config);return {ok:true,data:{index:moved.index,windowId:moved.windowId}};
   }
   if(op==='discard_tab'){const discarded=await chrome.tabs.discard(g.tabId);return {ok:true,data:{discarded:!!discarded}}}
   if(op==='set_zoom'){
    const factor=Number(args.factor);if(!Number.isFinite(factor)||factor<0.25||factor>5)throw Error('INVALID_ZOOM_FACTOR');
    await chrome.tabs.setZoom(g.tabId,factor);return {ok:true,data:{factor}};
   }
  }
  if(op==='downloads_list'||op==='download_url'){
   if(!await chrome.permissions.contains({permissions:['downloads']}))throw Error('DOWNLOADS_PERMISSION_REQUIRED');
   if(op==='downloads_list'){
    const entries=await chrome.downloads.search({limit:30,orderBy:['-startTime']});
    return {ok:true,data:entries.map(x=>({id:x.id,url:cleanTabUrl(x.url),state:x.state,bytesReceived:x.bytesReceived,totalBytes:x.totalBytes,filename:x.filename,exists:x.exists}))};
   }
   const url=cleanUrl(args.url);let filename;
   if(args.filename!==undefined){filename=String(args.filename);if(!filename||filename.length>160||filename.includes('..')||filename.startsWith('/')||filename.includes('\\'))throw Error('INVALID_DOWNLOAD_FILENAME')}
   const id=await chrome.downloads.download({url,...(filename?{filename}:{}),conflictAction:'uniquify'});
   return {ok:true,data:{downloadId:id,started:true}};
  }
  if(op==='wait_for_url'||op==='wait_for_load'){
   // Leave time for the 55s cloud job reply and 48s local broker reply.
   const timeout=Math.min(Math.max(Number(args.timeoutMs)||5000,50),40000);
   const started=Date.now(),expected=op==='wait_for_url'?cleanUrl(args.url):null;
   while(Date.now()-started<timeout){
    const live=await chrome.tabs.get(g.tabId);
    if(originOf(live.url)!==g.origin)throw Error('TAB_ORIGIN_CHANGED');
    if(op==='wait_for_url'&&live.url===expected)return {ok:true,data:{matched:true,url:live.url}};
    if(op==='wait_for_load'&&live.status==='complete')return {ok:true,data:{loaded:true,url:live.url}};
    await new Promise(resolve=>setTimeout(resolve,150));
   }throw Error('WAIT_TIMEOUT');
  }
  if(op==='press_key'||op==='key_chord'){
   if(!await chrome.permissions.contains({permissions:['debugger']}))throw Error('KEYBOARD_PERMISSION_REQUIRED');
   const key=String(args.key||'');
   const namedKeys={Enter:13,Tab:9,Escape:27,Backspace:8,Delete:46,Space:32,
    ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39,Home:36,End:35,
    PageUp:33,PageDown:34,Insert:45,CapsLock:20,NumLock:144,
    ScrollLock:145,Pause:19,PrintScreen:44};
   const punctuation={'-':189,'=':187,'[':219,']':221,'\\':220,';':186,"'":222,
    ',':188,'.':190,'/':191,'`':192};
   const functionKey=/^F([1-9]|1[0-9]|2[0-4])$/.exec(key);
   const numpadKey=/^Numpad([0-9])$/.exec(key);
   const single=/^[a-zA-Z0-9]$/.test(key);
   if(!single&&!functionKey&&!numpadKey&&!(key in namedKeys)&&!(key in punctuation))throw Error('INVALID_KEY');
   const code=single?(/[0-9]/.test(key)?'Digit'+key:'Key'+key.toUpperCase()):key;
   const virtualKey=functionKey?111+Number(functionKey[1]):
    numpadKey?96+Number(numpadKey[1]):
    (key in namedKeys)?namedKeys[key]:(key in punctuation)?punctuation[key]:
    key.toUpperCase().charCodeAt(0);
   const mods=op==='key_chord'?Number(args.modifiers)||0:0;
   if(!Number.isInteger(mods)||mods<0||mods>15)throw Error('INVALID_KEY_MODIFIERS');
   const debuggerTab={tabId:g.tabId};let attached=false;
   try{
    await chrome.debugger.attach(debuggerTab,'1.3');attached=true;
    for(const type of ['keyDown','keyUp']){
     const live=await chrome.tabs.get(g.tabId),s=await state(),grant=s.grants[g.tabId];
     if(originOf(live.url)!==g.origin||grant?.grantId!==g.grantId||grant?.scope!=='interact')throw Error('TAB_PERMISSION_REVOKED');
     await chrome.debugger.sendCommand(debuggerTab,'Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:virtualKey,modifiers:mods});
    }
    return {ok:true,data:{key,modifiers:mods,sent:true}};
   }finally{if(attached)try{await chrome.debugger.detach(debuggerTab)}catch{}}
  }
  if(op==='tab_info')return {ok:true,data:{title:safeTitle(t.title),url:t.url,active:!!t.active,scope:g.scope}};
  if(op==='window_info'){const w=await chrome.windows.get(t.windowId);return {ok:true,data:{width:w.width,height:w.height,left:w.left,top:w.top,state:w.state}}}
  if(op==='screenshot'){
   if(!t.active)throw new Error('TAB_MUST_BE_ACTIVE');
   const image=await chrome.tabs.captureVisibleTab(t.windowId,{format:'jpeg',quality:42});
   if(image.length>520000)throw new Error('SCREENSHOT_TOO_LARGE');
   return {ok:true,data:{dataUrl:image,mimeType:'image/jpeg',source:'USER_CONSENTED_TAB'}};
  }
  if(op==='navigate'){const to=cleanUrl(args.url);await chrome.tabs.update(g.tabId,{url:to});return {ok:true,data:{navigating:true,url:to}}}
  if(op==='reload'){await chrome.tabs.reload(g.tabId);return {ok:true,data:{reloading:true}}}
  if(op==='back'||op==='forward'){if(op==='back')await chrome.tabs.goBack(g.tabId);else await chrome.tabs.goForward(g.tabId);return {ok:true,data:{navigating:true}}}
  if(op==='activate_tab'){await chrome.tabs.update(g.tabId,{active:true});return {ok:true,data:{active:true}}}
  if(op==='close_tab'){
   // The owner-authorized interactive grant permits closing this tab.
   await chrome.tabs.remove(g.tabId);return {ok:true,data:{closed:true}};
  }
  if(op==='new_tab'||op==='new_window'){
   const url=cleanUrl(args.url);
   if(op==='new_tab'){const added=await chrome.tabs.create({url,active:false});await chrome.storage.session.set({ownedTabs:[...owned,added.id]});return {ok:true,data:{opened:true,tabId:added.id,requiresApproval:!(await fullModeEnabled())}}}
   const w=await chrome.windows.create({url,focused:false});return {ok:true,data:{opened:true,windowId:w.id,requiresApproval:!(await fullModeEnabled())}};
  }
  if(op==='window_set'){
   const values={};for(const k of ['width','height','left','top']){if(args[k]!==undefined){
    const v=Number(args[k]);if(!Number.isSafeInteger(v)||(k==='width'||k==='height')&&v<100)throw new Error('INVALID_WINDOW_RECT');values[k]=v;
   }}if(!Object.keys(values).length)throw new Error('WINDOW_RECT_REQUIRED');
   await chrome.windows.update(t.windowId,values);return {ok:true,data:{updated:true}};
  }
 }catch(e){return {ok:false,error:String(e.message||e).slice(0,100)}}
 return {ok:false,error:'OPERATION_NOT_IMPLEMENTED'};
}
async function poll(){
 if(working)return;working=true;
 try{const s=await state();if(!s.auth?.token)return;
  if(await fullModeEnabled())await refreshFullGrants();
  const grants=await prune((await state()).grants);
  // Also heartbeat grants; browser close/restart ends them, no arbitrary TTL.
  await publishGrants(s.auth,grants);
  await publishTabOverview(s.auth);
  const tasks=await api('/extension/jobs',{token:s.auth.token});
  for(const job of (tasks.jobs||[]).slice(0,3)){
   let result;try{result=await performJob(job)}catch(e){result={ok:false,error:String(e.message||e).slice(0,100)}}
   await api('/extension/result',{method:'POST',token:s.auth.token,data:{jobId:job.id,result}});
  }
 }catch{}finally{working=false}
}
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
 if(sender.id!==chrome.runtime.id){respond({ok:false,error:'UNTRUSTED_SENDER'});return false}
 (async()=>{
  if(msg.op==='capabilities')return {ok:true,read:READ_OPS,interact:INTERACT_OPS,pointer:POINTER_OPS,total:READ_OPS.length+INTERACT_OPS.length+POINTER_OPS.length,sessionScoped:true};
  if(msg.op==='enable-full'){
   const s=await state();if(!s.auth?.token)throw Error('PAIR_LUCH_FIRST');
   if(!await chrome.permissions.contains({origins:FULL_ORIGINS}))throw Error('BROWSER_WIDE_PERMISSION_REQUIRED');
   if(!await chrome.permissions.contains({permissions:['tabs','debugger','downloads']}))throw Error('BROWSER_CAPABILITIES_PERMISSION_REQUIRED');
   await chrome.storage.local.set({fullMode:true});
   try{await refreshFullGrants()}catch(e){await disableFullMode();throw e}
   return {ok:true,enabled:true,message:'Full browser access enabled'};
  }
  if(msg.op==='disable-full')return {ok:true,...await disableFullMode()};
  if(msg.op==='status'){
   const s=await state(),t=await activeTab();await prune(s.grants);
   let connected=!!s.auth,online=false;
   if(connected){
    try{
     const health=await api('/health',{token:s.auth.token});
     if(health.paired===true){online=true}
     else{
      // Explicit server-side revocation is permanent; network failures are
      // NOT. Never delete a paired user's credentials because of a timeout.
      connected=false;
      await Promise.all([chrome.storage.local.remove('auth'),chrome.storage.session.remove('grants'),chrome.storage.session.remove('tabOverviewSharing')]);
      await setGrants({});
     }
    }catch(e){
     if(String(e.message||e).includes('DEVICE_UNAUTHORIZED')){
      connected=false;
      await Promise.all([chrome.storage.local.remove('auth'),chrome.storage.session.remove('grants'),chrome.storage.session.remove('tabOverviewSharing')]);
      await setGrants({});
     }
     // Transient outage, 5xx, invalid JSON and timeout: preserve the
     // pairing and local grants. The cloud will be retried on its next poll.
    }
   }
   const g=connected&&t&&s.grants[t.id];
   const hasTabs=await chrome.permissions.contains({permissions:['tabs']});
   const hasDebugger=await chrome.permissions.contains({permissions:['debugger']});
   const sharing=connected&&(await chrome.storage.session.get('tabOverviewSharing')).tabOverviewSharing===true&&hasTabs;
   return {ok:true,connected,online,fullMode:connected&&await fullModeEnabled(),fullModeError:(await chrome.storage.session.get('fullModeError')).fullModeError||null,tab:t&&{title:safeTitle(t.title),url:t.url},granted:!!g,scope:g?.scope||null,
    preciseCursor:!!g?.preciseCursor&&hasDebugger,tabOverviewPermission:hasTabs,tabOverviewSharing:sharing,
    grantedCount:connected?Object.keys(s.grants).length:0,sessionScoped:true};
  }
  if(msg.op==='pair'){
   if(!/^\d{8}$/.test(msg.code||''))throw new Error('Enter your eight-digit pairing code');
   const manifest=chrome.runtime.getManifest?.()||{};
   const ua=typeof navigator!=='undefined'?String(navigator.userAgent||''):'';
   const browser=/OPR\//.test(ua)?'opera':'chrome';
   const r=await api('/pair',{method:'POST',data:{
    code:msg.code,deviceName:`LUCH Browser Companion · ${browser}`,browser,
    extensionVersion:String(manifest.version||'unknown')
   }});
   await chrome.storage.local.set({auth:{token:r.token}});await chrome.storage.session.remove('tabOverviewSharing');await setGrants({});await poll();return {ok:true,message:'LUCH connected'};
  }
  if(msg.op==='list-open-tabs'){
   const s=await state();if(!s.auth)throw new Error('PAIR_LUCH_FIRST');
   return {ok:true,tabs:await tabOverview(),shared:(await chrome.storage.session.get('tabOverviewSharing')).tabOverviewSharing===true};
  }
  if(msg.op==='activate-open-tab'){
   const s=await state();if(!s.auth)throw new Error('PAIR_LUCH_FIRST');
   if(!Number.isSafeInteger(msg.tabId)||msg.tabId<0)throw new Error('INVALID_TAB_ID');
   // Selection is a direct user click; it grants no content-reading rights.
   const listed=(await tabOverview()).find(t=>t.id===msg.tabId);
   if(!listed)throw new Error('TAB_NOT_IN_APPROVED_OVERVIEW');
   const current=await chrome.tabs.get(listed.id);
   if(cleanTabUrl(current.url)!==listed.url)throw new Error('TAB_CHANGED_RETRY');
   await chrome.tabs.update(listed.id,{active:true});
   await chrome.windows.update(current.windowId,{focused:true});
   return {ok:true,activated:true,requiresApproval:true};
  }
  if(msg.op==='share-tab-overview'){
   const s=await state();if(!s.auth)throw new Error('PAIR_LUCH_FIRST');
   const enable=msg.enabled===true;
   if(enable)await tabOverview();
   await chrome.storage.session.set({tabOverviewSharing:enable});
   await publishTabOverview(s.auth);
   return {ok:true,sharing:enable};
  }
  if(msg.op==='precise-cursor'){
   const s=await state(),t=await activeTab();
   if(!s.auth||!t||!s.grants[t.id]||s.grants[t.id].scope!=='interact')throw new Error('INTERACTION_APPROVAL_REQUIRED');
   if(msg.enabled===true&&!await chrome.permissions.contains({permissions:['debugger']}))throw new Error('PRECISE_CURSOR_PERMISSION_REQUIRED');
   const old=s.grants[t.id];
   s.grants[t.id]={...old,preciseCursor:msg.enabled===true};
   try{await setGrants(s.grants);await publishGrants(s.auth,s.grants)}
   catch(e){s.grants[t.id]=old;await setGrants(s.grants);throw e}
   return {ok:true,enabled:msg.enabled===true};
  }
  if(msg.op==='grant-active')return {ok:true,...await grantActive('read')};
  if(msg.op==='allow-interaction')return {ok:true,...await grantActive('interact')};
  if(msg.op==='revoke-active')return {ok:true,...await revokeActive()};
  if(msg.op==='disconnect')return {ok:true,...await disconnect()};
  throw new Error('UNKNOWN_COMMAND');
 })().then(respond,e=>respond({ok:false,error:String(e.message||e).slice(0,160)}));return true;
});
chrome.tabs.onUpdated.addListener(async(id,change)=>{
 if(!change.url)return;
 const s=await state(),g=s.grants[id];if(!g)return;
 if(originOf(change.url)!==g.origin)delete s.grants[id];else g.url=change.url;
 if(await fullModeEnabled())try{await refreshFullGrants()}catch{}
 else {await setGrants(s.grants);try{await publishGrants(s.auth,s.grants)}catch{}}
});
chrome.tabs.onCreated?.addListener?.(async()=>{if(await fullModeEnabled())try{await refreshFullGrants()}catch{}});
chrome.tabs.onRemoved.addListener(async id=>{
 const s=await state();if(s.grants[id]){delete s.grants[id];await setGrants(s.grants);try{await publishGrants(s.auth,s.grants)}catch{}}
 if(s.owned.includes(id))await chrome.storage.session.set({ownedTabs:s.owned.filter(x=>x!==id)});
 if(await fullModeEnabled())try{await refreshFullGrants()}catch{}
});
chrome.alarms.create('luch-poll',{periodInMinutes:0.5});
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='luch-poll')poll()});
setInterval(poll,5000);

chrome.permissions.onRemoved.addListener(async permissions=>{
 if(await fullModeEnabled())try{if(!await chrome.permissions.contains({origins:FULL_ORIGINS})||!await chrome.permissions.contains({permissions:['tabs']}))await disableFullMode();else await refreshFullGrants()}catch{}
 if(permissions.permissions?.includes('tabs')){
  await chrome.storage.session.remove('tabOverviewSharing');
  const s=await state();try{await publishTabOverview(s.auth)}catch{}
 }
 if(permissions.permissions?.includes('debugger')){
  const s=await state();let changed=false;
  for(const g of Object.values(s.grants))if(g.preciseCursor){g.preciseCursor=false;changed=true}
  if(changed){await setGrants(s.grants);try{await publishGrants(s.auth,s.grants)}catch{}}
 }
});