'use strict';
/**
 * BF2026 R124: true site checkout server route integration, STAGING QA ONLY.
 * Checks 10 existing native GetCourse widgets via the real R123 adapter +
 * actual quoteFn/checkoutKey and exact ID pairs, then writes idempotent
 * non-payable staging receipt/consent *contracts* to real PostgreSQL.
 * It NEVER calls GetCourse, never emits a payment URL, and never claims
 * customer checkbox input verifies provider-side consent.
 */
const crypto=require('node:crypto');
const {EXPECTED,examineSingle}=require('./r123-single-widget-adapter.cjs');
const PREFIX='/api/checkout/_qa/single-form/';
const CONSENT_FIELD=22204810;
const MAX_BYTES=1024;
const SAFE_ORIGIN='https://wf.tati-lar.ru';
const ID_RX=/^[a-f0-9]{32,64}$/;
const STATES=Object.freeze({
 hold:'HOLD_PROVIDER_CONSENT_RECEIPT_AND_ENTITLEMENTS',
 checkout_url:null,public_release_allowed:false,payment_verified:false,
 provider_consent_negative_test_verified:false,
 oferta_contract_version_verified:false,
 fiscal_receipt_verified:false,actual_grants_verified:false,
 customer_booking_confirmed:false,
 grant_writes:0,charge_writes:0,orders_created:0
});
function fail(code){let e=Error(code);e.code=code;throw e}
function exactKeys(obj,keys){
 return obj&&typeof obj==='object'&&!Array.isArray(obj)&&
  Object.keys(obj).sort().join('|')===[...keys].sort().join('|');
}
function strictConsent(c){
 if(!exactKeys(c,['oferta_custom_field_id','oferta_checkbox_checked','marketing_checkbox_checked']))
  fail('R124_CONSENT_SHAPE_INVALID');
 if(c.oferta_custom_field_id!==CONSENT_FIELD)
  fail('R124_CONSENT_NATIVE_FIELD_MISMATCH');
 if(c.oferta_checkbox_checked!==true)
  fail('R124_CONSENT_CHECKBOX_REQUIRED');
 if(c.marketing_checkbox_checked!==false)
  fail('R124_MARKETING_MUST_BE_UNCHECKED');
 // Checkbox assertion comes only from QA input, not native GetCourse.
 return {input_checkbox_checked:true,provider_side_consent_enforcement_verified:false};
}
function createSingleFormGate({stage,catalog,registry,quoteFn,checkoutKey,qaAuthorized,pool}={}){
 if(!stage?.stage_only||stage.public_release_allowed!==false||
  !stage.catalog||!stage.registry||!stage.plan||
  typeof quoteFn!=='function'||typeof checkoutKey!=='function'||
  typeof qaAuthorized!=='function')fail('R124_STAGE_ONLY_GATE_REQUIRED');
 if(!pool||typeof pool.query!=='function')fail('R124_POSTGRES_REQUIRED');
 const plan=stage.plan;
 if(plan.total_existing_form_bindings!==10||plan.needs_training_metadata!==0||
  plan.needs_multi_product_metadata!==0||
  registry?.rollout_enabled!==false||catalog?.release?.global_enabled!==false)
  fail('R124_STAGE_READINESS_PRECONDITION_FAILED');

 function validatedSelection(input){
  if(!exactKeys(input,input?.lot===9?['kind','lot','variant']:['kind','lot']))
   fail('R124_SELECTION_KEYS_INVALID');
  if(input.kind!=='single'||!Number.isInteger(input.lot))
   fail('R124_SINGLE_SELECTION_ONLY');
  let q;try{q=quoteFn(input)}catch{fail('R124_QUOTE_REJECTED')}
  const key=checkoutKey(q),expected=EXPECTED[key];
  if(!expected)fail('R124_NATIVE_FORM_NOT_ALLOWLISTED');
  if(q.kind!=='single'||q.count!==1||q.currency!=='RUB'||q.discount_percent!==0||
   q.total_rub!==expected.price||q.subtotal_rub!==expected.price||
   q.pricing_version!==stage.catalog.pricing_version||
   expected.lot!==input.lot&&expected.lot!==null||
   expected.lot===null&&(input.lot!==9||input.variant!=='2'))
   fail('R124_QUOTE_IDENTITY_MISMATCH');
  const mapping=examineSingle({catalog:stage.catalog,registry:stage.registry,key});
  if(!['MAPPING_COMPLETE_QA_ONLY','SERVICE_NO_TRAINING_QA_ONLY'].includes(mapping.status))
   fail('R124_MAPPING_INCOMPLETE');
  if(mapping.widget_id!==expected.widget_id||mapping.offer_id!==expected.offer_id||
   mapping.price_rub!==expected.price)
   fail('R124_NATIVE_BINDING_MISMATCH');
  const pairs=expected.pairs.map(([product_id,training_id])=>({product_id,training_id:training_id||null}));
  return Object.freeze({key,widget_id:expected.widget_id,offer_id:expected.offer_id,
   lot:input.lot,price_rub:q.total_rub,currency:'RUB',
   product_training_pairs:pairs,access_period:'AFTER_PAY_365_DAYS',
   fulfillment_type:expected.service?'3_ZOOM_SESSIONS_NO_TRAINING':'COURSE',
   ...STATES});
 }
 function publicRouteEligible(_key){
  // Consent + receipt + actual rights/Zoom fulfillment are unverified.
  // Never use QA checkbox assertions or registry metadata to bypass this.
  return false;
 }
 function respond(res,status,payload){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8',
   'cache-control':'no-store, private','x-content-type-options':'nosniff',
   'x-robots-tag':'noindex,nofollow','referrer-policy':'no-referrer'});
  res.end(JSON.stringify(payload));
 }
 async function handle(req,res,path){
  if(!path.startsWith(PREFIX))return respond(res,404,{ok:false,code:'NOT_FOUND'});
  if(!qaAuthorized(req))return respond(res,404,{ok:false,code:'NOT_FOUND'});
  if(req.headers.origin!==undefined&&req.headers.origin!==SAFE_ORIGIN)
   return respond(res,403,{ok:false,code:'ORIGIN_DENIED'});
  const action=path.slice(PREFIX.length);
  if(action==='status'&&req.method==='GET'){
   let dbReady=false;
   try{const q=await pool.query("SELECT to_regclass('public.bf2026_single_checkout_qa_intents') AS table_name");
    dbReady=!!q.rows?.[0]?.table_name}catch{}
   return respond(res,dbReady?200:503,{ok:true,route:'R124_SINGLE_STAGING_QA_ONLY',
    existing_native_forms:plan.total_existing_form_bindings,
    mapping_complete:plan.needs_training_metadata===0&&plan.needs_multi_product_metadata===0,
    postgres_ready:dbReady,consent_field_id:CONSENT_FIELD,...STATES});
  }
  if(action==='inspect'&&req.method==='GET'){
   const u=new URL(req.url,'http://localhost');
   if(u.searchParams.size!==1||!u.searchParams.has('route'))
    return respond(res,422,{ok:false,code:'R124_ONLY_ROUTE_ALLOWED',...STATES});
   const key=u.searchParams.get('route');
   const expected=EXPECTED[key];
   if(!expected)return respond(res,404,{ok:false,code:'R124_NATIVE_FORM_NOT_ALLOWLISTED',...STATES});
   let selection={kind:'single',lot:expected.lot===null?9:expected.lot};
   if(expected.lot===9||expected.lot===null)selection.variant=key==='single:source:2'?'2':'1';
   try{return respond(res,200,{ok:true,...validatedSelection(selection),
     native_widget_proof_status:'STRUCTURE_FROM_AUTHORIZED_NATIVE_READBACK_NOT_PAYMENT_PROOF',
     ...STATES});}
   catch(e){return respond(res,422,{ok:false,code:e.code||'R124_INSPECT_FAILED',...STATES});}
  }
  if(action!=='prepare'||req.method!=='POST')return respond(res,404,{ok:false,code:'NOT_FOUND'});
  if((req.headers['content-type']||'').split(';')[0].trim()!=='application/json')
   return respond(res,415,{ok:false,code:'APPLICATION_JSON_REQUIRED',...STATES});
  const requestKey=req.headers['x-bf2026-idempotency-key'];
  if(typeof requestKey!=='string'||!ID_RX.test(requestKey))
   return respond(res,422,{ok:false,code:'R124_IDEMPOTENCY_KEY_REQUIRED',...STATES});
  try{
   let size=0,parts=[];
   for await(const part of req){
    size+=part.length;
    if(size>MAX_BYTES)fail('R124_BODY_TOO_LARGE');
    parts.push(part);
   }
   const raw=Buffer.concat(parts).toString('utf8');
   const data=JSON.parse(raw);
   if(!exactKeys(data,['selection','consent']))fail('R124_REQUEST_FIELDS_INVALID');
   const consent=strictConsent(data.consent);
   const checked=validatedSelection(data.selection);
   const canonical=JSON.stringify({v:'R124_SITE_SINGLE_STAGE_V1',
    key:checked.key,offer_id:checked.offer_id,widget_id:checked.widget_id,
    price_rub:checked.price_rub,product_training_pairs:checked.product_training_pairs,
    selection:data.selection,consent_custom_field_id:CONSENT_FIELD,
    consent_input_checked:consent.input_checkbox_checked,
    marketing_unchecked:data.consent.marketing_checkbox_checked===false});
   const digest=crypto.createHash('sha256').update(canonical).digest('hex');
   const insert=await pool.query(
    "INSERT INTO bf2026_single_checkout_qa_intents(request_key,payload_sha256,route_key,widget_id,offer_id,quote_rub,product_count,consent_input_checked,marketing_input_unchecked,state) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,true,true,'HOLD_PROVIDER_CONSENT_RECEIPT_AND_ENTITLEMENTS') "+
    "ON CONFLICT (request_key) DO NOTHING RETURNING request_key",
    [requestKey,digest,checked.key,checked.widget_id,checked.offer_id,
     checked.price_rub,checked.product_training_pairs.length]);
   const row=await pool.query(
    'SELECT payload_sha256,route_key,widget_id,offer_id,quote_rub,state FROM bf2026_single_checkout_qa_intents WHERE request_key=$1',
    [requestKey]);
   const saved=row.rows?.[0];
   if(!saved)fail('R124_LEDGER_ROW_MISSING');
   if(saved.payload_sha256!==digest)
    return respond(res,409,{ok:false,code:'R124_IDEMPOTENCY_PAYLOAD_CONFLICT',...STATES});
   return respond(res,202,{ok:true,duplicate:insert.rowCount===0,
    route_key:checked.key,widget_id:checked.widget_id,offer_id:checked.offer_id,
    price_rub:checked.price_rub,product_training_pairs:checked.product_training_pairs,
    consent_input_checked:true,provider_side_consent_enforcement_verified:false,
    legal_negative_submit_verified:false,receipt_contract:'PROVIDER_FISCAL_RECEIPT_REQUIRED',
    rights_contract:checked.fulfillment_type==='COURSE'?'NATIVE_PURCHASE_TRAINING_READBACK_REQUIRED':'THREE_ZOOM_BOOKINGS_REQUIRED',
    state:saved.state,...STATES});
  }catch(e){
   return respond(res,422,{ok:false,
    code:typeof e?.code==='string'&&/^R124_[A-Z0-9_]+$/.test(e.code)?e.code:'R124_INVALID_REQUEST',
    ...STATES});
  }
 }
 return Object.freeze({handle,validatedSelection,publicRouteEligible,
  plan,stage_only:true,contract:STATES});
}
module.exports={PREFIX,CONSENT_FIELD,STATES,createSingleFormGate,strictConsent};
