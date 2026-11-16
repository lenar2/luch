
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createBroker} from './broker/server.mjs';
const origin='chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const foreign='chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const token=crypto.randomBytes(32).toString('hex'),pair='73519284';
let now=Date.now();
const app=createBroker({bridgeToken:token,pairingCode:pair,port:9259,clock:()=>now});
const results=[];
const check=(name,ok,metadata={})=>{assert(ok,name);results.push(name);console.log('PASS',name,JSON.stringify(metadata))};
const req=async(route,method='GET',body,headers={})=>{
 const r=await fetch('http://127.0.0.1:9259'+route,{
  method,headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...headers},
  body:body!==undefined?JSON.stringify(body):undefined
 });
 let v;try{v=await r.json()}catch{v={}};
 return{status:r.status,v};
};
try{
 await app.listen();
 const noOrigin=await req('/pair','POST',{code:pair});
 check('pair_without_browser_extension_origin_denied',noOrigin.status===403);
 const malicious=await req('/pair','POST',{code:pair},{origin:'https://bad.example'});
 check('pair_foreign_web_origin_denied',malicious.status===403);
 const wrong=await req('/pair','POST',{code:'00000000'},{origin});
 check('pair_wrong_code_denied',wrong.status===403);
 const success=await req('/pair','POST',{code:pair},{origin});
 check('pair_real_extension_origin_success',success.status===200&&typeof success.v.token==='string'&&success.v.token.length>30);
 const session=success.v.token;
 const replay=await req('/pair','POST',{code:pair},{origin});
 check('pairing_code_single_use',replay.status===403);
 const bAuth={'x-browser-bridge-token':token};
 const fakeBridge=await req('/v1/tabs','GET',undefined,{'x-browser-bridge-token':'invalid'});
 check('bridge_token_required',fakeBridge.status===403);
 const tabs=await req('/v1/tabs','GET',undefined,bAuth);
 check('paired_no_grants_no_tabs',tabs.status===200&&tabs.v.tabs.length===0);
 const denyGet=await req('/extension/jobs','GET',undefined,{authorization:'Bearer '+session,origin:foreign});
 check('foreign_extension_origin_denied_even_with_session',denyGet.status===403);
 const denyPost=await req('/extension/grants','POST',{grants:[]},{authorization:'Bearer '+session,origin:foreign});
 check('foreign_extension_post_denied',denyPost.status===403);
 const legitGet=await req('/extension/jobs','GET',undefined,{authorization:'Bearer '+session});
 check('service_worker_originless_get_allowed_with_secret',legitGet.status===200);
 const noSecret=await req('/extension/jobs','GET',undefined,{origin});
 check('origin_alone_not_authorization',noSecret.status===403);
 const invalid=await req('/extension/grants','POST',{grants:[{tabId:9,grantId:'a'.repeat(24),url:'chrome://extensions',title:'Hidden'}]},{authorization:'Bearer '+session,origin});
 check('forbidden_scheme_grant_rejected',invalid.status===400);
 const fakeTarget=await req('/v1/text','POST',{targetId:'ext:3:'+('a'.repeat(24))},bAuth);
 check('ungranted_read_rejected',fakeTarget.status===403);
 const grant=await req('/extension/grants','POST',{grants:[{tabId:9,grantId:'a'.repeat(24),url:'https://example.org/page',title:'Test'}]},{authorization:'Bearer '+session,origin});
 check('valid_grant_published',grant.status===200);
 now+=75_000;
 const still=await req('/v1/tabs','GET',undefined,bAuth);
 check('no_arbitrary_15_min_expiry',still.status===200&&still.v.tabs.length===1);
 now+=20*60_000;
 const inactive=await req('/v1/tabs','GET',undefined,bAuth);
 check('inactive_broker_session_suspended',inactive.status===200&&inactive.v.tabs.length===0);
 const inactiveRead=await req('/v1/text','POST',{targetId:'ext:9:'+('a'.repeat(24))},bAuth);
 check('inactive_session_read_denied',inactiveRead.status===403);
 const heartbeat=await req('/extension/jobs','GET',undefined,{authorization:'Bearer '+session,origin});
 check('authorized_extension_heartbeat_resumes',heartbeat.status===200);
 const resumed=await req('/v1/tabs','GET',undefined,bAuth);
 check('session_grant_survives_interrupted_heartbeat',resumed.status===200&&resumed.v.tabs.length===1);
 const disconnect=await req('/extension/disconnect','POST',{}, {authorization:'Bearer '+session,origin});
 check('disconnect_revokes_session',disconnect.status===200);
 const after=await req('/extension/jobs','GET',undefined,{authorization:'Bearer '+session});
 check('reused_disconnected_secret_denied',after.status===403);
 console.log('FINAL',results.length,'SECURITY_NEGATIVE_PASS');
}catch(e){console.error('SECURITY_QA_FAIL',e.stack||e);process.exitCode=1}
finally{await app.close()}

