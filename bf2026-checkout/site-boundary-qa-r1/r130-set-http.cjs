'use strict';
/* R130 on the real site staging: native multi-offer plan only, no order write.
 * Public: server-recomputed set plan for existing Lot10 UI.
 * QA: import transport status. Never accepts buyer email, API key or payment.
 */
const {buildSetImportPlan}=require('./r130-set-lines.cjs');
const PUBLIC='/api/checkout/set/';
const QA='/api/checkout/_qa/set-order/';
function send(res,status,obj){
 if(res.headersSent)return;
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',
  'X-Robots-Tag':'noindex,nofollow','Referrer-Policy':'no-referrer'});
 res.end(JSON.stringify(obj));
}
async function read(req){
 if((req.headers['content-type']||'').split(';')[0].trim()!=='application/json')
  throw Error('R130_JSON_REQUIRED');
 let size=0,parts=[];
 for await(const chunk of req){
  size+=chunk.length;if(size>2048)throw Error('R130_BODY_TOO_LARGE');
  parts.push(chunk);
 }
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}
 catch{throw Error('R130_JSON_INVALID')}
}
function createSetRouter({quoteFn,qaAuthorized,origin='https://wf.tati-lar.ru'}={}){
 if(typeof quoteFn!=='function'||typeof qaAuthorized!=='function')throw Error('R130_ROUTER_DEPENDENCIES_REQUIRED');
 return async function setRouter(req,res,path){
  const isQA=path.startsWith(QA);
  if(isQA&&!qaAuthorized(req))return send(res,404,{ok:false,code:'NOT_FOUND'});
  if(!path.startsWith(PUBLIC)&&!isQA)return send(res,404,{ok:false,code:'NOT_FOUND'});
  if(req.headers.origin!==undefined&&req.headers.origin!==origin)
   return send(res,403,{ok:false,code:'ORIGIN_DENIED'});
  if(path===(isQA?QA:PUBLIC)+'status'&&req.method==='GET')
   return send(res,200,{ok:true,lot:10,model:'ONE_NATIVE_GETCOURSE_ORDER_MULTIPLE_EXISTING_OFFERS',
    imported_orders:0,live_provider_import_enabled:false,
    documented_import_endpoint:'https://study.shkola-dnv.com/pl/api/deals',
    native_payment_link_verified:false,native_receipt_verified:false,grants_verified:false,
    sale_ready:false,checkout_url:null,public_release_allowed:false});
  if(path===(isQA?QA:PUBLIC)+'plan'&&req.method==='POST'){
   try{
    const selection=await read(req);
    if(!selection||typeof selection!=='object'||Array.isArray(selection)||
     Object.keys(selection).some(x=>!['kind','items','source_variant'].includes(x)))
     throw Error('R130_SELECTION_SHAPE_INVALID');
    const plan=buildSetImportPlan({selection,quoteFn});
    return send(res,200,{ok:true,quote:{
     count:plan.items_count,discount_percent:plan.discount_percent,
     total_rub:plan.desired_order_total_rub,pricing_version:plan.pricing_version
    },order:{
     provider:'GetCourse',mode:'MULTIPLE_OFFERS_SAME_DEAL_NUMBER',
     expected_line_items:plan.lines.map(x=>({offer_id:x.offer_id,
      line_price_rub:x.discounted_line_price_rub,
      product_training_pairs:x.access.map(a=>({product_id:a.product_id,
       training_id:a.training_id,after_pay_days:a.access_days_after_pay}))})),
     expected_payment_total_rub:plan.desired_order_total_rub,
     expected_single_order:true,create_new_offer_count:0
    },status:'HOLD_NATIVE_WRITE_CONSENT_PAYMENT_GRANTS_NOT_VERIFIED',
    checkout_url:null,public_release_allowed:false});
   }catch(e){
    return send(res,422,{ok:false,code:'INVALID_SET_SELECTION',
     checkout_url:null,public_release_allowed:false});
   }
  }
  if(req.method==='POST'&&(/(start|execute|payment|checkout)$/.test(path)))
   return send(res,503,{ok:false,code:'R130_GETCOURSE_ORDER_IMPORT_DISABLED',
    checkout_url:null,public_release_allowed:false});
  return send(res,404,{ok:false,code:'NOT_FOUND',checkout_url:null});
 };
}
module.exports={PUBLIC,QA,createSetRouter};
