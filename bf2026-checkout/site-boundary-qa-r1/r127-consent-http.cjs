'use strict';
/* R127 HTTP adapter: QA-only challenge/inspect plus authenticated documented
 * GetCourse process callback. No endpoint accepts a browser consent boolean.
 */
const crypto=require('node:crypto');
const {COOKIE,SESSION_TTL_SECONDS,ALLOWED_KEYS}=require('./r127-consent-boundary.cjs');
const PREFIX='/api/checkout/_qa/consent-boundary/';
const CALLBACK='/api/checkout/_provider/getcourse/order-created';
const MAX_BODY=8192;
const ALLOWED_ORIGINS=new Set(['https://wf.tati-lar.ru','http://127.0.0.1:18774']);
function send(res,status,data,extra={}){
 if(res.headersSent)return;
 res.writeHead(status,{'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store, private','pragma':'no-cache',
  'x-content-type-options':'nosniff','x-robots-tag':'noindex,nofollow',
  'referrer-policy':'no-referrer',...extra});
 res.end(JSON.stringify(data));
}
function parseCookie(header,name){
 if(typeof header!=='string')return null;
 for(const part of header.split(';')){
  const i=part.indexOf('=');
  if(i<0)continue;
  if(part.slice(0,i).trim()===name)return decodeURIComponent(part.slice(i+1).trim());
 }
 return null;
}
async function readJson(req){
 if((req.headers['content-type']||'').split(';')[0].trim()!=='application/json')
  throw Object.assign(Error('R127_JSON_REQUIRED'),{code:'R127_JSON_REQUIRED'});
 let size=0,parts=[];
 for await(const chunk of req){
  size+=chunk.length;
  if(size>MAX_BODY)throw Object.assign(Error('R127_BODY_TOO_LARGE'),{code:'R127_BODY_TOO_LARGE'});
  parts.push(chunk);
 }
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}
 catch{throw Object.assign(Error('R127_JSON_INVALID'),{code:'R127_JSON_INVALID'})}
}
function statusFor(code){
 if(/AUTH_FAILED|UNAUTHORIZED/.test(code))return 401;
 if(/MISMATCH|CONFLICT|ALREADY_BOUND|ALREADY_CONSUMED|OUTSIDE_CHALLENGE_WINDOW/.test(code))return 409;
 if(/NOT_FOUND|UNKNOWN_OR_REPLAYED/.test(code))return 404;
 if(/REVISION_NOT_OWNER_VERIFIED|SECRET|VERIFIER|PROVIDER_NATIVE_CONSENT/.test(code))return 503;
 return 422;
}
function createConsentHttp({boundary,qaAuthorized}={}){
 if(!boundary||typeof boundary.status!=='function'||
  typeof boundary.issueChallenge!=='function'||
  typeof boundary.receiveProviderOrderCallback!=='function'||
  typeof boundary.inspect!=='function'||typeof qaAuthorized!=='function')
  throw Error('R127_HTTP_DEPENDENCIES_REQUIRED');
 return async function consentHttp(req,res,path){
  try{
   if(path===CALLBACK){
    if(req.method!=='POST')return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED',public_release_allowed:false});
    if(req.headers.origin!==undefined)return send(res,403,{ok:false,code:'PROVIDER_CALLBACK_BROWSER_ORIGIN_DENIED',public_release_allowed:false});
    if(!boundary.callbackSecretConfigured)return send(res,503,{
     ok:false,state:'HOLD_PROVIDER_CALLBACK_SECRET_NOT_CONFIGURED',
     provider_consent_verified:false,provider_signature_verified:false,
     public_release_allowed:false});
    const authorization=String(req.headers.authorization||'');
    if(!authorization.startsWith('Bearer ')||authorization.length>1100)
     return send(res,401,{ok:false,code:'R127_PROVIDER_CALLBACK_AUTH_FAILED',public_release_allowed:false});
    const body=await readJson(req);
    const result=await boundary.receiveProviderOrderCallback({
     authorization:authorization.slice(7),body
    });
    return send(res,result.duplicate?200:202,{ok:true,...result});
   }
   if(!path.startsWith(PREFIX)||!qaAuthorized(req))
    return send(res,404,{ok:false,code:'NOT_FOUND',public_release_allowed:false});
   if(req.headers.origin!==undefined&&!ALLOWED_ORIGINS.has(req.headers.origin))
    return send(res,403,{ok:false,code:'ORIGIN_DENIED',public_release_allowed:false});
   const action=path.slice(PREFIX.length);
   if(action==='status'&&req.method==='GET'){
    const s=await boundary.status();return send(res,s.postgres_ready?200:503,{ok:true,...s});
   }
   if(action==='session'&&req.method==='POST'){
    if(req.headers['content-type']!==undefined)
     return send(res,415,{ok:false,code:'R127_SESSION_BODY_FORBIDDEN',public_release_allowed:false});
    const token=crypto.randomBytes(32).toString('base64url');
    return send(res,201,{ok:true,session_created:true,
     session_ttl_seconds:SESSION_TTL_SECONDS,client_checkbox_trusted:false,
     public_release_allowed:false},{
      'set-cookie':COOKIE+'='+encodeURIComponent(token)+
       '; Path=/; Max-Age='+SESSION_TTL_SECONDS+'; Secure; HttpOnly; SameSite=Strict'
     });
   }
   if(action==='challenge'&&req.method==='POST'){
    const u=new URL(req.url,'http://localhost');
    if(u.searchParams.size!==0)return send(res,404,{ok:false,code:'NOT_FOUND'});
    const sessionToken=parseCookie(req.headers.cookie,COOKIE);
    const body=await readJson(req);
    if(!body||typeof body!=='object'||Array.isArray(body)||
     Object.keys(body).sort().join('|')!=='route_key')
     return send(res,422,{ok:false,code:'R127_CHALLENGE_REQUEST_SHAPE_INVALID',public_release_allowed:false});
    const challenge=await boundary.issueChallenge({routeKey:body.route_key,sessionToken});
    return send(res,201,{ok:true,...challenge});
   }
   if(action==='inspect'&&req.method==='GET'){
    const u=new URL(req.url,'http://localhost');
    if(u.searchParams.size!==1||!u.searchParams.has('nonce'))
     return send(res,422,{ok:false,code:'R127_INSPECT_NONCE_REQUIRED'});
    const result=await boundary.inspect({nonce:u.searchParams.get('nonce')});
    return send(res,200,{ok:true,...result});
   }
   return send(res,404,{ok:false,code:'NOT_FOUND',public_release_allowed:false});
  }catch(e){
   const code=typeof e?.code==='string'&&/^R127_[A-Z0-9_]+$/.test(e.code)?e.code:'R127_INTERNAL_FAIL_CLOSED';
   return send(res,statusFor(code),{ok:false,code,provider_consent_verified:false,
    provider_signature_verified:false,public_release_allowed:false});
  }
 };
}
module.exports={PREFIX,CALLBACK,MAX_BODY,createConsentHttp};
