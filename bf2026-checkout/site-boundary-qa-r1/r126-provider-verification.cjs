'use strict';
/* BF2026 R126: read-only native provider verification handoff.
 * Consumes ONLY existing R123 server-created PostgreSQL Export evidence
 * and an OPTIONAL independently trusted native-observer interface.
 * No arbitrary HTTP proof uploads. Never creates orders or grants.
 */
const {DEFAULTS,EXPECTED_PRODUCT_TRAINING}=require('./getcourse-export-readback.cjs');
const {SUBJECT_SHA}=require('./r123-readback-once.cjs');
const {EXPECTED,examineSingle}=require('./r123-single-widget-adapter.cjs');
const ROUTE_KEYS=Object.freeze(Object.keys(EXPECTED));
const SUBJECT=Object.freeze({
 account_host:DEFAULTS.host,qa_user_id:Number(DEFAULTS.userId),
 order_number:DEFAULTS.orderNumber,deal_id:DEFAULTS.dealId,
 offer_id:DEFAULTS.offerId,amount_rub:DEFAULTS.amountRub,
 products:EXPECTED_PRODUCT_TRAINING
});
const REQUIREMENTS=Object.freeze([
 'GETCOURSE_EXPORT_ORDER_IDENTITY','GETCOURSE_EXPORT_ACCEPTED_PAYMENT',
 'FISCAL_RECEIPT_INDEPENDENT_NATIVE_READBACK',
 'TWO_INDEPENDENT_NATIVE_PURCHASE_GRANTS',
 'PROVIDER_SIDE_UNCHECKED_CONSENT_REFUSAL',
 'OWNER_APPROVED_RELEASE'
]);
const HELD=Object.freeze({receipt_verified:false,actual_grants_verified:false,
 provider_side_unchecked_consent_verified:false,owner_release_approved:false,
 provider_cryptographic_signature_verified:false,
 payment_verified:false,public_release_allowed:false,checkout_url:null,
 order_writes:0,payment_writes:0,grant_writes:0});
