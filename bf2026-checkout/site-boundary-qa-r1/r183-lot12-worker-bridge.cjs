'use strict';
/* BF2026 R183 encrypted authenticated HTTPS transport for Mac repricer.
 * Read-only pending queue + narrow native proof ack, never payment or create order.
 */
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path'),cp=require('node:child_process');
const KEY='/app/secrets/lot12-worker-https.key';
const LEDGER=path.join(__dirname,'r180-lot12-reprice-ledger.cjs');
const DATA_DIR='/tmp/bf2026-lot12-r166-orders';
function reply(res,http,data){
 res.writeHead(http,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
 res.end(JSON.stringify(data))
}
function authenticated(req){
 let expected;try{expected=fs.readFileSync(KEY,'utf8').trim()}catch{return false}
 const token=req.headers['x-bf2026-repricer-secret'];
 if(typeof token!=='string'||expected.length!==64||token.length!==64||
    !/^[0-9a-f]{64}$/.test(expected)||!/^[0-9a-f]{64}$/.test(token))return false;
 return crypto.timingSafeEqual(Buffer.from(expected,'ascii'),Buffer.from(token,'ascii'));
}
function exec(args){
 const v=cp.execFileSync(process.execPath,[LEDGER,...args],{
  encoding:'utf8',timeout:8000,maxBuffer:250000,
  env:{...process.env,BF2026_LOT12_LEDGER_DIR:DATA_DIR}});
 return JSON.parse(v);
}
function createWorkerBridge(){
 return async(req,res,path0)=>{
  if(req.method!=='POST')return reply(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'});
  if(!authenticated(req))return reply(res,401,{ok:false,code:'WORKER_AUTH_REQUIRED'});
  if(req.headers.origin)return reply(res,403,{ok:false,code:'WORKER_NO_BROWSER_ORIGIN'});
  if(String(req.headers['content-type']||'').split(';')[0].trim()!=='application/json')
   return reply(res,415,{ok:false,code:'WORKER_JSON_REQUIRED'});
  let raw='',bytes=0;
  try{
   for await(const chunk of req){
    bytes+=chunk.length;
    if(bytes>20000)throw Error('WORKER_BODY_TOO_LARGE');
    raw+=chunk.toString('utf8');
   }
   const json=JSON.parse(raw);
   if(!json||Array.isArray(json)||typeof json!=='object')throw Error('WORKER_BAD_BODY');
   if(path0==='/api/checkout/lot12/worker/queue'){
    if(Object.keys(json).length!==0)throw Error('WORKER_QUEUE_BODY_INVALID');
    return reply(res,200,{ok:true,jobs:exec(['list'])});
   }
   if(path0==='/api/checkout/lot12/worker/ack'){
    if(Object.keys(json).sort().join(',')!=='deal_number,proof')throw Error('WORKER_ACK_KEYS_INVALID');
    if(typeof json.deal_number!=='string'||!/^[1-9][0-9]{9,17}$/.test(json.deal_number)||
       !json.proof||typeof json.proof!=='object'||Array.isArray(json.proof))
      throw Error('WORKER_ACK_INVALID');
    const proof=Buffer.from(JSON.stringify(json.proof),'utf8').toString('base64');
    if(proof.length>18000)throw Error('WORKER_PROOF_TOO_LARGE');
    const result=exec(['ack',json.deal_number,proof]);
    return reply(res,200,result);
   }
   if(path0==='/api/checkout/lot12/worker/restore'){
    if(Object.keys(json).sort().join(',')!=='deal_number,proof')throw Error('WORKER_RESTORE_KEYS_INVALID');
    if(typeof json.deal_number!=='string'||!/^[1-9][0-9]{9,17}$/.test(json.deal_number)||
       !json.proof||typeof json.proof!=='object'||Array.isArray(json.proof))
      throw Error('WORKER_RESTORE_INVALID');
    const proof=Buffer.from(JSON.stringify(json.proof),'utf8').toString('base64');
    if(proof.length>18000)throw Error('WORKER_RESTORE_TOO_LARGE');
    return reply(res,200,exec(['restore',json.deal_number,proof]));
   }
   return reply(res,404,{ok:false,code:'WORKER_NOT_FOUND'});
  }catch(e){
   const c=String(e.message||'WORKER_ERROR');
   return reply(res,422,{ok:false,code:/^R180_[A-Z0-9_]+$/.test(c)?c:'WORKER_REQUEST_FAILED'});
  }
 };
}
module.exports={createWorkerBridge};
