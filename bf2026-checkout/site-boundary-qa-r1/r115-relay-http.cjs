'use strict';
/*
 * HTTP adapter for R115 trusted relay. No GetCourse signature assumed.
 * The proxy/relay signs raw bytes; this endpoint stores only a hint.
 */
const {ingestRelayEvent}=require('./provider-relay-webhook.cjs');
const PATH='/api/checkout/_relay/payment-hint';
function response(res,http,body){
 res.writeHead(http,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
  'X-Robots-Tag':'noindex,nofollow','Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff'});
 res.end(JSON.stringify(body));
}
async function boundedBody(req){
 let n=0,parts=[];
 for await(const chunk of req){
  n+=chunk.length;
  if(n>4096){const e=new Error('RELAY_BODY_SIZE_INVALID');e.code=e.message;throw e}
  parts.push(chunk);
 }
 return Buffer.concat(parts);
}
function createRelayHttpHandler({secret,store,nowMs=()=>Date.now()}={}){
 if(!Buffer.isBuffer(secret)||secret.length<32||typeof store?.accept!=='function')
  throw Error('RELAY_ROUTE_DISABLED_MISSING_KEY_OR_STORE');
 return async function handle(req,res){
  if(req.method!=='POST'){response(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'});return}
  if(String(req.headers['content-type']||'').split(';')[0].trim()!=='application/json'){
   response(res,415,{ok:false,code:'CONTENT_TYPE_REQUIRED'});return
  }
  try{
   const result=await ingestRelayEvent({rawBody:await boundedBody(req),secret,store,nowMs:nowMs(),
    timestamp:req.headers['x-bf2026-relay-timestamp'],
    signature:req.headers['x-bf2026-relay-signature']});
   response(res,202,result);
  }catch(e){
   const auth=(e.code||'').startsWith('RELAY_SIGNATURE')||(e.code||'').startsWith('RELAY_TIMESTAMP');
   response(res,auth?401:422,{ok:false,code:e.code||'EVENT_INTAKE_FAILED',
    payment_verified:false,release_allowed:false,grant_writes:0});
  }
 }
}
module.exports={PATH,createRelayHttpHandler};
