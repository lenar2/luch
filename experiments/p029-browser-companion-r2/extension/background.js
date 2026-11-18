'use strict';
// LUCH Browser Companion v0.5: one-click read access, separately approved
// interactive access. Both last until the user revokes, tab is closed, browser
// session ends, or the tab changes origin. No arbitrary 15-minute cutoff.
importScripts('dom-ops.js');
const BASE='http://127.0.0.1:9248';
const READ_OPS=Object.freeze([
 'read_text','inspect_page','get_links','get_headings','get_forms','get_tables',
 'get_selection','query_elements','find_text','accessibility_snapshot',
 'hit_test','get_element','scroll_position','screenshot','tab_info','window_info','list_open_tabs'
]);
const INTERACT_OPS=Object.freeze([
 'focus','hover','scroll_into_view','scroll','scroll_to','fill','insert_text',
 'type_text','select_option','check_element','click','click_at','double_click',
 'click_accessible','navigate','reload','back','forward','activate_tab',
 'close_tab','new_tab','new_window','window_set'
]);
const POINTER_OPS=Object.freeze(['pointer_move','pointer_click','pointer_double_click','pointer_drag','pointer_wheel']);
const POINTER=new Set(POINTER_OPS);
const READ=new Set(READ_OPS), INTERACT=new Set([...INTERACT_OPS,...POINTER_OPS]);
const PAGE_READ=new Set(READ_OPS.filter(x=>!['screenshot','tab_info','window_info','list_open_tabs'].includes(x)));
const PAGE_WRITE=new Set(INTERACT_OPS.filter(x=>!['navigate','reload','back','forward','activate_tab','close_tab','new_tab','new_window','window_set'].includes(x)));
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
 return all.map(tabSummary).filter(Boolean).slice(0,80);
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
async function publishGrants(auth,grants){
 if(!auth?.token)return;
 const list=Object.values(grants).map(g=>({tabId:g.tabId,grantId:g.grantId,url:g.url,title:g.title,scope:g.scope,preciseCursor:g.preciseCursor===true}));
 await api('/extension/grants',{method:'POST',token:auth.token,data:{grants:list}});
}
async function grantActive(scope='read'){
 if(scope!=='read'&&scope!=='interact')throw new Error('INVALID_SCOPE');
 const t=await activeTab();if(!t)throw new Error('Open an ordinary webpage');
 const s=await state();if(!s.auth)throw new Error('Pair LUCH Companion first');
 // A real user must click this extension in THIS tab to obtain activeTab access.
 await chrome.scripting.executeScript({target:{tabId:t.id},func:()=>Boolean(document.body)});
 const existing=s.grants[t.id];
 if(scope==='interact'&&!existing)throw new Error('APPROVE_READ_FIRST');
 const g=existing?{...existing,scope}:{
  tabId:t.id,grantId:makeNonce(),url:t.url,origin:originOf(t.url),title:safeTitle(t.title),scope,preciseCursor:false
 };
 if(existing&&existing.origin!==originOf(t.url))throw new Error('ORIGIN_CHANGED_REAPPROVAL_REQUIRED');
 const previous=existing;
 s.grants[t.id]=g;
 try{await publishGrants(s.auth,s.grants);await setGrants(s.grants)}
 catch(e){if(previous)s.grants[t.id]=previous;else delete s.grants[t.id];await setGrants(s.grants);throw e}
 return {message:scope==='interact'?'Interactions allowed on this tab until you revoke':'This tab is available to LUCH until you revoke'};
}
async function revokeActive(){
 const s=await state(),t=await activeTab();
 if(t)delete s.grants[t.id];
 await setGrants(s.grants);await publishGrants(s.auth,s.grants);
 return {message:'Sharing stopped for this tab'};
}
async function disconnect(){
 const s=await state();try{if(s.auth)await api('/extension/disconnect',{method:'POST',token:s.auth.token})}catch{}
 await Promise.all([chrome.storage.local.remove('auth'),chrome.storage.session.remove('grants'),chrome.storage.session.remove('ownedTabs'),chrome.storage.session.remove('tabOverviewSharing')]);
 await setGrants({});
 return {message:'Browser disconnected from LUCH'};
}
async function performJob(job,grants,owned){
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
   const r=await chrome.scripting.executeScript({target:{tabId:g.tabId},func:self.luchDomExecutor,args:[{op,args}]});
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
   if(!owned.includes(g.tabId))throw new Error('ONLY_EXTENSION_CREATED_TABS_CAN_CLOSE');
   await chrome.tabs.remove(g.tabId);return {ok:true,data:{closed:true}};
  }
  if(op==='new_tab'||op==='new_window'){
   const url=cleanUrl(args.url);
   if(op==='new_tab'){const added=await chrome.tabs.create({url,active:false});await chrome.storage.session.set({ownedTabs:[...owned,added.id]});return {ok:true,data:{opened:true,tabId:added.id,requiresApproval:true}}}
   const w=await chrome.windows.create({url,focused:false});return {ok:true,data:{opened:true,windowId:w.id,requiresApproval:true}};
  }
  if(op==='window_set'){
   const values={};for(const k of ['width','height','left','top']){if(args[k]!==undefined){
    const v=Number(args[k]);if(!Number.isInteger(v)||Math.abs(v)>5000||(k==='width'||k==='height')&&v<200)throw new Error('INVALID_WINDOW_RECT');values[k]=v;
   }}if(!Object.keys(values).length)throw new Error('WINDOW_RECT_REQUIRED');
   await chrome.windows.update(t.windowId,values);return {ok:true,data:{updated:true}};
  }
 }catch(e){return {ok:false,error:String(e.message||e).slice(0,100)}}
 return {ok:false,error:'OPERATION_NOT_IMPLEMENTED'};
}
async function poll(){
 if(working)return;working=true;
 try{const s=await state();if(!s.auth?.token)return;
  const grants=await prune(s.grants);
  // Also heartbeat grants; browser close/restart ends them, no arbitrary TTL.
  await publishGrants(s.auth,grants);
  await publishTabOverview(s.auth);
  const tasks=await api('/extension/jobs',{token:s.auth.token});
  for(const job of (tasks.jobs||[]).slice(0,3)){
   let result;try{result=await performJob(job,grants,s.owned)}catch(e){result={ok:false,error:String(e.message||e).slice(0,100)}}
   await api('/extension/result',{method:'POST',token:s.auth.token,data:{jobId:job.id,result}});
  }
 }catch{}finally{working=false}
}
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
 if(sender.id!==chrome.runtime.id){respond({ok:false,error:'UNTRUSTED_SENDER'});return false}
 (async()=>{
  if(msg.op==='capabilities')return {ok:true,read:READ_OPS,interact:INTERACT_OPS,sessionScoped:true};
  if(msg.op==='status'){
   const s=await state(),t=await activeTab();await prune(s.grants);
   let connected=!!s.auth;
   if(connected){try{const health=await api('/health',{token:s.auth.token});connected=!!health.paired;if(!connected)throw new Error('COMPANION_NOT_PAIRED')}catch{connected=false;await Promise.all([chrome.storage.local.remove('auth'),chrome.storage.session.remove('grants'),chrome.storage.session.remove('tabOverviewSharing')]);await setGrants({})}}
   const g=connected&&t&&s.grants[t.id];
   const hasTabs=await chrome.permissions.contains({permissions:['tabs']});
   const hasDebugger=await chrome.permissions.contains({permissions:['debugger']});
   const sharing=connected&&(await chrome.storage.session.get('tabOverviewSharing')).tabOverviewSharing===true&&hasTabs;
   return {ok:true,connected,tab:t&&{title:safeTitle(t.title),url:t.url},granted:!!g,scope:g?.scope||null,
    preciseCursor:!!g?.preciseCursor&&hasDebugger,tabOverviewPermission:hasTabs,tabOverviewSharing:sharing,
    grantedCount:connected?Object.keys(s.grants).length:0,sessionScoped:true};
  }
  if(msg.op==='pair'){
   if(!/^\d{8}$/.test(msg.code||''))throw new Error('Enter your eight-digit pairing code');
   const r=await api('/pair',{method:'POST',data:{code:msg.code}});
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
   try{await publishGrants(s.auth,s.grants);await setGrants(s.grants)}
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
 await setGrants(s.grants);try{await publishGrants(s.auth,s.grants)}catch{}
});
chrome.tabs.onRemoved.addListener(async id=>{
 const s=await state();if(s.grants[id]){delete s.grants[id];await setGrants(s.grants);try{await publishGrants(s.auth,s.grants)}catch{}}
 if(s.owned.includes(id))await chrome.storage.session.set({ownedTabs:s.owned.filter(x=>x!==id)});
});
chrome.alarms.create('luch-poll',{periodInMinutes:0.5});
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='luch-poll')poll()});
setInterval(poll,5000);

chrome.permissions.onRemoved.addListener(async permissions=>{
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
