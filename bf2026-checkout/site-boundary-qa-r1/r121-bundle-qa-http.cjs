'use strict';
const {createVerifier}=require('./r121-bundle-verify.cjs');
const PREFIX='/api/checkout/_qa/native-bundle-readback/';
function reply(res,status,obj){
 res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store, private',
  'x-robots-tag':'noindex,nofollow','x-content-type-options':'nosniff'});
 res.end(JSON.stringify(obj));
}
function createQARouter({qaAuthorized,pool,reader,exportReader,keys={},allowLive=false}={}){
 if(typeof qaAuthorized!=='function')throw Error('R121_QA_AUTH_REQUIRED');
 const verify=pool?createVerifier({pool,reader,keys,allowLive}):null;
 return async(req,res,path)=>{
  if(!path.startsWith(PREFIX)||!qaAuthorized(req))return reply(res,404,{ok:false,code:'NOT_FOUND'});
  if(req.headers.origin&&req.headers.origin!=='https://wf.tati-lar.ru')
   return reply(res,403,{ok:false,code:'ORIGIN_DENIED'});
  const action=path.slice(PREFIX.length);
  if(req.method==='GET'&&action==='status'){
   let postgresLedgerReady=false,exportBudgetReady=false;
   if(pool){try{const db=await pool.query("SELECT to_regclass('public.bf2026_native_bundle_verification') AS ledger,to_regclass('public.bf2026_getcourse_export_budget') AS export_budget");
    postgresLedgerReady=!!db.rows?.[0]?.ledger;exportBudgetReady=!!db.rows?.[0]?.export_budget;
   }catch{}}
   const ready=!!reader&&postgresLedgerReady&&exportBudgetReady;
   return reply(res,ready?200:503,{ok:true,route:'R121_BUNDLE_READBACK_QA_ONLY',
    postgres_ledger_ready:postgresLedgerReady,export_budget_ready:exportBudgetReady,
    provider_reader_configured:!!reader,export_reader_configured:!!exportReader,
    payment_verified:false,release_allowed:false});
  }
  if(req.method==='POST'&&action==='export-readback'){
   if(!exportReader)return reply(res,503,{ok:false,code:'GETCOURSE_API_KEY_NOT_CONFIGURED',
    payment_record_verified:false,receipt_verified:false,grants_verified:false,release_allowed:false});
   if(String(req.headers['content-type']||'').split(';')[0].trim()!=='application/json')
    return reply(res,415,{ok:false,code:'APPLICATION_JSON_REQUIRED'});
   try{
    let size=0,parts=[];
    for await(const part of req){size+=part.length;if(size>64)throw Error('EMPTY_JSON_BODY_REQUIRED');parts.push(part)}
    const data=JSON.parse(Buffer.concat(parts).toString('utf8'));
    if(!data||Array.isArray(data)||Object.keys(data).length!==0)throw Error('EMPTY_JSON_BODY_REQUIRED');
    const result=await exportReader.readBundleOrderAndPayment();
    const safe={};
    for(const k of ['state','source','deal_id','order_number','offer_id','order_total_rub',
      'order_status','paid_total_rub','payed_at','payment_record_verified','payment_status',
      'payment_amount_rub','payment_id','payment_source'])
      if(result[k]!==undefined)safe[k]=result[k];
    return reply(res,String(result.state||'').startsWith('PENDING')?202:200,{ok:true,...safe,
      provider_signature_verified:false,receipt_verified:false,grants_verified:false,
      grant_writes:0,release_allowed:false,checkout_url:null});
   }catch(e){return reply(res,422,{ok:false,code:e.code||'GETCOURSE_EXPORT_READBACK_FAILED',
    payment_record_verified:false,receipt_verified:false,grants_verified:false,release_allowed:false})}
  }
  if(req.method!=='POST'||action!=='reconcile')return reply(res,404,{ok:false,code:'NOT_FOUND'});
  if(!reader||!verify)return reply(res,503,{ok:false,code:'HOLD_PROVIDER_READBACK_UNCONFIGURED',
   payment_verified:false,release_allowed:false});
  if(String(req.headers['content-type']||'').split(';')[0].trim()!=='application/json')
   return reply(res,415,{ok:false,code:'APPLICATION_JSON_REQUIRED'});
  try{
   let size=0,parts=[];
   for await(const part of req){size+=part.length;if(size>512)throw Error('BODY_TOO_LARGE');parts.push(part)}
   const data=JSON.parse(Buffer.concat(parts).toString('utf8'));
   if(!data||Array.isArray(data)||Object.keys(data).join(',')!=='event_id')throw Error('ONLY_EVENT_ID_ALLOWED');
   const result=await verify(data.event_id);
   return reply(res,result.status.startsWith('HOLD')?202:200,{ok:true,...result});
  }catch(e){return reply(res,422,{ok:false,code:e.code||'R121_READBACK_REJECTED',
   payment_verified:false,release_allowed:false})}
 };
}
module.exports={PREFIX,createQARouter};
