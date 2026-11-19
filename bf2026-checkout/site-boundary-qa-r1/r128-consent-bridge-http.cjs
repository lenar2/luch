'use strict';
/* R128 site-facing challenge bridge.
 * It only issues a short-lived challenge after server-side quote + native
 * CTA mapping + order-field callback configuration all verify. It never
 * creates an order, sends a provider request, or opens a checkout URL.
 */
const crypto=require('node:crypto');
const {COOKIE,SESSION_TTL_SECONDS}=require('./r127-consent-boundary.cjs');
const {EXPECTED,examineSingle}=require('./r123-single-widget-adapter.cjs');
const {resolveSelection,ROUTE_KEYS}=require('./r128-native-cta-map.cjs');
const PREFIX='/api/checkout/consent/';
const MAX_BODY=2048;
function fail(code){const e=Error(code);e.code=code;throw e}
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
  if(part.slice(0,i).trim()===name){
   try{return decodeURIComponent(part.slice(i+1).trim())}catch{return null}
  }
 }
 return null;
}
async function readJson(req){
 if((req.headers['content-type']||'').split(';')[0].trim()!=='application/json')
  fail('R128_JSON_REQUIRED');
 let size=0,parts=[];
 for await(const chunk of req){
  size+=chunk.length;
  if(size>MAX_BODY)fail('R128_BODY_TOO_LARGE');
  parts.push(chunk);
 }
 try{
  const v=JSON.parse(Buffer.concat(parts).toString('utf8'));
  if(!v||typeof v!=='object'||Array.isArray(v))fail('R128_SELECTION_SHAPE_INVALID');
  return v;
 }catch(e){if(e.code)throw e;fail('R128_JSON_INVALID')}
}
function exactKeys(obj,keys){
 return !!obj&&typeof obj==='object'&&!Array.isArray(obj)&&
  Object.keys(obj).sort().join('|')===[...keys].sort().join('|');
}
function validateSelection(body,{quoteFn,checkoutKey,stage}={}){
 if(!body||typeof body!=='object'||Array.isArray(body)||
  body.kind!=='single'||!Number.isInteger(body.lot))
  fail('R128_INDIVIDUAL_SINGLE_SELECTION_REQUIRED');
 if(body.lot===9){
  if(!exactKeys(body,['kind','lot','variant'])||
   !['1','2'].includes(String(body.variant)))fail('R128_SOURCE_VARIANT_REQUIRED');
 }else if(!exactKeys(body,['kind','lot'])){
  fail('R128_SELECTION_KEYS_INVALID');
 }
 const entry=resolveSelection(body);
 if(!entry||!entry.route_key||entry.not_routable)
  fail('R128_CTA_NOT_IN_APPROVED_SINGLE_ALLOWLIST');
 const expected=EXPECTED[entry.route_key];
 let quote;try{quote=quoteFn(body)}catch{fail('R128_SERVER_QUOTE_REJECTED')}
 if(!expected||!quote||quote.kind!=='single'||quote.count!==1||
  quote.currency!=='RUB'||quote.subtotal_rub!==expected.price||
  quote.total_rub!==expected.price||quote.discount_percent!==0||
  quote.pricing_version!==stage.catalog?.pricing_version||
  !Array.isArray(quote.items)||quote.items.length!==1||
  quote.items[0].site_lot!==entry.site_lot||
  (quote.items[0].variant??null)!==(entry.variant??null)||
  checkoutKey(quote)!==entry.route_key)
  fail('R128_SERVER_QUOTE_NATIVE_CTA_MISMATCH');
 const mapping=examineSingle({catalog:stage.catalog,registry:stage.registry,key:entry.route_key});
 if(!['MAPPING_COMPLETE_QA_ONLY','SERVICE_NO_TRAINING_QA_ONLY'].includes(mapping.status)||
  mapping.widget_id!==entry.widget_id||mapping.offer_id!==entry.offer_id||
  mapping.price_rub!==entry.amount_rub)
  fail('R128_NATIVE_CTA_MAPPING_NOT_VERIFIED');
 return Object.freeze({entry,quote,expected});
}
function createConsentBridge({
 boundary,quoteFn,checkoutKey,stage,allowedOrigin,
 orderCallbackReady=false,clock=()=>Date.now(),maxPerMinute=30
}={}){
 if(!boundary||typeof boundary.issueChallenge!=='function'||
  typeof boundary.status!=='function'||typeof quoteFn!=='function'||
  typeof checkoutKey!=='function'||!stage?.stage_only||
  stage.public_release_allowed!==false||
  typeof allowedOrigin!=='string'||!/^https:\/\/[a-z0-9.-]+$/.test(allowedOrigin))
  fail('R128_STAGE_CONSENT_BRIDGE_DEPENDENCIES_REQUIRED');
 const rate=new Map();
 function rateAllowed(req){
  const ip=String(req.socket?.remoteAddress||'unknown').slice(0,100);
  const key=crypto.createHash('sha256').update(ip).digest('hex');
  const now=clock(),row=rate.get(key)||{started:now,count:0};
  if(now-row.started>=60000){row.started=now;row.count=0}
  row.count++;rate.set(key,row);
  if(rate.size>2048)for(const [k,v] of rate)if(now-v.started>=60000)rate.delete(k);
  return row.count<=maxPerMinute;
 }
 function originAllowed(req){return req.headers.origin===allowedOrigin}
 async function handle(req,res,path){
  if(!path.startsWith(PREFIX))return send(res,404,{ok:false,code:'NOT_FOUND'});
  if(req.headers.origin!==undefined&&req.headers.origin!==allowedOrigin)
   return send(res,403,{ok:false,code:'R128_ORIGIN_DENIED'});
  if(req.method==='POST'&&!originAllowed(req))
   return send(res,403,{ok:false,code:'R128_ORIGIN_REQUIRED'});
  if(!rateAllowed(req))return send(res,429,{ok:false,code:'R128_RATE_LIMITED'});
  const action=path.slice(PREFIX.length);
  try{
   const u=new URL(req.url,'http://localhost');
   if(u.searchParams.size!==0)return send(res,404,{ok:false,code:'NOT_FOUND'});
   if(action==='status'&&req.method==='GET'){
    const provider=await boundary.status();
    return send(res,200,{ok:true,route:'R128_EXISTING_NATIVE_CTA_CONSENT_BRIDGE',
     native_widget_count:12,individual_route_count:ROUTE_KEYS.length,
     qa_only_native_widget_count:2,
     order_callback_contract_verified:orderCallbackReady===true,
     callback_secret_configured:provider.callback_shared_secret_configured===true,
     challenge_issuance_enabled:orderCallbackReady===true&&
      provider.callback_shared_secret_configured===true&&provider.approved_offer_revisions>0,
     approved_offer_revisions:provider.approved_offer_revisions,
     client_field_22204810_accepted_as_proof:false,
     client_checkbox_trusted:false,provider_signature_verified:false,
     provider_native_consent_negative_test_verified:false,
     public_release_allowed:false});
   }
   if(action==='session'&&req.method==='POST'){
    if(req.headers['content-type']!==undefined||
     Number(req.headers['content-length']||0)>0||req.headers['transfer-encoding'])
     return send(res,415,{ok:false,code:'R128_SESSION_BODY_FORBIDDEN'});
    const token=crypto.randomBytes(32).toString('base64url');
    return send(res,201,{ok:true,session_created:true,
     session_ttl_seconds:SESSION_TTL_SECONDS,token_returned:false,
     client_checkbox_trusted:false,public_release_allowed:false},{
      'set-cookie':COOKIE+'='+encodeURIComponent(token)+
       '; Path=/; Max-Age='+SESSION_TTL_SECONDS+'; Secure; HttpOnly; SameSite=Strict'
    });
   }
   if(action==='challenge'&&req.method==='POST'){
    const sessionToken=parseCookie(req.headers.cookie,COOKIE);
    if(!sessionToken)return send(res,401,{ok:false,code:'R128_HTTP_ONLY_SESSION_REQUIRED',
     public_release_allowed:false});
    const body=await readJson(req);
    const validated=validateSelection(body,{quoteFn,checkoutKey,stage});
    if(orderCallbackReady!==true||boundary.callbackSecretConfigured!==true)
     return send(res,503,{ok:false,code:'R128_ORDER_CALLBACK_CONTRACT_NOT_VERIFIED',
      route_key:validated.entry.route_key,offer_id:validated.entry.offer_id,
      widget_id:validated.entry.widget_id,client_guard_block_id:validated.entry.client_guard_block_id,
      order_field_ids:null,provider_consent_verified:false,client_guard_is_provider_proof:false,
      public_release_allowed:false});
    const challenge=await boundary.issueChallenge({
     routeKey:validated.entry.route_key,sessionToken
    });
    return send(res,201,{ok:true,...challenge,
     native_cta:{widget_id:validated.entry.widget_id,
      offer_id:validated.entry.offer_id,amount_rub:validated.entry.amount_rub,
      client_guard_block_id:validated.entry.client_guard_block_id,
      product_training_pairs:validated.entry.product_training_pairs},
     client_guard_is_provider_proof:false,
     order_fields_native_readback_verified:true,
     public_release_allowed:false});
   }
   return send(res,404,{ok:false,code:'NOT_FOUND',public_release_allowed:false});
  }catch(e){
   const code=typeof e?.code==='string'&&/^R128_[A-Z0-9_]+$/.test(e.code)?e.code:
    typeof e?.code==='string'&&/^R127_[A-Z0-9_]+$/.test(e.code)?e.code:'R128_FAIL_CLOSED';
   const status=/ORIGIN|REQUIRED/.test(code)?(code==='R128_HTTP_ONLY_SESSION_REQUIRED'?401:403):
    /NOT_IN_APPROVED/.test(code)?404:
    /CALLBACK_CONTRACT|OFFER_REVISION|SECRET|VERIFIER/.test(code)?503:
    /MISMATCH|CONFLICT/.test(code)?409:422;
   return send(res,status,{ok:false,code,provider_consent_verified:false,
    client_checkbox_trusted:false,public_release_allowed:false});
  }
 }
 return handle;
}
module.exports={PREFIX,MAX_BODY,validateSelection,createConsentBridge};
