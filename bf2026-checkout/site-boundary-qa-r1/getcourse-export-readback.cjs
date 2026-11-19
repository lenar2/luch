'use strict';
// Read-only GetCourse Export API driver for the existing QA bundle.
// It never calls Import API, never mutates orders/payments/access, and never
// treats Export API output as receipt or Training entitlement proof.
const DEFAULTS=Object.freeze({
 host:'study.shkola-dnv.com', userId:'524210421', orderNumber:'71994',
 dealId:'924624456', offerId:8935004, amountRub:11690,
 apiWindowMs:2*60*60*1000, maxRequestsPerWindow:70, maxResponseBytes:2*1024*1024
});
function fail(code){const e=new Error(code);e.code=code;throw e}
function safeId(v){return typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)}
function parseRub(v){
 if(typeof v==='number')return Number.isFinite(v)?Math.round(v*100)/100:null;
 if(typeof v!=='string')return null;
 const s=v.trim().replace(/\s/g,'').replace(/[^\d,.-]/g,'').replace(',','.');
 if(!s||!/^[-+]?\d+(?:\.\d{1,2})?$/.test(s))return null;
 const n=Number(s);return Number.isFinite(n)?n:null;
}
function parseIds(v){
 if(Array.isArray(v))return v.map(x=>String(x).trim()).filter(Boolean).sort();
 if(typeof v==='number')return [String(v)];
 if(typeof v==='string')return v.split(/[,\s;]+/).map(x=>x.trim()).filter(Boolean).sort();
 return [];
}
function rowsFrom(body){
 const r=body?.result??body;
 if(Array.isArray(r))return r;
 for(const v of [r?.rows,r?.data,r?.items,body?.rows,body?.data])
  if(Array.isArray(v))return v;
 for(const v of [r?.data,r?.result,body?.result])
  if(typeof v==='string'){try{const p=JSON.parse(v);if(Array.isArray(p))return p;if(Array.isArray(p?.rows))return p.rows;if(Array.isArray(p?.data))return p.data;}catch{}}
 return null;
}
function pending(body){
 const s=String(body?.status??body?.result?.status??body?.state??body?.result?.state??'').toLowerCase();
 return ['new','pending','processing','queued','building','in_progress','wait'].includes(s)||
  body?.ready===false||body?.result?.ready===false;
}
function exportIdFrom(body){
 const id=body?.export_id??body?.result?.export_id??body?.result?.key??body?.key;
 if(!safeId(String(id??'')))fail('GETCOURSE_EXPORT_ID_MISSING_OR_INVALID');
 return String(id);
}
function normalizeDeal(row,expected=DEFAULTS){
 const id=String(row?.id??row?.deal_id??'');
 const number=String(row?.deal_number??row?.number??'');
 if(id!==expected.dealId||number!==expected.orderNumber)fail('GETCOURSE_DEAL_IDENTITY_MISMATCH');
 if(row.user_id!==undefined&&String(row.user_id)!==expected.userId)fail('GETCOURSE_DEAL_USER_MISMATCH');
 const offerIds=parseIds(row.offers??row.offer_ids??row.offer_id);
 if(offerIds.length!==1||offerIds[0]!==String(expected.offerId))fail('GETCOURSE_DEAL_OFFER_MISMATCH');
 const total=parseRub(row.cost_money_value??row.deal_cost??row.cost_money??row.amount);
 if(total!==expected.amountRub)fail('GETCOURSE_DEAL_AMOUNT_MISMATCH');
 const status=String(row.status??row.deal_status??'').toLowerCase();
 if(!['new','payed','part_payed','cancelled','false','payment_waiting','waiting_for_return'].includes(status))
  fail('GETCOURSE_DEAL_STATUS_UNKNOWN');
 const paidRaw=row.payed_money??row.paid_money??row.payed_money_value;
 const paid=paidRaw===undefined?null:parseRub(paidRaw);
 if(paidRaw!==undefined&&paid===null)fail('GETCOURSE_PAID_AMOUNT_INVALID');
 if(status==='new'&&paid!==null&&paid!==0)fail('GETCOURSE_NEW_ORDER_HAS_PAID_MONEY');
 if(status==='payed'&&paid!==null&&paid!==expected.amountRub)fail('GETCOURSE_PAID_TOTAL_MISMATCH');
 return Object.freeze({source:'GETCOURSE_EXPORT_API_READONLY',deal_id:id,order_number:number,
  user_id:expected.userId,offer_id:expected.offerId,order_total_rub:total,
  order_status:status,paid_total_rub:paid,payed_at:row.payed_at??row.deal_finished_at??null,
  payment_record_verified:false,receipt_verified:false,grants_verified:false,
  limitations:['EXPORT_API_DOES_NOT_PROVE_FISCAL_RECEIPT','EXPORT_API_DOES_NOT_EXPOSE_PURCHASE_ENTITLEMENTS']});
}
const EXPECTED_PRODUCT_TRAINING=Object.freeze([
 Object.freeze({product_id:4557988,training_id:936022301}),
 Object.freeze({product_id:4550895,training_id:933861292})
]);
function validateExportProductIdentity(row){
 // Only explicit product-to-training pairs in the *same exported deal*
 // can complete this structural check. Product IDs or display names alone
 // do not establish actual Training grants or a paid Purchase.
 if(row?.account_host!==undefined&&row.account_host!==DEFAULTS.host)
  fail('GETCOURSE_EXPORT_ACCOUNT_HOST_MISMATCH');
 const given=row?.products??row?.offer_products??row?.product_training;
 if(given===undefined)return {product_identity_verified:false,
  product_identity_reason:'EXPORT_PRODUCT_TRAINING_PAIRS_ABSENT'};
 if(!Array.isArray(given)||given.length!==2)
  fail('GETCOURSE_EXPORT_PRODUCTS_NOT_EXACTLY_TWO');
 const normalized=given.map(p=>{
  if(!p||typeof p!=='object'||Array.isArray(p)||
   !/^[0-9]+$/.test(String(p.product_id??''))||
   !/^[0-9]+$/.test(String(p.training_id??'')))fail('GETCOURSE_EXPORT_PRODUCT_TRAINING_PAIR_INVALID');
  return {product_id:Number(p.product_id),training_id:Number(p.training_id)};
 }).sort((a,b)=>a.product_id-b.product_id);
 const want=[...EXPECTED_PRODUCT_TRAINING].sort((a,b)=>a.product_id-b.product_id);
 if(JSON.stringify(normalized)!==JSON.stringify(want))
  fail('GETCOURSE_EXPORT_PRODUCT_TRAINING_MAPPING_MISMATCH');
 return {product_identity_verified:true,product_ids:want.map(x=>x.product_id),
  training_ids:want.map(x=>x.training_id),actual_grants_verified:false};
}
function normalizePaymentRows(rows,deal,expected=DEFAULTS){
 const matches=rows.filter(row=>{
  const did=String(row?.deal_id??row?.provider_deal_id??'');
  const dno=String(row?.deal_number??'');
  return did===expected.dealId||dno===expected.orderNumber;
 });
 if(matches.length!==1)fail(matches.length?'GETCOURSE_PAYMENT_DUPLICATE_MATCH':'GETCOURSE_PAYMENT_NOT_FOUND');
 const row=matches[0];
 const status=String(row.status??row.payment_status??'').toLowerCase();
 const amount=parseRub(row.amount_rub??row.payment_amount_rub??row.amount??row.sum??row.cost_money_value);
 if(status!=='accepted'||amount!==expected.amountRub)fail('GETCOURSE_PAYMENT_STATUS_OR_AMOUNT_MISMATCH');
 return Object.freeze({payment_record_verified:true,payment_status:status,
  payment_amount_rub:amount,payment_id:String(row.id??row.payment_id??'')||null,
  receipt_verified:false,grants_verified:false});
}
function createPostgresBudget(pool,{accountHost=DEFAULTS.host,maxRequests=DEFAULTS.maxRequestsPerWindow,now=()=>Date.now()}={}){
 if(typeof pool?.connect!=='function')fail('GETCOURSE_EXPORT_BUDGET_PG_REQUIRED');
 async function tx(fn){
  const c=await pool.connect();
  try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result}
  catch(e){try{await c.query('ROLLBACK')}catch{}throw e}
  finally{c.release()}
 }
 async function locked(c){
  await c.query('INSERT INTO bf2026_getcourse_export_budget(account_host) VALUES($1) ON CONFLICT(account_host) DO NOTHING',[accountHost]);
  const q=await c.query('SELECT account_host,window_started_at,request_count,outstanding_export_id FROM bf2026_getcourse_export_budget WHERE account_host=$1 FOR UPDATE',[accountHost]);
  if(!q.rows?.[0])fail('GETCOURSE_EXPORT_BUDGET_ROW_MISSING');
  return q.rows[0];
 }
 async function refresh(c,row){
  const start=new Date(row.window_started_at).getTime();
  if(now()-start>=DEFAULTS.apiWindowMs){
   await c.query("UPDATE bf2026_getcourse_export_budget SET window_started_at=now(),request_count=0,updated_at=now() WHERE account_host=$1",[accountHost]);
   row.request_count=0;
  }
  if(Number(row.request_count)>=maxRequests)fail('GETCOURSE_EXPORT_BUDGET_EXHAUSTED');
 }
 return Object.freeze({
  async claimStart(){return tx(async c=>{
   const row=await locked(c);await refresh(c,row);
   if(row.outstanding_export_id)fail('GETCOURSE_EXPORT_ALREADY_IN_PROGRESS');
   await c.query("UPDATE bf2026_getcourse_export_budget SET request_count=request_count+1,outstanding_export_id='CREATING',outstanding_since=now(),updated_at=now() WHERE account_host=$1",[accountHost]);
  })},
  async markExport(id){if(!safeId(id))fail('GETCOURSE_EXPORT_ID_MISSING_OR_INVALID');return tx(async c=>{
   const r=await c.query("UPDATE bf2026_getcourse_export_budget SET outstanding_export_id=$2,updated_at=now() WHERE account_host=$1 AND outstanding_export_id='CREATING' RETURNING account_host",[accountHost,id]);
   if(!r.rowCount)fail('GETCOURSE_EXPORT_LEASE_LOST');
  })},
  async claimPoll(id){if(!safeId(id))fail('GETCOURSE_EXPORT_ID_MISSING_OR_INVALID');return tx(async c=>{
   const row=await locked(c);await refresh(c,row);
   if(row.outstanding_export_id!==id)fail('GETCOURSE_EXPORT_LEASE_MISMATCH');
   await c.query("UPDATE bf2026_getcourse_export_budget SET request_count=request_count+1,updated_at=now() WHERE account_host=$1",[accountHost]);
  })},
  async complete(id){return tx(async c=>{
   const r=await c.query("UPDATE bf2026_getcourse_export_budget SET outstanding_export_id=NULL,outstanding_since=NULL,updated_at=now() WHERE account_host=$1 AND outstanding_export_id=$2 RETURNING account_host",[accountHost,id]);
   if(!r.rowCount)fail('GETCOURSE_EXPORT_LEASE_MISMATCH');
  })},
  async releaseCreating(){return tx(async c=>{
   await c.query("UPDATE bf2026_getcourse_export_budget SET outstanding_export_id=NULL,outstanding_since=NULL,updated_at=now() WHERE account_host=$1 AND outstanding_export_id='CREATING'",[accountHost]);
  })}
 });
}
function createGetCourseExportReader({apiKeyProvider,fetchImpl=globalThis.fetch,budget,host=DEFAULTS.host,
 timeoutMs=10000,maxPolls=3,pollDelayMs=1000,sleep=ms=>new Promise(r=>setTimeout(r,ms)),
 strictProductIdentity=false,expected=DEFAULTS}={}){
 if(host!==DEFAULTS.host)fail('GETCOURSE_EXPORT_HOST_NOT_ALLOWLISTED');
 if(typeof fetchImpl!=='function')fail('GETCOURSE_FETCH_UNAVAILABLE');
 for(const k of ['claimStart','markExport','claimPoll','complete'])if(typeof budget?.[k]!=='function')fail('GETCOURSE_EXPORT_DURABLE_BUDGET_REQUIRED');
 async function apiKey(){
  if(typeof apiKeyProvider!=='function')fail('GETCOURSE_API_KEY_NOT_CONFIGURED');
  const key=await apiKeyProvider();
  if(typeof key!=='string'||key.length<20||key.length>256||/\s/.test(key))fail('GETCOURSE_API_KEY_INVALID');
  return key;
 }
 async function get(path,params,providedKey){
  const key=providedKey??await apiKey();
  const url=new URL(path,'https://'+host);
  for(const [k,v] of Object.entries(params||{}))url.searchParams.set(k,String(v));
  url.searchParams.set('key',key);
  let response;
  try{response=await fetchImpl(url.toString(),{method:'GET',redirect:'error',
   headers:{accept:'application/json'},signal:AbortSignal.timeout(timeoutMs),cache:'no-store'})}
  catch(e){fail(e?.name==='TimeoutError'?'GETCOURSE_EXPORT_TIMEOUT':'GETCOURSE_EXPORT_TRANSPORT_ERROR')}
  if(!response?.ok)fail('GETCOURSE_EXPORT_HTTP_'+Number(response?.status||0));
  const text=await response.text();
  if(Buffer.byteLength(text,'utf8')>DEFAULTS.maxResponseBytes)fail('GETCOURSE_EXPORT_RESPONSE_TOO_LARGE');
  let body;try{body=JSON.parse(text)}catch{fail('GETCOURSE_EXPORT_RESPONSE_NOT_JSON')}
  if(body?.success===false||body?.result?.success===false||body?.error===true)fail('GETCOURSE_EXPORT_API_REJECTED');
  return body;
 }
 async function start(kind,filters){
  const allowed=kind==='deals'?new Set(['user_id','status','created_at[from]','created_at[to]','payed_at[from]','payed_at[to]','finished_at[from]','finished_at[to]','status_changed_at[from]','status_changed_at[to]']):
   kind==='payments'?new Set(['status','created_at[from]','created_at[to]','status_changed_at[from]','status_changed_at[to]']):null;
  if(!allowed||!filters||!Object.keys(filters).length||Object.keys(filters).some(k=>!allowed.has(k)))fail('GETCOURSE_EXPORT_FILTER_NOT_ALLOWED');
  if(kind==='deals'&&filters.user_id!==expected.userId)fail('GETCOURSE_EXPORT_DEAL_SCOPE_MUST_BE_QA_BUYER');
  if(kind==='payments'&&(!filters['created_at[from]']||filters['created_at[from]']!==filters['created_at[to]']))
   fail('GETCOURSE_EXPORT_PAYMENT_DATE_WINDOW_MUST_BE_ONE_DAY');
  const key=await apiKey();
  await budget.claimStart();
  const body=await get('/pl/api/account/'+kind,filters,key);
  const id=exportIdFrom(body);
  await budget.markExport(id);
  return id;
 }
 async function poll(id){
  if(!safeId(id))fail('GETCOURSE_EXPORT_ID_MISSING_OR_INVALID');
  const key=await apiKey();
  await budget.claimPoll(id);
  const body=await get('/pl/api/account/exports/'+encodeURIComponent(id),{},key);
  const rows=rowsFrom(body);
  if(rows){await budget.complete(id);return {state:'READY',rows};}
  if(pending(body))return {state:'PENDING',rows:null};
  fail('GETCOURSE_EXPORT_RESPONSE_SHAPE_UNKNOWN');
 }
 async function collect(kind,filters){
  const id=await start(kind,filters);
  for(let i=0;i<maxPolls;i++){
   const p=await poll(id);
   if(p.state==='READY')return {state:'READY',rows:p.rows,export_id:id};
   if(i+1<maxPolls)await sleep(pollDelayMs);
  }
  return {state:'PENDING',export_id:id,rows:null};
 }
 async function readBundleOrderAndPayment(){
  const deals=await collect('deals',{user_id:expected.userId});
  if(deals.state!=='READY')return {state:'PENDING_DEALS_EXPORT',export_id:deals.export_id,
   payment_record_verified:false,receipt_verified:false,grants_verified:false};
  const matches=deals.rows.filter(r=>String(r?.deal_number??r?.number??'')===expected.orderNumber||
   String(r?.id??r?.deal_id??'')===expected.dealId);
  if(matches.length!==1)fail(matches.length?'GETCOURSE_DEAL_DUPLICATE_MATCH':'GETCOURSE_DEAL_NOT_FOUND');
  const deal=normalizeDeal(matches[0],expected);
  const productIdentity=validateExportProductIdentity(matches[0]);
  if(strictProductIdentity&&!productIdentity.product_identity_verified)
   return {...deal,...productIdentity,state:'PARTIAL_PRODUCT_MAPPING_UNAVAILABLE',
    payment_record_verified:false,receipt_verified:false,grants_verified:false};
  if(deal.order_status!=='payed'){
   if(deal.order_status!=='new')return {...deal,...productIdentity,state:'PARTIAL_ORDER_STATE',payment_record_verified:false};
   if(deal.paid_total_rub!==0)return {...deal,...productIdentity,state:'PARTIAL_UNPAID_WITHOUT_ZERO_PAYMENT_READBACK'};
   return {...deal,...productIdentity,state:'VERIFIED_UNPAID_ORDER',payment_record_verified:false};
  }
  if(deal.paid_total_rub!==expected.amountRub)fail('GETCOURSE_PAID_ORDER_TOTAL_NOT_EXACT');
  if(!deal.payed_at) return {...deal,...productIdentity,state:'PAID_ORDER_PAYMENT_DATE_MISSING',payment_record_verified:false};
  const date=new Date(deal.payed_at);
  if(!Number.isFinite(date.getTime()))return {...deal,...productIdentity,state:'PAID_ORDER_PAYMENT_DATE_UNPARSEABLE',payment_record_verified:false};
  const day=date.toISOString().slice(0,10);
  const payments=await collect('payments',{'created_at[from]':day,'created_at[to]':day,status:'accepted'});
  if(payments.state!=='READY')return {...deal,...productIdentity,state:'PENDING_PAYMENTS_EXPORT',payment_export_id:payments.export_id,
   payment_record_verified:false};
  const proof=normalizePaymentRows(payments.rows,deal,expected);
  return {...deal,...productIdentity,...proof,state:'PAYMENT_RECORD_MATCHED',
   receipt_verified:false,grants_verified:false,
   payment_source:'GETCOURSE_EXPORT_API_READONLY',
   note:'Export API does not establish fiscal receipt or purchase-level Training access.'};
 }
 return Object.freeze({startExport:(kind,filters)=>start(kind,filters),
  startDealsExport:()=>start('deals',{user_id:expected.userId}),
  pollExport:poll,readBundleOrderAndPayment});
}
module.exports={DEFAULTS,EXPECTED_PRODUCT_TRAINING,validateExportProductIdentity,
 parseRub,parseIds,rowsFrom,exportIdFrom,normalizeDeal,normalizePaymentRows,
 createPostgresBudget,createGetCourseExportReader};
