'use strict';
/* BF2026 R182: read-only native GetCourse Lot12 checkout status by nonce.
 * Never creates orders, changes their prices or triggers payment.
 * Release link only after R180 persisted independent admin readback.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {exactPaymentUrl}=require('./r135-set-payment-link.cjs');
const DIR='/tmp/bf2026-lot12-r166-orders';
const NUM=/^[1-9][0-9]{9,17}$/;
const NONCE=/^[a-zA-Z0-9_-]{32,110}$/;
function stateFor({deal_number,nonce},{ledgerDir=DIR}={}){
 if(!NUM.test(String(deal_number||''))||!NONCE.test(String(nonce||'')))
  return {http:400,data:{ok:false,code:'INVALID_ORDER_REFERENCE'}};
 const sha=crypto.createHash('sha256').update(nonce).digest('hex');
 let rec=null;
 try{
  const names=fs.readdirSync(ledgerDir);
  for(const name of names.slice(0,3000)){
   if(!/^[a-f0-9]{64}\.json$/.test(name))continue;
   const f=path.join(ledgerDir,name),st=fs.lstatSync(f);
   if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077))continue;
   const candidate=JSON.parse(fs.readFileSync(f,'utf8'));
   if(String(candidate.deal_number)===String(deal_number)){rec=candidate;break}
  }
 }catch(e){if(e.code!=='ENOENT')return {http:503,data:{ok:false,code:'STATUS_STORAGE_UNAVAILABLE'}}}
 // R187: consented buyer may resume the same unpaid native Deal with a fresh
 // one-time nonce only after proving the phone bound in native GetCourse.
 const validHashes=rec?[rec.nonce_sha256,...(Array.isArray(rec.resume_nonce_sha256)?rec.resume_nonce_sha256:[])]
   .filter(x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x)):[];
 if(validHashes.length===0||
    !validHashes.some(x=>crypto.timingSafeEqual(Buffer.from(sha,'hex'),Buffer.from(x,'hex'))))
  return {http:404,data:{ok:false,code:'ORDER_NOT_FOUND'}};
 const status={ok:true,deal_number:String(rec.deal_number),price_verified:false,payment_ready:false,
  order_submitted:Number.isSafeInteger(rec.deal_id)&&rec.deal_id>0,checkout_url:null};
 if(rec.state!=='price_verified')return {http:200,data:{...status,processing:true}};
 if(rec.native_total_readback_verified!==true||rec.native_status!=='new'||
   !Number.isSafeInteger(rec.total_rub)||rec.total_rub<1||
   !Array.isArray(rec.verified_positions)||rec.verified_positions.length!==rec.positions_done||
   rec.positions_done<2||rec.positions_done>7)
  return {http:200,data:{...status,processing:true}};
 const sum=rec.verified_positions.reduce((s,p)=>s+Number(p.price_rub)*Number(p.quantity),0);
 if(sum!==rec.total_rub||rec.verified_positions.some(p=>p.currency!=='RUB'||p.quantity!==1))
  return {http:200,data:{...status,processing:true}};
 let url=null;
 try{url=exactPaymentUrl(rec.provider_checkout_url)}catch{}
 // BF2026 historical rescue: proof and signed GetCourse link stay usable
 // through sale even if a shopper returns later; the provider settles payment.
 const age=Date.now()-Date.parse(rec.provider_checkout_verified_at||rec.price_verified_at||'');
 if(!Number.isFinite(age)||age<0||age>72*60*60*1000)url=null;
 return {http:200,data:{...status,price_verified:true,order_total_rub:rec.total_rub,
  payment_ready:!!url,processing:!url,checkout_url:url}};
}
function createStatusHandler(opts={}){
 return async(req,res)=>{
  const send=(http,data)=>{res.writeHead(http,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private',
   'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(data))};
  if(req.method!=='POST')return send(405,{ok:false,code:'METHOD_NOT_ALLOWED'});
  if(req.headers.origin!=='https://wf.tati-lar.ru')return send(403,{ok:false,code:'ORIGIN_DENIED'});
  if(String(req.headers['content-type']||'').split(';')[0].trim()!=='application/json')
   return send(415,{ok:false,code:'JSON_REQUIRED'});
  let body='',size=0;
  try{
   for await(const chunk of req){
    size+=chunk.length;if(size>2048)throw Error('BODY_TOO_LARGE');
    body+=chunk.toString('utf8');
   }
   const data=JSON.parse(body);
   if(!data||Array.isArray(data)||typeof data!=='object'||Object.keys(data).some(x=>!['deal_number','nonce'].includes(x)))
    return send(400,{ok:false,code:'INVALID_BODY'});
   const result=stateFor(data,opts);
   return send(result.http,result.data);
  }catch{return send(400,{ok:false,code:'INVALID_BODY'})}
 };
}
module.exports={stateFor,createStatusHandler};
