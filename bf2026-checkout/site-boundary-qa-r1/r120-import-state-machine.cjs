'use strict';
/*
 * R120 — guarded GetCourse Import API orchestration.
 * Import API is an import-only candidate, never enabled for live checkout.
 * No network client is included. Caller must reserve/mark-submitting before
 * an explicit provider request. Ambiguous timeout becomes UNKNOWN, not retry.
 */
const crypto=require('node:crypto');
const {plan:buildR119Plan,request:buildR119Request}=require('../r119-import.cjs');
const API_URL='https://study.shkola-dnv.com/pl/api/deals';
const verifiedResponses=new WeakSet();
function fail(code){const e=new Error(code);e.code=code;throw e;}
function sha256(x){return crypto.createHash('sha256').update(Buffer.isBuffer(x)?x:Buffer.from(String(x))).digest('hex');}
function canonical(x){
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(x&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype)
  return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 if(x===null||['string','number','boolean'].includes(typeof x))return JSON.stringify(x);
 fail('NON_CANONICAL_IMPORT_VALUE');
}
function isHex(s,n){return typeof s==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(s);}
function positiveId(x){
 const n=typeof x==='number'?x:/^[0-9]{1,20}$/.test(String(x))?Number(x):NaN;
 return Number.isSafeInteger(n)&&n>0?n:null;
}
function success(x){return x===true||x==='true'||x===1||x==='1';}
function normalizeEmail(email){
 if(typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('IMPORT_EMAIL_INVALID');
 return email.trim().toLowerCase();
}
function createImportIntent({selection,email,checkoutIdempotencyKey,identitySecret}={}){
 if(!Buffer.isBuffer(identitySecret)||identitySecret.length<32)fail('IDENTITY_HMAC_KEY_REQUIRED');
 if(!isHex(checkoutIdempotencyKey,32))fail('CHECKOUT_IDEMPOTENCY_KEY_INVALID');
 const p=buildR119Plan(selection,normalizeEmail(email),checkoutIdempotencyKey);
 const identityHmac=crypto.createHmac('sha256',identitySecret).update('bf2026:getcourse:identity:v1\\n').update(normalizeEmail(email)).digest('hex');
 const core={selection_key:p.selection_key,total_rub:p.total_rub,subtotal_rub:p.subtotal_rub,lines:p.lines};
 return Object.freeze({schema:'bf2026.r120.import-intent.v1',
  checkout_idempotency_key:checkoutIdempotencyKey,
  selection_sha256:sha256(canonical(core)),customer_identity_hmac:identityHmac,
  total_rub:p.total_rub,line_count:p.lines.length,
  lines:p.lines.map(x=>Object.freeze({...x})),
  provider:'GetCourse',provider_api:'IMPORT_V1',live_enabled:false});
}
function buildStepRequest({r119Plan,step,apiKey,providerDealNumber}={}){
 if(!r119Plan||r119Plan.schema!=='bf2026.r119.import-candidate'||r119Plan.live_enabled!==false)
  fail('R119_TEST_PLAN_REQUIRED');
 if(typeof apiKey!=='string'||apiKey.length<16||apiKey.length>512)fail('GETCOURSE_API_KEY_REQUIRED');
 if(!Number.isInteger(step)||step<0||step>=r119Plan.lines.length)fail('IMPORT_STEP_INVALID');
 const req=buildR119Request(r119Plan,step,apiKey,providerDealNumber);
 if(req.url!==API_URL||req.method!=='POST'||req.network_invoked!==false)fail('IMPORT_REQUEST_TARGET_INVALID');
 const params=new URLSearchParams(req.body);
 if(params.get('action')!=='add'||!params.get('key')||params.get('key')!==apiKey)fail('IMPORT_AUTH_FORM_INVALID');
 let payload;try{payload=JSON.parse(Buffer.from(params.get('params'),'base64').toString('utf8'))}catch{fail('IMPORT_PARAMS_INVALID')}
 const deal=payload.deal||{},system=payload.system||{};
 const expected=r119Plan.lines[step];
 if(positiveId(deal.offer_id)!==expected.offer_id||Number(deal.deal_cost)!==expected.amount_rub||
  Number(deal.quantity)!==1||deal.deal_currency!=='RUB'||deal.deal_status!=='new'||!(deal.deal_is_paid===0||deal.deal_is_paid==='0'))
  fail('IMPORT_REQUEST_ORDER_FIELDS_INVALID');
 if(Number(system.multiple_offers)!==(step===0?0:1)||Number(system.return_deal_number)!==1||
  Number(system.return_payment_link)!==(step===r119Plan.lines.length-1?1:0)||
  Number(system.refresh_if_exists)!==0)fail('IMPORT_REQUEST_SYSTEM_FIELDS_INVALID');
 if(step===0&&deal.deal_number!==undefined)fail('FIRST_IMPORT_MUST_CREATE_NEW_ORDER');
 if(step>0&&String(deal.deal_number)!==String(providerDealNumber))fail('FOLLOWUP_PROVIDER_ORDER_NUMBER_MISMATCH');
 return Object.freeze({url:req.url,method:req.method,headers:Object.freeze({...req.headers}),
  body:req.body,step,offer_id:expected.offer_id,amount_rub:expected.amount_rub,
  provider_call_performed:false,api_key_in_body:true,do_not_log_body:true});
}
function verifyImportApiResponse({body,rawBody,responseUrl,tlsVerified,redirected,step,previous,nowMs=Date.now()}={}){
 if(responseUrl!==API_URL||tlsVerified!==true||redirected!==false)
  fail('GETCOURSE_PROVIDER_TRANSPORT_NOT_VERIFIED');
 if(!Number.isInteger(step)||step<0||step>1)fail('IMPORT_RESPONSE_STEP_INVALID');
 let data=body;
 if(typeof rawBody==='string'){
  try{data=JSON.parse(rawBody)}catch{fail('GETCOURSE_API_RESPONSE_NOT_JSON')}
 }else if(Buffer.isBuffer(rawBody)){
  try{data=JSON.parse(rawBody.toString('utf8'))}catch{fail('GETCOURSE_API_RESPONSE_NOT_JSON')}
 }
 if(!data||typeof data!=='object'||Array.isArray(data)||!success(data.success)||data.action!=='add')
  fail('GETCOURSE_API_ACTION_FAILED');
 const r=data.result;
 if(!r||typeof r!=='object'||!success(r.success)||r.error===true||r.error==='true'||
  (typeof r.error_message==='string'&&r.error_message.trim()))fail('GETCOURSE_API_RESULT_FAILED');
 const dealId=positiveId(r.deal_id),dealNumber=positiveId(r.deal_number),userId=positiveId(r.user_id);
 if(!dealId||!dealNumber||!userId)fail('GETCOURSE_PROVIDER_IDENTITY_INCOMPLETE');
 if(step===0&&previous!==undefined)fail('FIRST_IMPORT_CANNOT_HAVE_PREVIOUS_ORDER');
 if(step===1){
  if(!previous||!verifiedResponses.has(previous)||previous.step!==0)fail('FIRST_PROVIDER_RESPONSE_NOT_VERIFIED');
  if(previous.provider_deal_id!==dealId||previous.provider_deal_number!==String(dealNumber)||
    previous.provider_user_id!==userId)fail('GETCOURSE_ORDER_IDENTITY_CHANGED_BETWEEN_OFFERS');
 }
 let paymentLink=null;
 if(step===1){
  if(typeof r.payment_link!=='string'||!r.payment_link.trim())fail('GETCOURSE_PAYMENT_LINK_MISSING');
  let u;try{u=new URL(r.payment_link)}catch{fail('GETCOURSE_PAYMENT_LINK_INVALID')}
  if(u.protocol!=='https:'||u.hostname!=='study.shkola-dnv.com'||u.username||u.password)
   fail('GETCOURSE_PAYMENT_LINK_HOST_INVALID');
  paymentLink=u.toString();
 }
 const bytes=rawBody!==undefined?Buffer.from(rawBody):Buffer.from(canonical(data));
 const result=Object.freeze({schema:'bf2026.r120.verified-import-response.v1',provider:'GetCourse',
  provider_api:'IMPORT_V1',step,provider_deal_id:dealId,provider_deal_number:String(dealNumber),
  provider_user_id:userId,payment_link:paymentLink,response_sha256:sha256(bytes),
  captured_at:new Date(nowMs).toISOString(),transport:'HTTPS_TLS_VERIFIED',
  provider_response_signature:'NOT_DOCUMENTED_BY_GETCOURSE',
  payment_verified:false,grants_verified:false,live_sale_release:false});
 verifiedResponses.add(result);
 return result;
}
async function withTx(pool,fn){
 const c=await pool.connect();
 try{await c.query('BEGIN');const x=await fn(c);await c.query('COMMIT');return x}
 catch(e){try{await c.query('ROLLBACK')}catch{}throw e}
 finally{c.release?.()}
}
function createImportLedger(pool){
 if(!pool||typeof pool.connect!=='function')fail('IMPORT_POSTGRES_POOL_REQUIRED');
 return {
  async reserve({intent,ownerToken}={}){
   if(intent?.schema!=='bf2026.r120.import-intent.v1'||!isHex(intent.checkout_idempotency_key,32)||
    !isHex(intent.selection_sha256,64)||!isHex(intent.customer_identity_hmac,64)||!isHex(ownerToken,32))
    fail('IMPORT_RESERVATION_INVALID');
   return withTx(pool,async c=>{
    const ins=await c.query("INSERT INTO bf2026_getcourse_import_ledger(scope,checkout_idempotency_key,selection_sha256,customer_identity_hmac,total_rub,line_count,state,current_step,lease_owner) VALUES('BF2026',$1,$2,$3,$4,$5,'RESERVED',0,$6) ON CONFLICT(scope,checkout_idempotency_key) DO NOTHING RETURNING state",
     [intent.checkout_idempotency_key,intent.selection_sha256,intent.customer_identity_hmac,intent.total_rub,intent.line_count,ownerToken]);
    if(ins.rowCount===1)return {status:'NEW'};
    const q=await c.query("SELECT selection_sha256,customer_identity_hmac,total_rub,line_count,state,provider_deal_id,provider_deal_number FROM bf2026_getcourse_import_ledger WHERE scope='BF2026' AND checkout_idempotency_key=$1 FOR UPDATE",[intent.checkout_idempotency_key]);
    const row=q.rows?.[0];if(!row)fail('IMPORT_RESERVATION_DISAPPEARED');
    if(row.selection_sha256!==intent.selection_sha256||row.customer_identity_hmac!==intent.customer_identity_hmac||
      row.total_rub!==intent.total_rub||row.line_count!==intent.line_count)return {status:'CONFLICT'};
    if(row.state==='ORDER_CREATED')return {status:'COMMITTED',provider_deal_number:row.provider_deal_number};
    if(row.state==='PROVIDER_OUTCOME_UNKNOWN'||row.state==='RECONCILIATION_REQUIRED')return {status:'OUTCOME_UNKNOWN'};
    return {status:'IN_PROGRESS'};
   });
  },
  async beginStep({intent,ownerToken,step}={}){
   if(!intent||!isHex(ownerToken,32)||!Number.isInteger(step)||step<0||step>1)fail('IMPORT_STEP_RESERVATION_INVALID');
   const from=step===0?'RESERVED':'STEP_0_CONFIRMED',to=step===0?'STEP_0_SUBMITTING':'STEP_1_SUBMITTING';
   const r=await pool.query("UPDATE bf2026_getcourse_import_ledger SET state=$4,current_step=$3,updated_at=now() WHERE scope='BF2026' AND checkout_idempotency_key=$1 AND lease_owner=$2 AND state=$5 AND current_step=$3",
    [intent.checkout_idempotency_key,ownerToken,step,to,from]);
   if(r.rowCount!==1)fail('IMPORT_STEP_NOT_RESERVED');
  },
  async markOutcomeUnknown({intent,ownerToken,step,errorCode}={}){
   if(!intent||!isHex(ownerToken,32)||!Number.isInteger(step)||step<0||step>1)fail('IMPORT_UNKNOWN_STATE_INVALID');
   const from=step===0?'STEP_0_SUBMITTING':'STEP_1_SUBMITTING';
   const r=await pool.query("UPDATE bf2026_getcourse_import_ledger SET state='PROVIDER_OUTCOME_UNKNOWN',last_error_code=$4,updated_at=now() WHERE scope='BF2026' AND checkout_idempotency_key=$1 AND lease_owner=$2 AND current_step=$3 AND state=$5",
    [intent.checkout_idempotency_key,ownerToken,step,String(errorCode||'UNKNOWN').slice(0,120),from]);
   if(r.rowCount!==1)fail('IMPORT_UNKNOWN_STATE_COMMIT_FAILED');
  },
  async commitStep({intent,ownerToken,step,verifiedResponse}={}){
   if(!intent||!isHex(ownerToken,32)||!Number.isInteger(step)||step<0||step>1||
    !verifiedResponse||!verifiedResponses.has(verifiedResponse)||verifiedResponse.step!==step)
    fail('VERIFIED_PROVIDER_RESPONSE_REQUIRED');
   return withTx(pool,async c=>{
    const q=await c.query("SELECT state,current_step,provider_deal_id,provider_deal_number,provider_user_id,first_response_sha256,final_response_sha256 FROM bf2026_getcourse_import_ledger WHERE scope='BF2026' AND checkout_idempotency_key=$1 FOR UPDATE",[intent.checkout_idempotency_key]);
    const row=q.rows?.[0];if(!row)fail('IMPORT_LEDGER_ROW_MISSING');
    if(step===0&&['STEP_0_CONFIRMED','STEP_1_SUBMITTING','ORDER_CREATED'].includes(row.state)){
     if(row.first_response_sha256===verifiedResponse.response_sha256)return {status:'REPLAY'};
     fail('IMPORT_STEP0_RESPONSE_CONFLICT');
    }
    if(step===1&&row.state==='ORDER_CREATED'){
     if(row.final_response_sha256===verifiedResponse.response_sha256)return {status:'REPLAY'};
     fail('IMPORT_STEP1_RESPONSE_CONFLICT');
    }
    const expected=step===0?'STEP_0_SUBMITTING':'STEP_1_SUBMITTING';
    if(row.state!==expected||row.current_step!==step)fail('IMPORT_STEP_STATE_MISMATCH');
    if(step===1&&(String(row.provider_deal_id)!==String(verifiedResponse.provider_deal_id)||
      row.provider_deal_number!==verifiedResponse.provider_deal_number||
      String(row.provider_user_id)!==String(verifiedResponse.provider_user_id)))fail('IMPORT_PROVIDER_ORDER_IDENTITY_MISMATCH');
    if(step===0){
     await c.query("UPDATE bf2026_getcourse_import_ledger SET state='STEP_0_CONFIRMED',current_step=1,provider_deal_id=$3,provider_deal_number=$4,provider_user_id=$5,first_response_sha256=$6,updated_at=now() WHERE scope='BF2026' AND checkout_idempotency_key=$1 AND lease_owner=$2",
      [intent.checkout_idempotency_key,ownerToken,verifiedResponse.provider_deal_id,verifiedResponse.provider_deal_number,verifiedResponse.provider_user_id,verifiedResponse.response_sha256]);
     return {status:'STEP_0_CONFIRMED',provider_deal_number:verifiedResponse.provider_deal_number};
    }
    if(!verifiedResponse.payment_link)fail('FINAL_PAYMENT_LINK_REQUIRED');
    await c.query("UPDATE bf2026_getcourse_import_ledger SET state='ORDER_CREATED',provider_deal_id=$3,provider_deal_number=$4,provider_user_id=$5,final_response_sha256=$6,payment_link_sha256=$7,updated_at=now() WHERE scope='BF2026' AND checkout_idempotency_key=$1 AND lease_owner=$2",
     [intent.checkout_idempotency_key,ownerToken,verifiedResponse.provider_deal_id,verifiedResponse.provider_deal_number,verifiedResponse.provider_user_id,verifiedResponse.response_sha256,sha256(verifiedResponse.payment_link)]);
    return {status:'ORDER_CREATED',provider_deal_number:verifiedResponse.provider_deal_number};
   });
  },
  async get(checkoutIdempotencyKey){
   const r=await pool.query("SELECT checkout_idempotency_key,selection_sha256,customer_identity_hmac,total_rub,line_count,state,current_step,provider_deal_id,provider_deal_number,provider_user_id,first_response_sha256,final_response_sha256,payment_link_sha256,last_error_code FROM bf2026_getcourse_import_ledger WHERE scope='BF2026' AND checkout_idempotency_key=$1",[checkoutIdempotencyKey]);
   return r.rows?.[0]||null;
  }
 };
}
module.exports={API_URL,createImportIntent,buildStepRequest,verifyImportApiResponse,createImportLedger,canonical,sha256};
