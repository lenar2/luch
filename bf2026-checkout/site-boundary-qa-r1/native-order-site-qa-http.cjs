'use strict';
/**
 * BF2026 R112 QA-only site HTTP adapter. No provider write, payment or grant.
 * Site engineer mounts it behind existing private QA gate, NOT checkout/start.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const {createAdapter}=require('../dynamic-adapter-r1/adapter.cjs');
const {prepareTrustedOrderPayload,verifyTrustedOrderPayload}=require('./native-order-site-integration.cjs');
const {readNativePublicWidget}=require('./native-getcourse-widget-driver.cjs');

const PREFIX='/api/checkout/_qa/native-order/';
function fail(code){const e=new Error(code);e.code=code;throw e}
function respond(res,status,body){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store, private','Pragma':'no-cache','X-Content-Type-Options':'nosniff',
  'X-Robots-Tag':'noindex,nofollow','Referrer-Policy':'no-referrer'});
 res.end(JSON.stringify(body));
}
async function readJson(req,maxBytes=8192){
 if(String(req.headers['content-type']||'').split(';')[0].trim()!=='application/json')fail('CONTENT_TYPE_REQUIRED');
 let size=0,parts=[];
 for await(const part of req){
  size+=part.length;
  if(size>maxBytes)fail('REQUEST_TOO_LARGE');
  parts.push(part);
 }
 let input;try{input=JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{fail('BAD_JSON')}
 if(!input||typeof input!=='object'||Array.isArray(input))fail('BAD_JSON_OBJECT');
 return input;
}
function strictInput(input,allowed){
 const keys=Object.keys(input).sort();
 if(keys.join('|')!==[...allowed].sort().join('|'))fail('CLIENT_OVERRIDE_OR_MISSING_FIELD');
}
function getNativeMapping(){
 const base=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../dynamic-adapter-r1/native-mapping-observed.json'),'utf8'));
 const overlay=JSON.parse(fs.readFileSync(path.resolve(__dirname,'native-mapping-live-overlay.json'),'utf8'));
 return {...base.entries,...overlay.entries};
}
function createSiteQARouter({quoteFn,manifest,qaAuthorize,hmacKeyHex,productionGuard}={}){
 if(typeof qaAuthorize!=='function'||typeof quoteFn!=='function'||!manifest)fail('TRUSTED_SITE_ROUTER_CONFIG_REQUIRED');
 if(typeof hmacKeyHex!=='string'||!/^[a-f0-9]{64,}$/.test(hmacKeyHex)||hmacKeyHex.length%2!==0)
  fail('PERSISTENT_QA_HMAC_KEY_REQUIRED');
 if(productionGuard===true)fail('QA_NATIVE_ORDER_ROUTE_PRODUCTION_WRITE_FORBIDDEN');
 const secret=Buffer.from(hmacKeyHex,'hex');
 const adapter=createAdapter({quoteFn,manifest,observedMapping:getNativeMapping()});
 return async function(req,res,routePath){
  // Preserve production anonymity: reject unapproved requests BEFORE reading body.
  if(!qaAuthorize(req)){respond(res,404,{ok:false,code:'NOT_FOUND'});return true}
  if(!routePath.startsWith(PREFIX)){respond(res,404,{ok:false,code:'NOT_FOUND'});return true}
  if(req.method!=='POST'){respond(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'});return true}
  if(req.headers.origin&&req.headers.origin!=='https://wf.tati-lar.ru'){
   respond(res,403,{ok:false,code:'ORIGIN_DENIED'});return true
  }
  try{
   const input=await readJson(req);
   const action=routePath.slice(PREFIX.length);
   if(action==='provider-check'){
    strictInput(input,['kind','items']);
    const plan=adapter.plan({kind:input.kind,items:input.items});
    if(plan.selection_key!=='set:rejection_program|union'||plan.quote.total_rub!==11690||
       plan.ready_for_native_binding!==true)fail('UNVERIFIED_NATIVE_PAIR_SELECTION');
    const native=await readNativePublicWidget();
    respond(res,200,{ok:true,provider:native.provider,
     method:native.provider_order_method,
     native_widget_id:native.source_widget_id,
     action_id:native.form_action_id,
     native_preview_url:native.qa_preview_url,
     native_offer_positions:native.offer_positions,
     native_base_total_rub:native.native_base_total_rub,
    will_create_paid_deal_field_value:native.will_create_paid_deal_field_value,
     approved_total_rub:plan.quote.total_rub,
     native_order_verified:native.native_unpaid_order_readback_verified,
     checkout_ready:false,checkout_url:null,
     code:native.status,
     public_html_sha256:native.html_sha256,
     safety:native.safe_transport});
    return true;
   }
   if(action==='prepare'){
    strictInput(input,['kind','items','checkout_idempotency_key']);
    const {checkout_idempotency_key:key,kind,items}=input;
    const x=prepareTrustedOrderPayload({adapter,input:{kind,items},secret,checkoutIdempotencyKey:key});
    respond(res,200,{ok:true,schema:'bf2026.qa.native.order.prepare.r1',
     signed_order_payload:x.signed_order_payload,checkout_idempotency_key:key,
     payload_sha256:x.payload_sha256,quote:x.quote,provider_order_status:'NOT_CREATED',
     checkout_url:null,payment_link:null,route_enabled:false});
    return true;
   }
   if(action==='verify'||action==='start'){
    strictInput(input,['signed_order_payload']);
    const x=verifyTrustedOrderPayload({adapter,token:input.signed_order_payload,secret});
    if(action==='start'){
     respond(res,503,{ok:false,code:'NATIVE_PROVIDER_CAPABILITY_HOLD',
      selection_key:x.plan.selection_key,amount_due_rub:11690,
      provider_order_status:'NOT_CREATED',checkout_url:null,payment_link:null,
      order_created:false,route_enabled:false});
     return true;
    }
    respond(res,200,{ok:true,selection_key:x.payload.selection_key,
     quote:{currency:'RUB',subtotal_rub:12990,discount_rub:1300,total_rub:11690},
     lines:x.payload.lines,grants:x.payload.lines.map(l=>l.grant),
     consent_requirements:x.payload.consent_requirements,
     provider_order_status:'NOT_CREATED',checkout_url:null,route_enabled:false});
    return true;
   }
   respond(res,404,{ok:false,code:'NOT_FOUND'});return true;
  }catch(e){
   respond(res,['CONTENT_TYPE_REQUIRED'].includes(e.code)?415:String(e.code||'').startsWith('LIVE_GETCOURSE_')?503:422,
    {ok:false,code:e.code||'INVALID_NATIVE_ORDER_REQUEST',checkout_url:null,route_enabled:false});
   return true;
  }
 };
}
module.exports={createSiteQARouter,PREFIX};
