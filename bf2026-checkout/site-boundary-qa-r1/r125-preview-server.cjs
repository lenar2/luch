'use strict';
/*
 * BF2026 R125 independent isolated browser preview gateway.
 * Serves a copy of R109 homepage; forwards only read-only inspect and
 * non-payable QA prepare to the R124 loopback server 127.0.0.1:18770.
 * No arbitrary proxy, GetCourse API, order/charge/grant/receipt route.
 * Provider/QA secret stays on SERVER; browser never sees it.
 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const ROOT='/srv/factory-scratch/bf2026-r125-frontend-isolated-20261119/www';
const HOST='127.0.0.1',PORT=18771,BACKEND=18770;
const QA_SECRET_FILE='/srv/factory-scratch/bf2026-r118-relay-stage-20261119/private-widget-qa.secret';
const PREFIX='/api/checkout/_qa/single-form/';
const ALLOWED=Object.freeze({status:'GET',inspect:'GET',prepare:'POST'});
const CONTENT=Object.freeze({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml',
 '.jpeg':'image/jpeg','.jpg':'image/jpeg','.gif':'image/gif','.woff2':'font/woff2',
 '.json':'application/json; charset=utf-8'});
function send(res,code,data,type='application/json; charset=utf-8'){
 res.writeHead(code,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff',
  'x-robots-tag':'noindex,nofollow','referrer-policy':'no-referrer'});
 res.end(type.startsWith('application/json')?JSON.stringify(data):data);
}
const REFUSE=Object.freeze({ok:false,code:'NOT_FOUND',release_allowed:false});
function createPreviewServer({readSecret=()=>fs.readFileSync(QA_SECRET_FILE,'utf8').trim()}={}){
 if(process.env.BF2026_R125_PREVIEW_ONLY!=='1')throw Error('R125_PREVIEW_ONLY_REQUIRED');
 if(!fs.existsSync(path.join(ROOT,'assets','r125-single-cta-preview.js')))
  throw Error('R125_ISOLATED_PREVIEW_NOT_INSTALLED');
 return http.createServer(async(req,res)=>{
  if(req.headers.host!=='127.0.0.1:'+PORT)return send(res,404,REFUSE);
  let u;try{u=new URL(req.url,'http://127.0.0.1:'+PORT)}catch{return send(res,404,REFUSE)}
  if(u.pathname.startsWith(PREFIX)){
   const action=u.pathname.slice(PREFIX.length);
   if(ALLOWED[action]!==req.method)return send(res,404,REFUSE);
   const origin=req.headers.origin;
   if(origin!==undefined&&origin!=='http://127.0.0.1:'+PORT)
    return send(res,403,{ok:false,code:'ORIGIN_DENIED',release_allowed:false});
   if(action==='inspect'&&(u.searchParams.size!==1||!u.searchParams.has('route')))
    return send(res,422,{ok:false,code:'R125_INSPECT_ROUTE_REQUIRED',release_allowed:false});
   if(action!=='inspect'&&u.search) return send(res,404,REFUSE);
   if(req.method==='POST'&&String(req.headers['content-type']||'').split(';')[0]!=='application/json')
    return send(res,415,{ok:false,code:'APPLICATION_JSON_REQUIRED',release_allowed:false});
   let content=Buffer.alloc(0);
   if(req.method==='POST'){
    for await(const chunk of req){
     if(content.length+chunk.length>1024)return send(res,413,{ok:false,code:'R125_BODY_TOO_LARGE',release_allowed:false});
     content=Buffer.concat([content,chunk]);
    }
   }
   let qaSecret;
   try{qaSecret=readSecret()}catch{return send(res,503,{ok:false,code:'R125_STAGE_SECRET_UNAVAILABLE',release_allowed:false})}
   if(!qaSecret||qaSecret.length<24)return send(res,503,{ok:false,code:'R125_STAGE_SECRET_INVALID',release_allowed:false});
   const headers={'host':HOST+':'+BACKEND,'x-bf2026-qa-key':qaSecret,'accept':'application/json',
    'origin':'https://wf.tati-lar.ru'};
   if(req.method==='POST'){
    headers['content-type']='application/json';
    headers['content-length']=String(content.length);
    if(typeof req.headers['x-bf2026-idempotency-key']==='string')
     headers['x-bf2026-idempotency-key']=req.headers['x-bf2026-idempotency-key'];
   }
   const upstream=http.request({hostname:HOST,port:BACKEND,method:req.method,
    path:u.pathname+u.search,headers,timeout:4000},out=>{
     let responseSize=0,blocks=[];
     out.on('data',chunk=>{
      responseSize+=chunk.length;
      if(responseSize>32768){out.destroy();return}
      blocks.push(chunk)
     });
     out.on('end',()=>{
      let body;try{body=JSON.parse(Buffer.concat(blocks).toString('utf8'))}
      catch{return send(res,502,{ok:false,code:'R125_STAGE_BAD_UPSTREAM',release_allowed:false})}
      // Never return an upstream payment link, even if stage accidentally emits it.
      if(body?.checkout_url!==undefined&&body.checkout_url!==null)
       return send(res,502,{ok:false,code:'R125_PAYMENT_LINK_REFUSED',release_allowed:false});
      if(body?.public_release_allowed===true||body?.payment_verified===true||
         body?.fiscal_receipt_verified===true||body?.actual_grants_verified===true)
       return send(res,502,{ok:false,code:'R125_NATIVE_PROOF_NOT_AUTHORIZED',release_allowed:false});
      send(res,out.statusCode||502,body);
     })
   });
   upstream.on('error',()=>send(res,503,{ok:false,code:'R125_STAGING_UPSTREAM_DOWN',release_allowed:false}));
   upstream.on('timeout',()=>upstream.destroy(Error('R125_STAGE_TIMEOUT')));
   upstream.end(content);
   return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return send(res,404,REFUSE);
  if(u.search&&u.pathname!=='/assets/lot10-set/index.html')
   return send(res,404,REFUSE);
  if(u.pathname==='/'||u.pathname==='/index.html'){
   const raw=fs.readFileSync(path.join(ROOT,'index.html'));
   return send(res,200,raw,'text/html; charset=utf-8');
  }
  if(!u.pathname.startsWith('/assets/'))return send(res,404,REFUSE);
  let decoded;
  try{decoded=decodeURIComponent(u.pathname)}catch{return send(res,404,REFUSE)}
  if(decoded.includes('..')||decoded.includes('\\')||decoded.includes('\0'))return send(res,404,REFUSE);
  const rel=decoded.slice(1),candidate=path.resolve(ROOT,rel);
  if(!candidate.startsWith(ROOT+path.sep))return send(res,404,REFUSE);
  const mime=CONTENT[path.extname(candidate).toLowerCase()];
  if(!mime)return send(res,404,REFUSE);
  try{
   const stat=fs.statSync(candidate);
   if(!stat.isFile()||stat.size>20*1024*1024)return send(res,404,REFUSE);
   const content=fs.readFileSync(candidate);
   return send(res,200,content,mime);
  }catch{return send(res,404,REFUSE)}
 });
}
if(require.main===module){
 const server=createPreviewServer();
 server.listen(PORT,HOST,()=>{
  console.log(JSON.stringify({event:'R125_STAGE_PREVIEW_STARTED',host:HOST,port:PORT,
   backend_loopback:BACKEND,live_orders_enabled:false,public_checkout_enabled:false}));
 });
}
module.exports={createPreviewServer,PORT,ROOT};
