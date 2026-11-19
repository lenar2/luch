'use strict';
/** Closed QA site-native GetCourse one-Offer / two-Product bridge. */
const fs=require('node:fs'),path=require('node:path');
const {createAdapter}=require('../dynamic-adapter-r1/adapter.cjs');
const bundle=require('./native-bundle-qa.cjs');
const PREFIX='/api/checkout/_qa/native-bundle/';
function fail(code){const e=new Error(code);e.code=code;throw e}
function json(res,http,data){res.writeHead(http,{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex,nofollow'});res.end(JSON.stringify(data))}
function html(res,content){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8',
 'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex,nofollow','Referrer-Policy':'no-referrer',
 'Content-Security-Policy':"default-src 'self' https://study.shkola-dnv.com; script-src 'self' https://study.shkola-dnv.com https://*.getcourse.ru; frame-src https://study.shkola-dnv.com https://*.getcourse.ru; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://study.shkola-dnv.com; form-action https://study.shkola-dnv.com; object-src 'none'; base-uri 'none'"});res.end(content)}
async function readJSON(req){
 if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')fail('APPLICATION_JSON_REQUIRED');
 let size=0,buf=[];
 for await(const x of req){size+=x.length;if(size>10000)fail('BODY_TOO_LARGE');buf.push(x)}
 let v;try{v=JSON.parse(Buffer.concat(buf).toString('utf8'))}catch{fail('BAD_JSON')}
 if(!v||typeof v!=='object'||Array.isArray(v))fail('BAD_JSON_OBJECT');
 return v;
}
function keys(v,expected){if(Object.keys(v).sort().join(',')!==expected.slice().sort().join(','))fail('CLIENT_OVERRIDE_OR_MISSING_FIELD')}
function createNativeBundleQARouter({quoteFn,manifest,qaAuthorized,secretHex}={}){
 if(typeof quoteFn!=='function'||!manifest||typeof qaAuthorized!=='function'||!(/^[a-f0-9]{64,}$/.test(secretHex||'')))
  fail('SERVER_NATIVE_BUNDLE_CONFIG_REQUIRED');
 const base=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../dynamic-adapter-r1/native-mapping-observed.json'),'utf8'));
 const overlay=JSON.parse(fs.readFileSync(path.resolve(__dirname,'native-mapping-live-overlay.json'),'utf8'));
 const adapter=createAdapter({quoteFn,manifest,observedMapping:{...base.entries,...overlay.entries}});
 const secret=Buffer.from(secretHex,'hex');
 return async function handler(req,res,route){
  if(!route.startsWith(PREFIX)||!qaAuthorized(req)){json(res,404,{ok:false,code:'NOT_FOUND'});return}
  const action=route.slice(PREFIX.length);
  if(req.headers.origin&&req.headers.origin!=='https://wf.tati-lar.ru'){json(res,403,{ok:false,code:'ORIGIN_DENIED'});return}
  if(req.method==='GET'&&action==='preview'){html(res,bundle.renderQAPreview());return}
  if(req.method!=='POST'){json(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'});return}
  try{
   const v=await readJSON(req);
   if(action==='prepare'){
    keys(v,['kind','items','checkout_idempotency_key']);
    const token=bundle.seal({adapter,input:{kind:v.kind,items:v.items},key:v.checkout_idempotency_key,secret});
    const order=bundle.verify({adapter,token,secret});
    json(res,200,{ok:true,mode:order.native_mode,offer_id:order.offer_id,widget_id:order.widget_id,
     total_rub:order.total_rub,expected_products:order.products,
     signed_bundle_intent:token,provider_order_status:'NOT_CREATED_BY_SITE',
     native_qa_form_url:'https://study.shkola-dnv.com/pl/lite/widget/widget?id=1686790',
     checkout_url:null,customer_sale_ready:false});
    return;
   }
   if(action==='verify'||action==='start'){
    keys(v,['signed_bundle_intent']);
    const order=bundle.verify({adapter,token:v.signed_bundle_intent,secret});
    if(action==='start'){json(res,503,{ok:false,code:'NATIVE_BUNDLE_QA_INACTIVE',offer_id:order.offer_id,
      amount_due_rub:11690,checkout_url:null,order_created:false,customer_sale_ready:false});return}
    json(res,200,{ok:true,mode:order.native_mode,offer_id:order.offer_id,
     total_rub:order.total_rub,product_rights:order.products,
     actual_native_test_order_source:'BF2026_GETCOURSE_QA_ORDER_71994',
     provider_offer_active:false,customer_sale_ready:false,checkout_url:null});
    return;
   }
   json(res,404,{ok:false,code:'NOT_FOUND'});
  }catch(e){json(res,422,{ok:false,code:e.code||'BUNDLE_QA_REQUEST_INVALID',checkout_url:null})}
 };
}
module.exports={PREFIX,createNativeBundleQARouter};
