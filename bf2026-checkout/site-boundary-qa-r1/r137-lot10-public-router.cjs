'use strict';
/* R137: owner-configured native GetCourse one-order / multi-offer checkout.
 * Uses R130 exact quote, R136 native UNPAID order & order-consent evidence.
 * Public site remains FAIL-CLOSED without a configured coordinator.
 * Does not require a PAID card transaction or receipt for payment URL.
 */
const crypto=require('node:crypto');
const {buildSetImportPlan}=require('./r130-set-lines.cjs');
const {exactPaymentUrl}=require('./r135-set-payment-link.cjs');
const PREFIX='/api/checkout/set/';
const QA='/api/checkout/_qa/set-order/';
const MAX_BODY=4096;
function reply(res,status,obj){
 if(res.headersSent)return;
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store, private','Pragma':'no-cache',
  'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow',
  'Referrer-Policy':'no-referrer'});
 res.end(JSON.stringify(obj));
}
async function bodyJSON(req){
 if((req.headers['content-type']||'').split(';')[0].trim()!=='application/json')
  throw Error('CONTENT_TYPE_REQUIRED');
 let size=0,parts=[];
 for await(const part of req){
  size+=part.length;
  if(size>MAX_BODY)throw Error('R137_REQUEST_TOO_LARGE');
  parts.push(part);
 }
 return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
function exactSelection(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||
   Object.keys(x).some(k=>!['kind','items','source_variant'].includes(k))||
   x.kind!=='set'||!Array.isArray(x.items)||x.items.length<2||x.items.length>5||
   x.items.some(k=>typeof k!=='string'||!['rejection','devaluation','self','guilt','rejection_program','dnv','union','trainer','source'].includes(k))||
   new Set(x.items).size!==x.items.length||
   (x.items.includes('source')?!['1','2'].includes(String(x.source_variant)):x.source_variant!==undefined))
  throw Error('R137_SET_SHAPE_INVALID');
 return x;
}
function planResponse(plan,ready){
 return {ok:true,quote:{
  count:plan.items_count,discount_percent:plan.discount_percent,
  total_rub:plan.desired_order_total_rub,pricing_version:plan.pricing_version
 },order:{
  provider:'GetCourse',mode:'MULTIPLE_OFFERS_SAME_DEAL_NUMBER',
  expected_line_items:plan.lines.map(l=>({
   offer_id:l.offer_id,line_price_rub:l.discounted_line_price_rub,
   product_training_pairs:l.access.map(g=>({
    product_id:g.product_id,training_id:g.training_id,
    after_pay_days:g.access_days_after_pay
   }))
  })),
  expected_payment_total_rub:plan.desired_order_total_rub,
  expected_single_order:true,create_new_offer_count:0
 },status:ready?'GETCOURSE_UNPAID_ORDER_CHECKOUT_READY':
  'HOLD_GETCOURSE_WRITE_KEY_NATIVE_FIELDS_OR_CONSENT',
 checkout_url:null,public_release_allowed:ready};
}
function disabledStatus(){
 return {ok:true,lot:10,model:'ONE_NATIVE_GETCOURSE_ORDER_MULTIPLE_EXISTING_OFFERS',
  live_provider_import_enabled:false,
  native_unpaid_order_qa_verified:false,native_order_fields_verified:false,
  provider_consent_enforced:false,native_payment_link_verified:false,
  native_receipt_verified:false,grants_verified:false,
  sale_ready:false,checkout_url:null,public_release_allowed:false};
}
function createLot10PublicRouter({quoteFn,qaAuthorized,coordinator=null,
 origin='https://wf.tati-lar.ru',rateLimitPerHour=8}={}){
 if(typeof quoteFn!=='function'||typeof qaAuthorized!=='function')throw Error('R137_DEPENDENCIES_REQUIRED');
 if(coordinator!==null&&(typeof coordinator.start!=='function'||
  typeof coordinator.readiness!=='function'))throw Error('R137_COORDINATOR_INVALID');
 const clients=new Map();
 function limited(req){
  const raw=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'?')
   .split(',')[0].slice(0,100);
  const key=crypto.createHash('sha256').update(raw).digest('hex').slice(0,24);
  const now=Date.now(),cur=clients.get(key);
  const next=cur&&now-cur.at<3600000?{at:cur.at,count:cur.count+1}:{at:now,count:1};
  clients.set(key,next);
  if(clients.size>2000)for(const [k,v] of clients)if(now-v.at>3600000)clients.delete(k);
  return next.count>rateLimitPerHour;
 }
 async function isReady(){
  if(!coordinator)return false;
  try{
   const v=await coordinator.readiness();
   return v?.ok===true&&v.ready===true&&v.public_release_allowed===true;
  }catch{return false}
 }
 return async function handle(req,res,path){
  const isQA=path.startsWith(QA);
  if(isQA&&!qaAuthorized(req))return reply(res,404,{ok:false,code:'NOT_FOUND'});
  if(!path.startsWith(PREFIX)&&!isQA)return reply(res,404,{ok:false,code:'NOT_FOUND'});
  if(req.headers.origin!==undefined&&req.headers.origin!==origin)
   return reply(res,403,{ok:false,code:'ORIGIN_DENIED'});
  const route=path.slice((isQA?QA:PREFIX).length);
  if(route==='status'&&req.method==='GET'){
   const ready=await isReady();
   return reply(res,200,{...disabledStatus(),
    live_provider_import_enabled:ready,
    native_unpaid_order_qa_verified:ready,
    native_order_fields_verified:ready,
    provider_consent_enforced:ready,
    native_payment_link_verified:ready,
    sale_ready:ready,public_release_allowed:ready});
  }
  if(!['plan','start'].includes(route))
   return reply(res,404,{ok:false,code:'NOT_FOUND',checkout_url:null});
  if(req.method!=='POST')
   return reply(res,405,{ok:false,code:'METHOD_NOT_ALLOWED',checkout_url:null});
  let payload,selection,plan;
  try{
   payload=await bodyJSON(req);
   if(route==='plan')selection=exactSelection(payload);
   else{
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||
      Object.keys(payload).some(k=>![
       'selection','email','nonce','offerRevisionSha256','idempotencyKey'
      ].includes(k)))throw Error('R137_ORDER_SHAPE_INVALID');
    selection=exactSelection(payload.selection);
   }
   plan=buildSetImportPlan({selection,quoteFn});
  }catch{
   return reply(res,422,{ok:false,code:'INVALID_SET_SELECTION',
    checkout_url:null,public_release_allowed:false});
  }
  const ready=await isReady();
  if(route==='plan')return reply(res,200,planResponse(plan,ready));
  if(!ready)return reply(res,503,{ok:false,
   code:'R137_GETCOURSE_KEY_FIELDS_OR_UNPAID_QA_NOT_READY',
   checkout_url:null,public_release_allowed:false});
  if(limited(req))return reply(res,429,{ok:false,code:'RATE_LIMITED',
   checkout_url:null,public_release_allowed:false});
  let result;
  try{
   result=await coordinator.start({
    selection,email:payload.email,nonce:payload.nonce,
    offerRevisionSha256:payload.offerRevisionSha256,
    idempotencyKey:payload.idempotencyKey
   });
   if(result?.ok!==true||result.native_order_positions_verified!==true||
     result.consent_verified!==true||
     result.public_release_allowed!==true||
     result.order_total_rub!==plan.desired_order_total_rub||
     !/^[0-9]{10,18}$/.test(String(result.deal_number||'')))
    throw Error('R137_NATIVE_ORDER_OR_PRICE_NOT_VERIFIED');
   const safe=exactPaymentUrl(result.checkout_url);
   return reply(res,200,{ok:true,checkout_url:safe,quote:{
    count:plan.items_count,discount_percent:plan.discount_percent,
    total_rub:plan.desired_order_total_rub},
    native_unpaid_order_verified:true,public_release_allowed:true,
    payment_verified:false,receipt_verified:false});
  }catch{
   return reply(res,503,{ok:false,code:'R137_ORDER_NOT_VERIFIED_NO_PAYMENT_LINK',
    checkout_url:null,public_release_allowed:false});
  }
 };
}
module.exports={PREFIX,QA,createLot10PublicRouter};
