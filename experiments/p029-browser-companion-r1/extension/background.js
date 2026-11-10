'use strict';
// The remote side NEVER supplies a script. Only a fixed, bounded DOM text reader is used.
const BASE='http://127.0.0.1:9248';
const TTL_MS=15*60*1000;
let working=false;
const now=()=>Date.now();
const originOf=url=>{try{const u=new URL(url);return (u.protocol==='http:'||u.protocol==='https:')?u.origin:null}catch{return null}};
const safeTitle=t=>String(t||'').slice(0,180);
const makeNonce=()=>Array.from(crypto.getRandomValues(new Uint8Array(12)),v=>v.toString(16).padStart(2,'0')).join('');
async function state(){let [auth,record]=await Promise.all([chrome.storage.local.get('auth'),chrome.storage.session.get('grants')]);return {auth:auth.auth||null,grants:record.grants||{}};}
async function setGrants(grants){await chrome.storage.session.set({grants});}
async function api(path,{method='GET',data,token}={}){
 const headers={'Accept':'application/json'};
 if(token)headers.Authorization=`Bearer ${token}`;
 if(data!==undefined)headers['Content-Type']='application/json';
 const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),7000);
 try{const r=await fetch(BASE+path,{method,headers,body:data!==undefined?JSON.stringify(data):undefined,signal:ctl.signal,cache:'no-store'});
  const payload=await r.json();if(!r.ok||!payload.ok)throw new Error(payload.error||`HTTP_${r.status}`);return payload;
 }finally{clearTimeout(timer)}
}
async function activeTab(){const t=(await chrome.tabs.query({active:true,currentWindow:true}))[0];if(!t||!originOf(t.url))return null;return t;}
async function prune(grants){
 let changed=false;
 for(const [id,g] of Object.entries(grants)){
  if(g.expiresAt<=now()){delete grants[id];changed=true;continue;}
  try{const t=await chrome.tabs.get(Number(id));if(originOf(t.url)!==g.origin){delete grants[id];changed=true}else if(t.url!==g.url){g.url=t.url;g.title=safeTitle(t.title);changed=true}}catch{delete grants[id];changed=true}
 }
 if(changed)await setGrants(grants);
 return grants;
}
async function publishGrants(auth,grants){
 if(!auth?.token)return;
 const list=Object.values(grants).map(g=>({tabId:g.tabId,grantId:g.grantId,url:g.url,title:g.title,expiresAt:g.expiresAt}));
 await api('/extension/grants',{method:'POST',token:auth.token,data:{grants:list}});
}
async function grantActive(){
 const t=await activeTab();if(!t)throw new Error('Откройте обычную веб-страницу');
 // activeTab has been granted by the user pressing the extension action.
 await chrome.scripting.executeScript({target:{tabId:t.id},func:()=>Boolean(document.body)});
 const s=await state();if(!s.auth)throw new Error('Сначала подключите LUCH');
 const g={tabId:t.id,grantId:makeNonce(),url:t.url,origin:originOf(t.url),title:safeTitle(t.title),expiresAt:now()+TTL_MS};
 s.grants[t.id]=g;await setGrants(s.grants);await publishGrants(s.auth,s.grants);
 return {message:'Доступ только к этой вкладке разрешён на 15 минут'};
}
async function revokeActive(){const s=await state();const t=await activeTab();if(t)delete s.grants[t.id];await setGrants(s.grants);await publishGrants(s.auth,s.grants);return{message:'Доступ отозван'};}
async function disconnect(){const s=await state();try{if(s.auth)await api('/extension/disconnect',{method:'POST',token:s.auth.token})}catch{}
 await Promise.all([chrome.storage.local.remove('auth'),chrome.storage.session.remove('grants')]);return{message:'Браузер отключён от LUCH'};}
function readDomText(){
 const body=document.body;const text=String(body?.innerText||'').slice(0,65536);
 return {title:document.title.slice(0,180),url:location.href,text};
}
async function performJob(job,grants){
 if(job?.kind!=='read_text')return {ok:false,error:'ACTION_NOT_ALLOWED'};
 const g=Object.values(grants).find(x=>`ext:${x.tabId}:${x.grantId}`===job.targetId);
 if(!g||g.expiresAt<=now())return{ok:false,error:'TAB_GRANT_EXPIRED'};
 const t=await chrome.tabs.get(g.tabId);if(originOf(t.url)!==g.origin)return{ok:false,error:'TAB_ORIGIN_CHANGED'};
 const result=await chrome.scripting.executeScript({target:{tabId:g.tabId},func:readDomText});
 const value=result?.[0]?.result;if(!value||originOf(value.url)!==g.origin)return{ok:false,error:'TAB_CONTENT_MISMATCH'};
 return {ok:true,text:String(value.text||'').slice(0,65536),title:safeTitle(value.title),url:value.url};
}
async function poll(){
 if(working)return;working=true;
 try{const s=await state();if(!s.auth?.token)return;const grants=await prune(s.grants);
  await publishGrants(s.auth,grants);
  const tasks=await api('/extension/jobs',{token:s.auth.token});
  for(const job of (tasks.jobs||[]).slice(0,3)){
   let result;try{result=await performJob(job,grants)}catch(e){result={ok:false,error:String(e.message||e).slice(0,100)}}
   await api('/extension/result',{method:'POST',token:s.auth.token,data:{jobId:job.id,result}});
  }
 }catch(e){/* fail closed; do not expose sensitive error text to page */}
 finally{working=false}
}
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
 if(sender.id!==chrome.runtime.id){respond({ok:false,error:'UNTRUSTED_SENDER'});return false;}
 (async()=>{
  if(msg.op==='status'){const s=await state();const t=await activeTab();await prune(s.grants);let connected=!!s.auth;
   if(connected){try{await api('/extension/jobs',{token:s.auth.token})}catch{connected=false;await Promise.all([chrome.storage.local.remove('auth'),chrome.storage.session.remove('grants')]);}}
   const g=connected&&t&&s.grants[t.id];return {ok:true,connected,tab:t&&{title:safeTitle(t.title),url:t.url},granted:!!g,expiresAt:g?.expiresAt};}
  if(msg.op==='pair'){if(!/^\d{8}$/.test(msg.code||''))throw new Error('Введите восьмизначный код');const r=await api('/pair',{method:'POST',data:{code:msg.code}});await chrome.storage.local.set({auth:{token:r.token}});await setGrants({});await poll();return {ok:true,message:'LUCH подключён'};}
  if(msg.op==='grant-active')return {ok:true,...await grantActive()};
  if(msg.op==='revoke-active')return {ok:true,...await revokeActive()};
  if(msg.op==='disconnect')return {ok:true,...await disconnect()};
  throw new Error('UNKNOWN_COMMAND');
 })().then(respond,e=>respond({ok:false,error:String(e.message||e).slice(0,160)}));return true;
});
chrome.tabs.onUpdated.addListener(async(id,change)=>{if(change.url){const s=await state();const g=s.grants[id];if(g){if(originOf(change.url)!==g.origin)delete s.grants[id];else g.url=change.url;await setGrants(s.grants);try{await publishGrants(s.auth,s.grants)}catch{}}}});
chrome.tabs.onRemoved.addListener(async id=>{const s=await state();if(s.grants[id]){delete s.grants[id];await setGrants(s.grants);try{await publishGrants(s.auth,s.grants)}catch{}}});
chrome.alarms.create('luch-poll',{periodInMinutes:0.5});
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='luch-poll')poll()});
// An interval may be paused by Chrome's MV3 lifecycle. The alarm wakes the worker.
setInterval(poll,5000);
