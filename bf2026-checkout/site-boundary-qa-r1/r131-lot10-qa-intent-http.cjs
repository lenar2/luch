'use strict';
/* R131: QA-only durable order PREPARATION route.
 * Existing Lot10 site remains read-only. NO provider write transport exists
 * on this HTTP path; never sends API keys, native form data or payment URLs.
 */
const {createSetOrderWorker}=require('./r130-set-order-worker.cjs');
const ROOT='/api/checkout/_qa/set-order/';
const ORIGIN='https://wf.tati-lar.ru';
function json(res,status,data){
 if(res.headersSent)return;
 res.writeHead(status,{'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store, private','pragma':'no-cache',
  'x-content-type-options':'nosniff','x-robots-tag':'noindex,nofollow',
  'referrer-policy':'no-referrer'});
 res.end(JSON.stringify(data));
}
async function parse(req){
 if(String(req.headers['content-type']||'').split(';')[0].trim()!=='application/json')
  throw Error('R131_CONTENT_TYPE_REQUIRED');
 let size=0;const buf=[];
 for await(const part of req){
  size+=part.length;
  if(size>2048)throw Error('R131_BODY_TOO_LARGE');
  buf.push(part);
 }
 try{return JSON.parse(Buffer.concat(buf).toString('utf8'))}
 catch{throw Error('R131_JSON_PARSE_FAILED')}
}
function createQaIntentRouter({pool,quoteFn,qaAuthorized}={}){
 if(typeof qaAuthorized!=='function'||typeof quoteFn!=='function'||
  !pool||typeof pool.query!=='function')
  throw Error('R131_STAGE_DATABASE_QA_ROUTER_DEPENDENCIES_REQUIRED');
 const transport={send:async()=>{throw Error('R131_NO_PROVIDER_WRITE_CONFIGURED')}};
 const worker=createSetOrderWorker({pool,quoteFn,transport,allowExternalWrites:false});
 return async function qaIntentRouter(req,res,path){
  if(!path.startsWith(ROOT))return json(res,404,{ok:false,code:'NOT_FOUND'});
  if(!qaAuthorized(req))return json(res,404,{ok:false,code:'NOT_FOUND'});
  if(req.headers.origin!==undefined&&req.headers.origin!==ORIGIN)
   return json(res,403,{ok:false,code:'ORIGIN_DENIED'});
  if(path===ROOT+'status'&&req.method==='GET')
   return json(res,200,{ok:true,lot:10,mode:'QA_PREPARE_ONLY',
    provider_requests_enabled:false,real_getcourse_order_created:false,
    public_checkout_url:null,public_release_allowed:false});
  if(path===ROOT+'intent'&&req.method==='GET'){
   const key=new URL(req.url,'http://127.0.0.1').searchParams.get('key');
   try{
    const status=await worker.inspect({idempotencyKey:key});
    return json(res,200,{ok:true,status,provider_requests_sent:0,
     public_release_allowed:false});
   }catch(e){
    return json(res,404,{ok:false,code:'NOT_FOUND'});
   }
  }
  if(path!==ROOT+'prepare'||req.method!=='POST')
   return json(res,404,{ok:false,code:'NOT_FOUND'});
  try{
   const body=await parse(req);
   const exact=['selection','email','nonce','offerRevisionSha256'];
   if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).sort().join('|')!==exact.sort().join('|'))
    throw Error('R131_EXACT_QA_PREPARE_BODY_REQUIRED');
   // No customer personal data: test-only mailbox, QA authentication.
   if(typeof body.email!=='string'||
    !/^[a-z0-9._+-]{1,80}@example\.(invalid|test)$/.test(body.email))
    throw Error('R131_TEST_ONLY_QA_EMAIL_REQUIRED');
   const key=req.headers['x-bf2026-idempotency-key'];
   if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))
    throw Error('R131_IDEMPOTENCY_HEADER_REQUIRED');
   const result=await worker.prepare({...body,idempotencyKey:key});
   return json(res,result.duplicate?200:201,{ok:true,
    duplicate:result.duplicate,mode:'QA_PREPARE_ONLY',status:result.status,
    offer_ids:result.plan.lines.map(line=>line.offer_id),
    priced_lines_rub:result.plan.lines.map(line=>line.discounted_line_price_rub),
    plan_sha256:result.plan.plan_sha256,consent_verified:false,
    provider_requests_sent:0,public_checkout_url:null,
    public_release_allowed:false});
  }catch(e){
   const c=String(e?.code||e?.message||'R131_QA_PREPARE_INVALID');
   const conflict=/NONCE_REUSED|IDEMPOTENCY_KEY_BODY_CHANGED|COLLISION/.test(c);
   return json(res,conflict?409:422,{ok:false,
    code:/^R(130|131)_/.test(c)?c:'R131_INVALID_PREPARE',
    provider_requests_sent:0,public_checkout_url:null,
    public_release_allowed:false});
  }
 };
}
module.exports={ROOT,createQaIntentRouter};
