'use strict';
/* Isolated R154 server route contract; NOT mounted on the production site.
 * Default start HOLD. Only validated native GetCourse payment_link may leave.
 */
const {quoteSetR154,buildLot12SetPlan,VERSION}=require('./r154-lot12-set.cjs');
const {exactPaymentUrl}=require('./r135-set-payment-link.cjs');
const PREFIX='/api/checkout/lot12/';
function send(res,status,json){
 if(res.headersSent)return;
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow'});
 res.end(JSON.stringify(json));
}
async function jsonBody(req){
 if(String(req.headers['content-type']||'').split(';')[0].trim()!=='application/json')
  throw Error('R154_JSON_REQUIRED');
 const parts=[];let bytes=0;
 for await(const chunk of req){
  bytes+=chunk.length;if(bytes>4096)throw Error('R154_BODY_TOO_LARGE');
  parts.push(chunk);
 }
 return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
function fields(v,names){
 return !!v&&typeof v==='object'&&!Array.isArray(v)&&
  Object.keys(v).every(k=>names.includes(k));
}
function hold(res,code,status=503){
 return send(res,status,{ok:false,code,checkout_url:null,
  provider_verified:false,public_release_allowed:false});
}
function createLot12Http({
 coordinator=null,allowStart=false,origin='https://wf.tati-lar.ru'
}={}){
 if(coordinator!==null&&(typeof coordinator.start!=='function'||
  typeof coordinator.readiness!=='function'))
  throw Error('R154_NATIVE_COORDINATOR_INVALID');
 return async (req,res,path)=>{
  if(typeof path!=='string'||!path.startsWith(PREFIX))
   return hold(res,'R154_NOT_FOUND',404);
  if(req.headers.origin!==undefined&&req.headers.origin!==origin)
   return hold(res,'R154_ORIGIN_DENIED',403);
  const action=path.slice(PREFIX.length);
  if(action==='status'&&req.method==='GET'){
   let gate=false;
   if(allowStart&&coordinator)try{
    const r=await coordinator.readiness();
    gate=r?.ok===true&&r.ready===true&&r.public_release_allowed===true;
   }catch{}
   return send(res,200,{ok:true,visible_lot:12,legacy_selector_lot:10,
    pricing_version:VERSION,catalog_choices:11,min:2,max:7,
    native_multioffer_preflight_ready:gate,
    public_release_allowed:gate,checkout_url:null});
  }
  if(!['plan','start'].includes(action))return hold(res,'R154_NOT_FOUND',404);
  if(req.method!=='POST')return hold(res,'R154_METHOD_NOT_ALLOWED',405);
  let selection,body,plan,q;
  try{
   body=await jsonBody(req);
   if(action==='plan'){
    if(!fields(body,['kind','items','source_variant']))throw Error('INVALID');
    selection=body;
   }else{
    if(!fields(body,['selection','email','nonce','offerRevisionSha256','idempotencyKey'])||
     !['selection','email','nonce','offerRevisionSha256','idempotencyKey']
      .every(x=>Object.hasOwn(body,x)))throw Error('INVALID');
    selection=body.selection;
   }
   q=quoteSetR154(selection);plan=buildLot12SetPlan({selection});
  }catch{return hold(res,'R154_INVALID_SET_SELECTION',422)}
  if(action==='plan')return send(res,200,{
   ok:true,quote:{pricing_version:VERSION,count:q.count,currency:'RUB',
    subtotal_rub:q.subtotal_rub,discount_percent:q.discount_percent,
    savings_rub:q.savings_rub,total_rub:q.total_rub},
   native_plan:{single_order:true,one_line_per_offer:true,
    plan_sha256:plan.plan_sha256,
    lines:plan.lines.map(x=>({offer_id:x.offer_id,
     discounted_line_price_rub:x.discounted_line_price_rub,
     access:x.access}))},
   checkout_url:null,public_release_allowed:false,
   code:'R154_SERVER_QUOTE_HOLD_NATIVE_PAYMENT_LINK'});
  if(!allowStart||!coordinator)return hold(res,'R154_START_DISABLED_NO_NATIVE_PAYMENT_PROOF');
  let preflight;
  try{preflight=await coordinator.readiness()}catch{}
  if(preflight?.ok!==true||preflight?.ready!==true||
   preflight?.public_release_allowed!==true)
   return hold(res,'R154_REALTIME_NATIVE_MULTI_OFFER_NOT_APPROVED');
  let result;
  try{
   result=await coordinator.start({
    selection,email:body.email,nonce:body.nonce,
    offerRevisionSha256:body.offerRevisionSha256,
    idempotencyKey:body.idempotencyKey
   });
   if(result?.ok!==true||result.public_release_allowed!==true||
    result.native_order_positions_verified!==true||
    result.consent_verified!==true||
    result.order_total_rub!==plan.desired_order_total_rub||
    !/^[0-9]{10,18}$/.test(String(result.deal_number||'')))
    throw Error('R154_NATIVE_UNPAID_ORDER_NOT_PROVEN');
   const paymentLink=exactPaymentUrl(result.checkout_url);
   return send(res,200,{ok:true,checkout_url:paymentLink,
    deal_number:result.deal_number,order_total_rub:plan.desired_order_total_rub,
    count:plan.items_count,pricing_version:VERSION,
    native_unpaid_order_verified:true,provider_verified:true,
    public_release_allowed:true,payment_verified:false});
  }catch{return hold(res,'R154_PROVIDER_LINK_UNVERIFIED_NO_ORDER_RELEASE')}
 };
}
module.exports={PREFIX,createLot12Http};