const CODE_RX=/^[A-Z0-9_]{3,100}$/;
function error(code){const e=new Error(code);e.code=code;throw e}
function safeResult(result){
 if(!result||typeof result!=='object'||Array.isArray(result))error('R126_PROVIDER_LEDGER_BAD_RESULT');
 const state=result.state;
 const allowed=new Set(['VERIFIED_UNPAID_ORDER','PAYMENT_RECORD_MATCHED',
  'PARTIAL_PRODUCT_MAPPING_UNAVAILABLE','PARTIAL_ORDER_STATE',
  'PARTIAL_UNPAID_WITHOUT_ZERO_PAYMENT_READBACK',
  'PAID_ORDER_PAYMENT_DATE_MISSING','PAID_ORDER_PAYMENT_DATE_UNPARSEABLE',
  'PENDING_DEALS_EXPORT','PENDING_PAYMENTS_EXPORT']);
 if(!allowed.has(state))error('R126_PROVIDER_LEDGER_UNRECOGNIZED_STATE');
 if(result.source!=='GETCOURSE_EXPORT_API_READONLY')
  error('R126_PROVIDER_LEDGER_WRONG_SOURCE');
 if(String(result.deal_id)!==SUBJECT.deal_id||
    String(result.order_number)!==SUBJECT.order_number||
    result.offer_id!==SUBJECT.offer_id||
    result.order_total_rub!==SUBJECT.amount_rub)
  error('R126_PROVIDER_LEDGER_WRONG_ORDER_IDENTITY');
 const paid=state==='PAYMENT_RECORD_MATCHED';
 if(paid&&(result.payment_record_verified!==true||
  result.product_identity_verified!==true||
  result.order_status!=='payed'||
  result.paid_total_rub!==SUBJECT.amount_rub||
  result.payment_status!=='accepted'||
  result.payment_amount_rub!==SUBJECT.amount_rub||
  !/^\d{4}-\d\d-\d\d/.test(String(result.payed_at||''))||
  !String(result.payment_id||'')))
  error('R126_PROVIDER_PAID_LEDGER_INCOMPLETE');
 if(state==='VERIFIED_UNPAID_ORDER'&&(
  result.order_status!=='new'||result.paid_total_rub!==0||
  result.product_identity_verified!==true))
  error('R126_PROVIDER_UNPAID_LEDGER_INCOMPLETE');
 return Object.freeze({
  export_state:state,
  export_order_identity_verified:paid||state==='VERIFIED_UNPAID_ORDER',
  export_accepted_payment_verified:paid,
  export_product_pair_identity_verified:result.product_identity_verified===true,
  export_payment_proof_id_present:paid,
  observed_payed_at:paid?String(result.payed_at):null,
  ...HELD
 });
}
function routeGate({key,stage,globalFlag=false,routeFlags={}}={}){
 if(typeof key!=='string'||!ROUTE_KEYS.includes(key))error('R126_CTA_NOT_APPROVED');
 if(!stage?.stage_only||stage.public_release_allowed!==false||
   stage.registry?.rollout_enabled!==false||
   stage.catalog?.release?.global_enabled!==false)
  error('R126_SITE_STAGE_IDENTITY_MISSING');
 const evidence=examineSingle({catalog:stage.catalog,registry:stage.registry,key});
 if(!['MAPPING_COMPLETE_QA_ONLY','SERVICE_NO_TRAINING_QA_ONLY'].includes(evidence.status))
  error('R126_CTA_PRODUCT_TRAINING_UNPROVEN');
 const expected=EXPECTED[key];
 if(evidence.offer_id!==expected.offer_id||evidence.widget_id!==expected.widget_id||
  evidence.price_rub!==expected.price)error('R126_CTA_OFFER_PRICE_MISMATCH');
 const enabled=globalFlag===true&&routeFlags[key]===true;
 return Object.freeze({
  route_key:key,offer_id:expected.offer_id,widget_id:expected.widget_id,
  amount_rub:expected.price,
  product_training_pairs:expected.pairs.map(([product_id,training_id])=>({product_id,training_id:training_id||null})),
  native_widget_identity_verified:true,configured_feature_enabled:enabled,
  independent_native_receipt_proof_ready:false,
  independent_native_grant_proof_ready:false,
  provider_side_consent_negative_test_ready:false,
  reason:enabled?'HOLD_NATIVE_RECEIPT_GRANTS_CONSENT_EVIDENCE_MISSING':'HOLD_FEATURE_DISABLED',
  ...HELD
 });
}
function strictConfig({env=process.env}={}){
 if(!env||typeof env!=='object')error('R126_CONFIG_REQUIRED');
 const globalFlag=env.BF2026_R126_PROVIDER_VERIFY_ENABLED==='1';
 const nativeObserverFlag=env.BF2026_R126_NATIVE_OBSERVER_ENABLED==='1';
 // No ambiguous flags or partial "yes": enablement must be explicit string "1".
 for(const name of ['BF2026_R126_PROVIDER_VERIFY_ENABLED','BF2026_R126_NATIVE_OBSERVER_ENABLED'])
  if(env[name]!==undefined&&!['0','1'].includes(env[name]))error('R126_CONFIG_FLAG_INVALID');
 const routeFlags={};
 const declared=String(env.BF2026_R126_CTA_KEYS||'');
 if(declared&&!/^single:[a-z_0-9:]+(?:,single:[a-z_0-9:]+)*$/.test(declared))
  error('R126_CONFIG_CTA_KEYS_INVALID');
 for(const k of declared.split(',').filter(Boolean)){
  if(!ROUTE_KEYS.includes(k)||routeFlags[k])error('R126_CONFIG_CTA_KEY_NOT_APPROVED');
  routeFlags[k]=true;
 }
 if(nativeObserverFlag&&!globalFlag)error('R126_OBSERVER_REQUIRES_GLOBAL_VERIFY_FLAG');
 return Object.freeze({globalFlag,nativeObserverFlag,routeFlags,
  exportSecretPathConfigured:Boolean(env.BF2026_GETCOURSE_SECRET_FILE),
  readOnlyKeyRequired:true});
}
function createProviderVerification({pool,stage,env=process.env,
 readOnce=null,observer=null,clock=()=>Date.now()}={}){
 if(typeof pool?.query!=='function'||!stage?.stage_only)error('R126_PG_STAGE_REQUIRED');
 const config=strictConfig({env});
 if(observer!==null&&(
  typeof observer?.readFiscallyRegisteredReceipt!=='function'||
  typeof observer?.readPurchaseGrants!=='function'||
  typeof observer?.verifyIndependentOrigin!=='function'))
  error('R126_OBSERVER_CONTRACT_INCOMPLETE');
 async function readStoredExport(){
  let q;
  try{q=await pool.query(
   "SELECT state,subject_sha256,result,created_at FROM bf2026_getcourse_readback_once "+
   "WHERE subject_sha256=$1 ORDER BY created_at DESC LIMIT 1",[SUBJECT_SHA]);}
  catch{return Object.freeze({state:'HOLD_POSTGRES_UNAVAILABLE',evidence_present:false,...HELD})}
  if(!q.rows?.length)return Object.freeze({
   state:'HOLD_NO_NATIVE_GETCOURSE_EXPORT',evidence_present:false,...HELD
  });
  const row=q.rows[0];
  if(row.subject_sha256!==SUBJECT_SHA||row.state!=='DONE')
   return Object.freeze({state:'HOLD_INCOMPLETE_NATIVE_EXPORT_READBACK',
    evidence_present:false,...HELD});
  try{
   const verified=safeResult(row.result);
   return Object.freeze({state:'HOLD_RECEIPT_AND_ACCESS_NOT_VERIFIED',
    evidence_present:true,...verified,...HELD});
  }catch(e){
   return Object.freeze({state:'HOLD_UNTRUSTED_NATIVE_EXPORT_LEDGER',
    reason_code:CODE_RX.test(e.code)?e.code:'R126_INVALID_EVIDENCE',
    evidence_present:false,...HELD});
  }
 }
 async function bundle(){
  const native=await readStoredExport();
  let state=native.state;
  const missing=[...REQUIREMENTS];
  // A GetCourse Export payment export is NOT an actual fiscal receipt or
  // a Purchase-to-Training native entitlement readback.
  if(native.export_order_identity_verified===true)missing.splice(missing.indexOf(REQUIREMENTS[0]),1);
  if(native.export_accepted_payment_verified===true)missing.splice(missing.indexOf(REQUIREMENTS[1]),1);
  if(!config.globalFlag||!config.exportSecretPathConfigured)
   state='HOLD_NATIVE_READBACK_FEATURE_OR_SECRET_DISABLED';
  // Never invoke a native observer merely because a caller supplied data.
  // A configured, owner-approved observer must attest its own actual
  // authenticated GetCourse session and separately read each native object.
  if(config.nativeObserverFlag&&observer&&native.export_accepted_payment_verified===true){
   try{
    const attestation=await observer.verifyIndependentOrigin(SUBJECT);
    if(attestation?.approved_read_only_observer!==true||
       attestation?.server_authenticated!==true||
       attestation?.source_account_host!==SUBJECT.account_host)
      error('R126_OBSERVER_ORIGIN_NOT_ATTESTED');
    // The adapters are called only after genuine stored paid Export readback.
    const [receipt,grants]=await Promise.all([
     observer.readFiscallyRegisteredReceipt(SUBJECT),
     observer.readPurchaseGrants(SUBJECT)
    ]);
    const check=validateNativeReceiptAndGrants({receipt,grants,
     subject:{...SUBJECT,payed_at:native.observed_payed_at},clock});
    return Object.freeze({state:'HOLD_CONSENT_AND_OWNER_RELEASE_NOT_VERIFIED',
     evidence_present:native.evidence_present,
     export_order_identity_verified:native.export_order_identity_verified,
     export_accepted_payment_verified:native.export_accepted_payment_verified,
     independently_attested_receipt_structure:check.receiptExact,
     independently_attested_grants_structure:check.grantsExact,
     independent_observer_origin_verified:true,
     missing_requirements:[REQUIREMENTS[4],REQUIREMENTS[5]],
     ...HELD});
   }catch(e){
    state='HOLD_APPROVED_NATIVE_OBSERVER_EVIDENCE_INVALID';
   }
  }
  return Object.freeze({state,evidence_present:native.evidence_present,
   export_order_identity_verified:native.export_order_identity_verified===true,
   export_accepted_payment_verified:native.export_accepted_payment_verified===true,
   independently_attested_receipt_structure:false,
   independently_attested_grants_structure:false,
   independent_observer_origin_verified:false,
   missing_requirements:missing,...HELD});
 }
 async function status(){
  const source=await readStoredExport();
  let dbReady=false;
  try{
   const r=await pool.query("SELECT to_regclass('public.bf2026_getcourse_readback_once') AS t");
   dbReady=Boolean(r.rows?.[0]?.t);
  }catch{}
  return Object.freeze({
   route:'R126_PROVIDER_VERIFY_QA_ONLY',
   configured_feature_enabled:config.globalFlag,
   configured_native_observer_enabled:config.nativeObserverFlag,
   configured_read_only_secret_file:config.exportSecretPathConfigured,
   provider_reader_connected:false, // Wired does not attest real provider/key connectivity.
   provider_adapter_wired:typeof readOnce==='function',
   postgres_ledger_ready:dbReady,
   export_readback_available:source.evidence_present===true,
   native_export_status:source.state,
   official_export_supported_objects:['users','groups','deals','payments'],
   fiscal_receipt_native_provider_ready:false,
   two_native_grants_provider_ready:false,
   cta_feature_keys_enabled:ROUTE_KEYS.filter(k=>config.routeFlags[k]===true),
   cta_total:ROUTE_KEYS.length,...HELD
  });
 }
 async function refreshOnce(requestKey){
  if(!config.globalFlag||!config.exportSecretPathConfigured||typeof readOnce!=='function')
   return Object.freeze({state:'HOLD_GETCOURSE_READONLY_PROVIDER_UNCONFIGURED',...HELD});
  if(typeof requestKey!=='string'||!/^[a-f0-9]{32,64}$/.test(requestKey))
   error('R126_IDEMPOTENCY_KEY_REQUIRED');
  const v=await readOnce(requestKey);
  // Existing R123 readOnce is the ONLY mechanism performing real GET Export
  // with PG 70/2h budget. Here we never call Import or payment endpoints.
  return Object.freeze({state:'HOLD_RECEIPT_AND_ACCESS_NOT_VERIFIED',
   export_readback_state:String(v.state||'').slice(0,100),
   duplicate:v.duplicate===true,...HELD});
 }
 return Object.freeze({
  status,bundle,readStoredExport,
  route:(key)=>routeGate({key,stage,globalFlag:config.globalFlag,routeFlags:config.routeFlags}),
  routes:()=>ROUTE_KEYS.map(key=>routeGate({key,stage,globalFlag:config.globalFlag,routeFlags:config.routeFlags})),
  refreshOnce,config
 });
}
function validateNativeReceiptAndGrants({receipt,grants,subject=SUBJECT,clock=()=>Date.now()}={}){
 // Check independent observer schema rigorously even when its transport is
 // owner-authorized. Schema checks do not authenticate an arbitrary object.
 if(!receipt||receipt.account_host!==subject.account_host||
   String(receipt.qa_user_id)!==String(subject.qa_user_id)||
   String(receipt.order_number)!==subject.order_number||
   String(receipt.deal_id)!==subject.deal_id||
   receipt.offer_id!==subject.offer_id||
   receipt.fiscal_status!=='registered'||receipt.operation!=='income'||
   receipt.amount_rub!==subject.amount_rub||
   typeof receipt.fiscal_receipt_number!=='string'||
   !/^[A-Za-z0-9._/-]{6,128}$/.test(receipt.fiscal_receipt_number)||
   receipt.refunded!==false)
  error('R126_NATIVE_FISCAL_RECEIPT_IDENTITY_INVALID');
 const paidAt=Date.parse(subject.payed_at);
 const fiscalAt=Date.parse(receipt.fiscalized_at);
 if(!Number.isFinite(paidAt)||!Number.isFinite(fiscalAt)||
    fiscalAt<paidAt-24*3600_000||fiscalAt>clock()+300_000)
  error('R126_NATIVE_RECEIPT_NOT_LINKED_TO_REAL_PAYMENT_TIME');
 if(!Array.isArray(grants)||grants.length!==2)
  error('R126_NATIVE_PURCHASE_GRANTS_NOT_EXACTLY_TWO');
 const uniq=new Set();
 for(const g of grants){
  if(!g||g.account_host!==subject.account_host||
   String(g.qa_user_id)!==String(subject.qa_user_id)||
   String(g.deal_id)!==subject.deal_id||
   String(g.order_number)!==subject.order_number||
   g.offer_id!==subject.offer_id||g.state!=='active'||
   !Number.isSafeInteger(g.product_id)||!Number.isSafeInteger(g.training_id)||
   typeof g.purchase_id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(g.purchase_id)||
   g.access_days_from_payment!==365||g.access_origin!=='after_pay')
   error('R126_NATIVE_GRANT_IDENTITY_INVALID');
  const pair=subject.products.find(p=>p.product_id===g.product_id&&p.training_id===g.training_id);
  if(!pair||uniq.has(g.product_id))error('R126_NATIVE_GRANT_PRODUCT_TRAINING_MISMATCH');
  uniq.add(g.product_id);
  const start=Date.parse(g.access_start),end=Date.parse(g.access_end);
  if(!Number.isFinite(start)||!Number.isFinite(end)||
    end<=start||Math.abs((end-start)/86400000-365)>1.1||
    Math.abs(start-paidAt)>36*3600_000||
    Math.abs(end-(paidAt+365*86400000))>36*3600_000||
    end<clock()||!Number.isFinite(clock()))
   error('R126_NATIVE_GRANT_365_DAY_WINDOW_INVALID');
 }
 if(uniq.size!==2)error('R126_NATIVE_GRANTS_INCOMPLETE');
 return {receiptExact:true,grantsExact:true};
}
module.exports={SUBJECT,REQUIREMENTS,ROUTE_KEYS,HELD,strictConfig,safeResult,
 validateNativeReceiptAndGrants,routeGate,createProviderVerification};
