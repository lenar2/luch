/**
 * LUCH Browser Companion R2 isolated native tab adapter.
 *
 * LOCAL BRIDGE FEATURE-GATE ONLY: not deployed, not OAuth/tenant authorized.
 * The caller must already have been authenticated by LUCH, bound to the right
 * paired device, and explicitly entitled to the browser capability.
 *
 * Never mix extension-granted targets with an isolated CDP automation profile.
 * Never silently fail over a USER_CONSENTED_TAB target to CDP.
 */
import {readFileSync} from 'node:fs';

const DEFAULT_BASE='http://127.0.0.1:9248';
const TARGET=/^ext:(0|[1-9][0-9]*):[a-f0-9]{24}$/;
export class BrowserCompanionError extends Error {
 constructor(code,details='') {super(code);this.name='BrowserCompanionError';this.code=code;this.details=details}
}
function requireLocalUrl(url){
 const parsed=new URL(url);
 if(parsed.protocol!=='http:' || parsed.hostname!=='127.0.0.1' || parsed.username || parsed.password || parsed.pathname!=='/' || parsed.search || parsed.hash)
  throw new BrowserCompanionError('BROKER_ENDPOINT_NOT_LOOPBACK');
 const port=Number(parsed.port||80);if(!(port>0&&port<=65535))throw new BrowserCompanionError('BROKER_ENDPOINT_INVALID');
 return parsed.origin;
}
function requiredSecret(read){
 const value=String(read()||'').trim();
 if(value.length<24)throw new BrowserCompanionError('LOCAL_BRIDGE_CREDENTIAL_MISSING');
 return value;
}
export function makeConsentedTabAdapter({brokerUrl=DEFAULT_BASE,bridgeTokenFile,bridgeTokenProvider,fetchImpl=fetch,timeoutMs=6000}={}){
 const base=requireLocalUrl(brokerUrl);
 if(!bridgeTokenFile&&!bridgeTokenProvider)throw new BrowserCompanionError('LOCAL_BRIDGE_CREDENTIAL_MISSING');
 if(!Number.isInteger(timeoutMs)||timeoutMs<500||timeoutMs>15000)throw new BrowserCompanionError('INVALID_TIMEOUT');
 const getSecret=bridgeTokenProvider||(()=>readFileSync(bridgeTokenFile,'utf8'));
 async function request(path,{method='GET',body}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const r=await fetchImpl(base+path,{method,
    headers:{'x-browser-bridge-token':requiredSecret(getSecret),'accept':'application/json',
     ...(body===undefined?{}:{'content-type':'application/json'})},
    body:body===undefined?undefined:JSON.stringify(body),
    cache:'no-store',redirect:'error',signal:controller.signal});
   const data=await r.json();
   if(r.status===403)throw new BrowserCompanionError(String(data.error||'LOCAL_BRIDGE_AUTH_DENIED').slice(0,96));
   if(!r.ok||!data?.ok)throw new BrowserCompanionError(String(data?.error||'LOCAL_BRIDGE_ERROR').slice(0,96));
   return data;
  }catch(e){
   if(e instanceof BrowserCompanionError)throw e;
   throw new BrowserCompanionError('BROWSER_COMPANION_UNAVAILABLE');
  }finally{clearTimeout(timer)}
 }
 async function listAuthorizedTabs(){
  const v=await request('/v1/tabs');
  if(v.profileScope!=='USER_CONSENTED_TABS_ONLY'||!Array.isArray(v.tabs))
    throw new BrowserCompanionError('WRONG_PROFILE');
  const tabs=v.tabs.filter(t=>t&&typeof t.id==='string'&&TARGET.test(t.id)&&t.profileKind==='USER_CONSENTED_TAB')
    .map(t=>({id:t.id,title:String(t.title||'').slice(0,180),url:String(t.url||'').slice(0,2048),
      type:'page',attached:true,transport:'luch_browser_companion',profileKind:'USER_CONSENTED_TAB',readOnly:true,expiresAt:t.expiresAt}));
  if(!v.nativeSessionAttached)return {ok:true,browser:'chrome',tabs:[],profileScope:'USER_TAB_PERMISSION_REQUIRED',nativeSessionAttached:false,canRead:false};
  return {ok:true,browser:'chrome',tabs,profileScope:'USER_CONSENTED_TABS_ONLY',nativeSessionAttached:true,canRead:true};
 }
 async function readAuthorizedText({targetId,selector='body'}={}){
  if(typeof targetId!=='string'||!TARGET.test(targetId))throw new BrowserCompanionError('WRONG_PROFILE');
  if(selector!=='body')throw new BrowserCompanionError('SELECTOR_NOT_AVAILABLE');
  const listed=await listAuthorizedTabs();
  if(!listed.nativeSessionAttached||!listed.tabs.some(t=>t.id===targetId))
   throw new BrowserCompanionError('USER_TAB_PERMISSION_REQUIRED');
  const result=await request('/v1/text',{method:'POST',body:{targetId,selector:'body'}});
  return {ok:true,text:String(result.text||'').slice(0,65536),source:'USER_CONSENTED_TAB',targetId};
 }
 return Object.freeze({listAuthorizedTabs,readAuthorizedText});
}
