'use strict';
/* R126: server-owned, QA-only verification transport boundary.
 * No browser-provided native result. Real Export refresh reuses R123 once
 * and is OFF unless BF2026_R126_PROVIDER_VERIFY_ENABLED=1 plus secret.
 */
const {ROUTE_KEYS,HELD}=require('./r126-provider-verification.cjs');
const PREFIX='/api/checkout/_qa/provider-verification/';
const ID=/^[a-f0-9]{32,64}$/;
const ALLOWED_ORIGIN='https://wf.tati-lar.ru';
function send(res,status,data){
 if(res.headersSent)return;
 res.writeHead(status,{'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store, private','x-content-type-options':'nosniff',
 'x-robots-tag':'noindex,nofollow','referrer-policy':'no-referrer'});
 res.end(JSON.stringify(data));
}
function createProviderHttp({provider,qaAuthorized}={}){
 if(!provider||typeof provider.status!=='function'||typeof provider.bundle!=='function'||
   typeof provider.routes!=='function'||typeof qaAuthorized!=='function')
  throw Error('R126_HTTP_DEPENDENCIES_MISSING');
 return async function http(req,res,path){
  if(!path.startsWith(PREFIX)||!qaAuthorized(req))
   return send(res,404,{ok:false,code:'NOT_FOUND'});
  if(req.headers.origin!==undefined&&req.headers.origin!==ALLOWED_ORIGIN)
   return send(res,403,{ok:false,code:'ORIGIN_DENIED',...HELD});
  const action=path.slice(PREFIX.length);
  try{
   const url=new URL(req.url,'http://localhost');
   if(action==='status'&&req.method==='GET'&&url.searchParams.size===0){
    const state=await provider.status();
    return send(res,state.postgres_ledger_ready?200:503,{ok:true,...state});
   }
   if(action==='bundle'&&req.method==='GET'&&url.searchParams.size===0)
    return send(res,200,{ok:true,...await provider.bundle()});
   if(action==='routes'&&req.method==='GET'&&url.searchParams.size===0)
    return send(res,200,{ok:true,route:'R126_EXACT_EXISTING_10_CTA_KEYS',
      routes:provider.routes(),...HELD});
   if(action==='cta'&&req.method==='GET'&&url.searchParams.size===1&&url.searchParams.has('route')){
    const key=url.searchParams.get('route');
    if(!ROUTE_KEYS.includes(key))return send(res,404,{ok:false,code:'R126_CTA_NOT_APPROVED',...HELD});
    return send(res,200,{ok:true,...provider.route(key)});
   }
   if(action==='refresh'&&req.method==='POST'&&url.searchParams.size===0){
    // The request has NO body, IDs or filters from the caller. The
    // native QA order/Offer are hard-coded by R123 readOnce.
    if(req.headers['content-type']!==undefined)return send(res,415,{
     ok:false,code:'R126_REFRESH_BODY_FORBIDDEN',...HELD});
    if(Number(req.headers['content-length']||0)>0||req.headers['transfer-encoding'])
     return send(res,422,{ok:false,code:'R126_REFRESH_BODY_FORBIDDEN',...HELD});
    const key=req.headers['x-bf2026-idempotency-key'];
    if(typeof key!=='string'||!ID.test(key))
     return send(res,422,{ok:false,code:'R126_IDEMPOTENCY_KEY_REQUIRED',...HELD});
    const v=await provider.refreshOnce(key);
    return send(res,202,{ok:true,...v});
   }
   return send(res,404,{ok:false,code:'NOT_FOUND',...HELD});
  }catch{
   return send(res,503,{ok:false,code:'R126_FAIL_CLOSED_INTERNAL_OR_DB',...HELD});
  }
 };
}
module.exports={PREFIX,createProviderHttp};
