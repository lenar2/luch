'use strict';
/* BF2026 R127 server-side consent correlation boundary.
 * Client checkbox / JS / R124 input assertion are NEVER consent evidence.
 * A documented GetCourse process "Call URL" can report an existing order;
 * its bearer header is a shared secret, NOT a GetCourse digital signature.
 * Without a separately verified native consent observer and provider-side
 * unchecked-submit negative test, every matched order remains HOLD.
 */
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {EXPECTED}=require('./r123-single-widget-adapter.cjs');
const ROUTE_KEYS=Object.freeze(Object.keys(EXPECTED));
const {DEFAULTS}=require('./getcourse-export-readback.cjs');
const COOKIE='__Host-bf2026_consent_session';
const SESSION_TTL_SECONDS=1200;
const CHALLENGE_TTL_MS=10*60*1000;
const CALLBACK_GRACE_MS=5*60*1000;
const ALLOWED_KEYS=Object.freeze([
 'deal_id','deal_number','user_id','offers','cost_money_value',
 'status','created_at','consent_nonce','offer_revision_sha256'
]);
function fail(code){const e=Error(code);e.code=code;throw e}
function sha(value){return crypto.createHash('sha256').update(value).digest('hex')}
function exactKeys(obj,keys){
 return !!obj&&typeof obj==='object'&&!Array.isArray(obj)&&
  Object.keys(obj).sort().join('|')===[...keys].sort().join('|');
}
function canonical(value){return JSON.stringify(value)}
function isHex64(v){return typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)}
function validToken(v){return typeof v==='string'&&/^[A-Za-z0-9_-]{40,100}$/.test(v)}
function validDate(v){
 if(typeof v!=='string'||! /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(v))return null;
 const n=Date.parse(v);return Number.isFinite(n)?new Date(n):null;
}
function parseOffers(v){
 let a;
 if(Array.isArray(v))a=v;
 else if(typeof v==='string')a=v.split(',').map(x=>x.trim());
 else return null;
 if(a.length!==1)return null;
 const n=Number(a[0]);
 return Number.isSafeInteger(n)&&n>0?[n]:null;
}
function parseRub(v){
 if(typeof v==='number')return Number.isSafeInteger(v)&&v>0?v:null;
 if(typeof v==='string'&&/^[0-9]{1,9}$/.test(v))return Number(v);
 return null;
}
function validateRevisionManifest(manifest,{allowTestFixture=false}={}){
 const trustedSource=manifest?.source==='OWNER_APPROVED_NATIVE_OFFER_REVISION_READBACK'
  ?manifest.signature_verified===true
  :(allowTestFixture&&manifest?.source==='TEST_FIXTURE_ONLY');
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||
  manifest.schema!=='bf2026.r127.offer-revisions.v1'||manifest.approved!==true||
  !trustedSource||!manifest.offers||typeof manifest.offers!=='object'||Array.isArray(manifest.offers))
  return Object.freeze({});
 const out={};
 for(const [key,row] of Object.entries(manifest.offers)){
  if(!ROUTE_KEYS.includes(key)||!row||typeof row!=='object'||
   row.offer_id!==EXPECTED[key].offer_id||!isHex64(row.revision_sha256)||
   row.native_readback_verified!==true)continue;
  out[key]=Object.freeze({offer_id:row.offer_id,revision_sha256:row.revision_sha256});
 }
 return Object.freeze(out);
}
function readOwnerPrivateFile(filePath,{maxBytes=16384,uid=process.getuid?.()}={}){
 if(typeof uid!=='number'||typeof filePath!=='string'||!path.isAbsolute(filePath)||
  path.dirname(filePath)!=='/srv/factory-scratch/bf2026-r118-relay-stage-20261119/private-credentials')
  return null;
 try{
  const dir=fs.lstatSync(path.dirname(filePath)),st=fs.lstatSync(filePath);
  if(!dir.isDirectory()||dir.isSymbolicLink()||dir.uid!==uid||(dir.mode&0o022)!==0||
   !st.isFile()||st.isSymbolicLink()||st.uid!==uid||(st.mode&0o077)!==0||
   st.size<1||st.size>maxBytes||fs.realpathSync(filePath)!==filePath)return null;
  return fs.readFileSync(filePath,'utf8');
 }catch{return null}
}
function loadRevisionManifest(env=process.env){
 try{return require('./r127-signed-revision-manifest.cjs').loadSignedRevisionManifest(env)}
 catch{return null}
}
function loadCallbackSecret(env=process.env){
 const raw=readOwnerPrivateFile(env.BF2026_R127_CALLBACK_SECRET_FILE,{maxBytes:4096});
 const secret=raw?.trim();
 return secret&&secret.length>=32&&secret.length<=1024?secret:null;
}
function validNativeConsentAttestation(a,{callback,challenge,now=Date.now()}={}){
 if(!a||typeof a!=='object'||Array.isArray(a))return null;
 if(a.schema!=='bf2026.r127.provider-consent-attestation.v1'||
  a.source!=='GETCOURSE_NATIVE_SYSTEM_OFFER_CONSENT_READBACK'||
  a.account_host!==DEFAULTS.host||
  String(a.deal_id)!==callback.deal_id||
  String(a.deal_number)!==callback.deal_number||
  a.offer_id!==challenge.offer_id||
  a.offer_revision_sha256!==challenge.offer_revision_sha256||
  a.native_consent_scope!=='SYSTEM_OFFER_CHECKBOX'||
  a.native_consent_accepted!==true||
  a.native_field_22204810_used_as_proof!==false||
  a.provider_negative_test?.source!=='GETCOURSE_NATIVE_UNCHECKED_SUBMIT_TEST'||
  a.provider_negative_test?.result!=='REJECTED_BEFORE_ORDER_CREATION'||
  !isHex64(a.provider_negative_test?.report_sha256))return null;
 const observed=validDate(a.observed_at);
 const negativeAt=validDate(a.provider_negative_test.observed_at);
 if(!observed||!negativeAt||observed.getTime()>now+300000||
  now-observed.getTime()>30*86400000||negativeAt.getTime()>now+300000||
  now-negativeAt.getTime()>30*86400000)return null;
 return Object.freeze({source:a.source,negativeTestSha256:a.provider_negative_test.report_sha256});
}
function createConsentBoundary({
 pool,stage,revisionManifest=null,callbackSecret=null,
 nativeConsentVerifier=null,callbackGuard=null,clock=()=>Date.now(),allowTestRevisionFixture=false
}={}){
 if(typeof pool?.query!=='function'||!stage?.stage_only)fail('R127_STAGE_POSTGRES_REQUIRED');
 if(callbackSecret!==null&&(typeof callbackSecret!=='string'||callbackSecret.length<32))
  fail('R127_CALLBACK_SECRET_INVALID');
 if(nativeConsentVerifier!==null&&typeof nativeConsentVerifier?.verify!=='function')
  fail('R127_NATIVE_CONSENT_VERIFIER_INVALID');
 if(callbackGuard!==null&&typeof callbackGuard!=='function')
  fail('R127_VERSIONED_MANIFEST_CALLBACK_GUARD_INVALID');
 const revisions=validateRevisionManifest(revisionManifest,{allowTestFixture:allowTestRevisionFixture});
 const callbackSecretHash=callbackSecret?sha(callbackSecret):null;
 function offerFor(key){
  if(!ROUTE_KEYS.includes(key))fail('R127_ROUTE_NOT_ALLOWLISTED');
  const expected=EXPECTED[key],revision=revisions[key];
  if(!revision||revision.offer_id!==expected.offer_id)
   fail('R127_OFFER_REVISION_NOT_OWNER_VERIFIED');
  return {key,expected,revision};
 }
 async function issueChallenge({routeKey,sessionToken,manifestBinding=null}={}){
  if(!validToken(sessionToken))fail('R127_HTTP_ONLY_SESSION_REQUIRED');
  const {key,expected,revision}=offerFor(routeKey);
  if(manifestBinding!==null&&(!exactKeys(manifestBinding,[
   'registry_scope','manifest_version','manifest_sha256','site_entry_key','revision_sha256'
  ])||!['BF2026_SITE','BF2026_R130_TEST'].includes(manifestBinding.registry_scope)||
   !Number.isSafeInteger(manifestBinding.manifest_version)||manifestBinding.manifest_version<1||
   !isHex64(manifestBinding.manifest_sha256)||manifestBinding.site_entry_key!==key||
   manifestBinding.revision_sha256!==revision.revision_sha256))
   fail('R127_VERSIONED_MANIFEST_BINDING_INVALID');
  const now=clock(),nonce=crypto.randomBytes(32).toString('base64url');
  const issued=new Date(now),expires=new Date(now+CHALLENGE_TTL_MS);
  const sessionHash=sha(sessionToken),nonceHash=sha(nonce);
  const pricingVersion=String(stage.catalog?.pricing_version||'');
  if(!pricingVersion)fail('R127_PRICING_VERSION_MISSING');
  if(manifestBinding){
   await pool.query(
    "INSERT INTO bf2026_r127_consent_challenges "+
    "(nonce_sha256,session_sha256,route_key,offer_id,widget_id,amount_rub,pricing_version,offer_revision_sha256,issued_at,expires_at,state,"+
    "r130_registry_scope,r130_manifest_version,r130_manifest_sha256,r130_site_entry_key) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING',$11,$12,$13,$14)",
    [nonceHash,sessionHash,key,expected.offer_id,expected.widget_id,expected.price,
     pricingVersion,revision.revision_sha256,issued.toISOString(),expires.toISOString(),
     manifestBinding.registry_scope,manifestBinding.manifest_version,
     manifestBinding.manifest_sha256,manifestBinding.site_entry_key]);
  }else{
   await pool.query(
    "INSERT INTO bf2026_r127_consent_challenges "+
    "(nonce_sha256,session_sha256,route_key,offer_id,widget_id,amount_rub,pricing_version,offer_revision_sha256,issued_at,expires_at,state) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING')",
    [nonceHash,sessionHash,key,expected.offer_id,expected.widget_id,expected.price,
     pricingVersion,revision.revision_sha256,issued.toISOString(),expires.toISOString()]);
  }
  return Object.freeze({state:'PENDING_PROVIDER_ORDER_CALLBACK',
   route_key:key,offer_id:expected.offer_id,widget_id:expected.widget_id,
   amount_rub:expected.price,currency:'RUB',pricing_version:pricingVersion,
   offer_revision_sha256:revision.revision_sha256,
   nonce,issued_at:issued.toISOString(),expires_at:expires.toISOString(),
   nonce_is_single_use:true,client_checkbox_is_not_evidence:true,
   provider_consent_verified:false,public_release_allowed:false});
 }
 function callbackAuthMatches(supplied){
  if(!callbackSecret||typeof supplied!=='string')return false;
  const a=Buffer.from(supplied),b=Buffer.from(callbackSecret);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
 }
 async function receiveProviderOrderCallback({authorization,body}={}){
  if(!callbackAuthMatches(authorization))fail('R127_PROVIDER_CALLBACK_AUTH_FAILED');
  if(!exactKeys(body,ALLOWED_KEYS))fail('R127_PROVIDER_CALLBACK_SHAPE_INVALID');
  const dealId=String(body.deal_id??''),dealNumber=String(body.deal_number??''),
   userId=String(body.user_id??''),offers=parseOffers(body.offers),
   amount=parseRub(body.cost_money_value),createdAt=validDate(body.created_at),
   nonce=body.consent_nonce,revisionSha=body.offer_revision_sha256;
  if(!/^[0-9]{1,32}$/.test(dealId)||!/^[0-9]{1,32}$/.test(dealNumber)||
   !/^[0-9]{1,32}$/.test(userId)||!offers||!amount||!createdAt||
   body.status!=='new'||!validToken(nonce)||!isHex64(revisionSha))
   fail('R127_PROVIDER_CALLBACK_ORDER_FIELDS_INVALID');
  const normalized={deal_id:dealId,deal_number:dealNumber,user_id:userId,
   offers,cost_money_value:amount,status:'new',created_at:createdAt.toISOString(),
   consent_nonce:nonce,offer_revision_sha256:revisionSha};
  const digest=sha(canonical(normalized)),nonceHash=sha(nonce),receivedAt=clock();
  const client=typeof pool.connect==='function'?await pool.connect():null;
  if(!client)fail('R127_POSTGRES_TRANSACTION_REQUIRED');
  let transaction=false;
  try{
   await client.query('BEGIN');transaction=true;
   const q=await client.query(
    'SELECT * FROM bf2026_r127_consent_challenges WHERE nonce_sha256=$1 FOR UPDATE',[nonceHash]);
   const row=q.rows?.[0];
   if(!row)fail('R127_NONCE_UNKNOWN_OR_REPLAYED');
   if(callbackGuard)await callbackGuard({client,row,callback:normalized,
    nonceHash,receivedAt});
   if(row.state!=='PENDING'){
    if(row.provider_callback_sha256===digest&&row.provider_order_id===dealId){
     await client.query('COMMIT');transaction=false;
     return Object.freeze({state:row.state,duplicate:true,
      provider_order_matched:true,provider_consent_verified:row.native_consent_verified===true,
      provider_signature_verified:false,public_release_allowed:false});
    }
    fail('R127_NONCE_ALREADY_CONSUMED');
   }
   const expected=EXPECTED[row.route_key];
   if(!expected||Number(row.offer_id)!==expected.offer_id||
    offers.length!==1||offers[0]!==expected.offer_id||
    amount!==expected.price||revisionSha!==row.offer_revision_sha256)
    fail('R127_PROVIDER_ORDER_OFFER_OR_REVISION_MISMATCH');
   const issued=Date.parse(row.issued_at),expires=Date.parse(row.expires_at),
    providerCreated=createdAt.getTime();
   if(!Number.isFinite(issued)||!Number.isFinite(expires)||
    providerCreated<issued-30000||providerCreated>expires||
    providerCreated>receivedAt+60000||
    receivedAt>expires+CALLBACK_GRACE_MS||receivedAt<issued-30000)
    fail('R127_PROVIDER_ORDER_OUTSIDE_CHALLENGE_WINDOW');
   const attestation=nativeConsentVerifier?
    await nativeConsentVerifier.verify({callback:normalized,challenge:{
     route_key:row.route_key,offer_id:expected.offer_id,widget_id:expected.widget_id,
     offer_revision_sha256:row.offer_revision_sha256,issued_at:row.issued_at,
     expires_at:row.expires_at
    }}):null;
   const native=validNativeConsentAttestation(attestation,{callback:normalized,
    challenge:{offer_id:expected.offer_id,offer_revision_sha256:row.offer_revision_sha256},
    now:receivedAt});
   const next=native?'PROVIDER_CONSENT_VERIFIED_HOLD_OTHER_GATES':'ORDER_CALLBACK_MATCHED_HOLD';
   await client.query(
    "UPDATE bf2026_r127_consent_challenges SET state=$2,provider_order_id=$3,"+
    "provider_order_number=$4,provider_user_id=$5,provider_offer_ids=$6,provider_amount_rub=$7,"+
    "provider_order_status='new',provider_order_created_at=$8,provider_callback_received_at=$9,"+
    "provider_callback_sha256=$10,provider_callback_auth='GETCOURSE_PROCESS_BEARER_SHARED_SECRET',"+
    "native_consent_verified=$11,native_consent_source=$12,native_negative_test_sha256=$13,"+
    "public_release_allowed=false,updated_at=now() WHERE nonce_sha256=$1",
    [nonceHash,next,dealId,dealNumber,userId,offers,amount,createdAt.toISOString(),
     new Date(receivedAt).toISOString(),digest,Boolean(native),native?.source||null,
     native?.negativeTestSha256||null]);
   await client.query('COMMIT');transaction=false;
   return Object.freeze({state:next,duplicate:false,provider_order_matched:true,
    route_key:row.route_key,offer_id:expected.offer_id,provider_order_id:dealId,
    provider_order_number:dealNumber,provider_order_created_at:createdAt.toISOString(),
    provider_callback_received_at:new Date(receivedAt).toISOString(),
    offer_revision_sha256:row.offer_revision_sha256,
    provider_callback_auth:'GETCOURSE_PROCESS_BEARER_SHARED_SECRET',
    provider_signature_verified:false,
    provider_consent_verified:Boolean(native),
    provider_negative_test_verified:Boolean(native),
    public_release_allowed:false,
    reason:native?'HOLD_PAYMENT_RECEIPT_GRANTS_AND_OWNER_RELEASE':
     'HOLD_PROVIDER_NATIVE_CONSENT_NOT_VERIFIED'});
  }catch(e){
   if(transaction)try{await client.query('ROLLBACK')}catch{}
   if(e.code==='23505')fail('R127_PROVIDER_ORDER_ALREADY_BOUND_TO_ANOTHER_NONCE');
   throw e;
  }finally{client.release?.()}
 }
 async function inspect({nonce}={}){
  if(!validToken(nonce))fail('R127_NONCE_INVALID');
  const r=await pool.query(
   'SELECT route_key,offer_id,widget_id,amount_rub,pricing_version,offer_revision_sha256,'+
   'issued_at,expires_at,state,provider_order_id,provider_order_number,provider_order_status,'+
   'provider_order_created_at,provider_callback_received_at,provider_callback_auth,'+
   'provider_signature_verified,native_consent_verified,native_consent_source,'+
   'native_negative_test_sha256,public_release_allowed FROM bf2026_r127_consent_challenges '+
   'WHERE nonce_sha256=$1',[sha(nonce)]);
  if(!r.rows?.length)fail('R127_CHALLENGE_NOT_FOUND');
  const row=r.rows[0];
  return Object.freeze({...row,nonce_sha256:undefined,session_sha256:undefined,
   provider_user_id:undefined,provider_callback_sha256:undefined,
   client_checkbox_is_evidence:false,public_release_allowed:false});
 }
 async function status(){
  let dbReady=false;try{
   const q=await pool.query("SELECT to_regclass('public.bf2026_r127_consent_challenges') AS t");
   dbReady=Boolean(q.rows?.[0]?.t);
  }catch{}
  return Object.freeze({
   route:'R127_SERVER_SIDE_CONSENT_BOUNDARY_QA_ONLY',
   postgres_ready:dbReady,approved_offer_revisions:Object.keys(revisions).length,
   callback_shared_secret_configured:Boolean(callbackSecretHash),
   provider_callback_signature_supported:false,
   provider_native_consent_verifier_configured:Boolean(nativeConsentVerifier),
   provider_native_unchecked_submit_negative_test_verified:false,
   client_checkbox_trusted:false,client_javascript_trusted:false,
   legacy_user_custom_field_22204810_accepted_as_proof:false,
   single_use_nonce:true,challenge_ttl_seconds:CHALLENGE_TTL_MS/1000,
   callback_auth:'BEARER_SHARED_SECRET_NOT_PROVIDER_SIGNATURE',
   public_release_allowed:false
  });
 }
 function publicCheckoutDecision(_quote){
  return Object.freeze({allowed:false,code:'R127_PROVIDER_NATIVE_CONSENT_HOLD',
   provider_consent_verified:false,public_release_allowed:false});
 }
 return Object.freeze({
  issueChallenge,receiveProviderOrderCallback,inspect,status,
  publicCheckoutDecision,
  callbackSecretConfigured:Boolean(callbackSecretHash),
  revisionCount:Object.keys(revisions).length
 });
}
module.exports={
 COOKIE,SESSION_TTL_SECONDS,CHALLENGE_TTL_MS,ALLOWED_KEYS,
 validateRevisionManifest,readOwnerPrivateFile,loadRevisionManifest,
 loadCallbackSecret,validNativeConsentAttestation,createConsentBoundary
};
