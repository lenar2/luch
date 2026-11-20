'use strict';
const {ingest}=require('./getcourse-callback-hint.cjs');
const PATH='/api/checkout/_relay/getcourse-native-callback-hint';
function reply(res,status,body){
 res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store, private',
  'x-robots-tag':'noindex,nofollow','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
 res.end(JSON.stringify(body));
}
function createHttpHandler({secret,store}={}){
 return async(req,res)=>{
  if(req.method!=='POST')return reply(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'});
  if(!Buffer.isBuffer(secret)||secret.length<32)
   return reply(res,503,{ok:false,code:'GETCOURSE_CALLBACK_SECRET_NOT_CONFIGURED',
    provider_signature_verified:false,payment_verified:false});
  if(String(req.headers['content-type']||'').split(';')[0].trim()!=='application/json')
   return reply(res,415,{ok:false,code:'APPLICATION_JSON_REQUIRED'});
  try{
   let size=0,chunks=[];
   for await(const c of req){size+=c.length;if(size>2048)throw Object.assign(Error(),{code:'GETCOURSE_CALLBACK_BODY_INVALID'});chunks.push(c)}
   const result=await ingest({rawBody:Buffer.concat(chunks),authorization:req.headers.authorization,
    accountHost:req.headers['x-getcourse-account'],secret,store});
   return reply(res,202,result);
  }catch(e){
   const code=e.code||'GETCOURSE_CALLBACK_REJECTED';
   const auth=code==='GETCOURSE_CALLBACK_AUTH_REQUIRED'||code==='GETCOURSE_CALLBACK_SHARED_SECRET_INVALID';
   return reply(res,auth?401:422,{ok:false,code,provider_signature_verified:false,
    payment_verified:false,receipt_verified:false,grants_verified:false,grant_writes:0});
  }
 };
}
module.exports={PATH,createHttpHandler};
