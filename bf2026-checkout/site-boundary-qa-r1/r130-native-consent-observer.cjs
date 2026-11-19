'use strict';
/* R130 optional native GetCourse consent observer adapter.
 * Injects only an owner-audited read-only transport. It never submits a form,
 * creates an order or calls GetCourse directly. Owner observer signatures
 * authenticate the observer's readback, NOT a GetCourse vendor signature.
 * Returns an R127-compatible attestation only when BOTH order consent and
 * a fresh native unchecked-submit rejection report verify.
 */
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {readApprovedKey,PRIVATE_ROOT}=require('./r126-signed-native-observer.cjs');
const {stable,keyId}=require('./r127-signed-revision-manifest.cjs');
const SCHEMA='bf2026.r130.native-consent-observer.v1';
const ISSUER='BF2026_OWNER_APPROVED_GETCOURSE_NATIVE_CONSENT_OBSERVER';
const HOST='study.shkola-dnv.com';
const TRANSPORT_FILE=PRIVATE_ROOT+'/native-consent-observer-transport-approved.cjs';
const MAX_ENVELOPE_AGE_MS=5*60*1000;
const MAX_EVIDENCE_AGE_MS=30*86400000;
const HEX=/^[a-f0-9]{64}$/;
function fail(code){const e=Error(code);e.code=code;throw e}
function isSha(v){return typeof v==='string'&&HEX.test(v)}
function date(v){
 if(typeof v!=='string'||! /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(Z|[+-]\d\d:\d\d)$/.test(v))return null;
 const n=Date.parse(v);return Number.isFinite(n)?n:null;
}
function exactKeys(v,keys){
 return !!v&&typeof v==='object'&&!Array.isArray(v)&&
  Object.keys(v).sort().join('|')===[...keys].sort().join('|');
}
function verifyEnvelope(envelope,{action,nonce,publicKey,callback,challenge,clock=()=>Date.now()}={}){
 if(!['order_consent_readback','unchecked_submit_negative_test'].includes(action))
  fail('R130_NATIVE_CONSENT_ACTION_INVALID');
 if(!publicKey||publicKey.asymmetricKeyType!=='ed25519')
  fail('R130_NATIVE_CONSENT_ED25519_REQUIRED');
 if(!exactKeys(envelope,['key_id','payload','signature'])||
  envelope.key_id!==keyId(publicKey)||
  typeof envelope.signature!=='string'||!/^[A-Za-z0-9_-]{80,110}$/.test(envelope.signature))
  fail('R130_NATIVE_CONSENT_ENVELOPE_OR_KEY_INVALID');
 if(Buffer.byteLength(JSON.stringify(envelope),'utf8')>16384)
  fail('R130_NATIVE_CONSENT_ENVELOPE_TOO_LARGE');
 const p=envelope.payload;
 const common=['schema','action','issuer','nonce','account_host','offer_id',
  'widget_id','route_key','offer_revision_sha256','issued_at','expires_at'];
 const extra=action==='order_consent_readback'?
  ['deal_id','deal_number','user_id','native_consent_scope','native_consent_required',
   'native_consent_accepted','user_field_22204810_used_as_proof','observed_at',
   'readback_evidence_sha256']:
  ['consent_checkbox_omitted','result','order_created','observed_at',
   'test_run_id','provider_response_sha256','report_sha256'];
 if(!exactKeys(p,[...common,...extra])||p.schema!==SCHEMA||
  p.action!==action||p.issuer!==ISSUER||p.nonce!==nonce||
  p.account_host!==HOST||p.offer_id!==challenge.offer_id||
  p.widget_id!==challenge.widget_id||p.route_key!==challenge.route_key||
  p.offer_revision_sha256!==challenge.offer_revision_sha256)
  fail('R130_NATIVE_CONSENT_SCOPE_MISMATCH');
 const issued=date(p.issued_at),expires=date(p.expires_at),observed=date(p.observed_at),now=clock();
 if(issued===null||expires===null||observed===null||
  issued>now+300000||issued<now-MAX_ENVELOPE_AGE_MS||
  expires<=now||expires<=issued||expires-issued>MAX_ENVELOPE_AGE_MS||
  observed>now+300000||now-observed>MAX_EVIDENCE_AGE_MS||observed>issued)
  fail('R130_NATIVE_CONSENT_EVIDENCE_STALE_OR_EXPIRED');
 const signature=Buffer.from(envelope.signature,'base64url');
 if(signature.length!==64||
  !crypto.verify(null,Buffer.from(stable(p)),publicKey,signature))
  fail('R130_NATIVE_CONSENT_SIGNATURE_UNVERIFIED');
 if(action==='order_consent_readback'){
  if(String(p.deal_id)!==String(callback.deal_id)||
   String(p.deal_number)!==String(callback.deal_number)||
   String(p.user_id)!==String(callback.user_id)||
   p.native_consent_scope!=='SYSTEM_OFFER_CHECKBOX'||
   p.native_consent_required!==true||p.native_consent_accepted!==true||
   p.user_field_22204810_used_as_proof!==false||
   !isSha(p.readback_evidence_sha256))
   fail('R130_NATIVE_ORDER_CONSENT_READBACK_INVALID');
 }else{
  if(p.consent_checkbox_omitted!==true||
   p.result!=='REJECTED_BEFORE_ORDER_CREATION'||
   p.order_created!==false||
   typeof p.test_run_id!=='string'||p.test_run_id.length<8||p.test_run_id.length>128||
   !isSha(p.provider_response_sha256)||!isSha(p.report_sha256))
   fail('R130_NATIVE_UNCHECKED_SUBMIT_NEGATIVE_TEST_INVALID');
 }
 return p;
}
function createNativeConsentVerifier({transport,publicKey,clock=()=>Date.now()}={}){
 if(!transport||typeof transport!=='object'||
  transport.kind!=='BF2026_GETCOURSE_NATIVE_CONSENT_READONLY_V1'||
  transport.readOnly!==true||transport.mutationMethodsAvailable!==false||
  !exactKeys(transport,['kind','readOnly','mutationMethodsAvailable',
   'readOrderConsent','readUncheckedSubmitNegativeTest'])||
  typeof transport.readOrderConsent!=='function'||
  typeof transport.readUncheckedSubmitNegativeTest!=='function')
  fail('R130_NATIVE_CONSENT_READONLY_TRANSPORT_REQUIRED');
 if(!publicKey||publicKey.asymmetricKeyType!=='ed25519')
  fail('R130_NATIVE_CONSENT_ED25519_REQUIRED');
 return Object.freeze({
  async verify({callback,challenge}={}){
   try{
    const nonce=callback?.consent_nonce;
    if(typeof nonce!=='string'||nonce.length<40||
     !callback?.deal_id||!callback?.deal_number||!callback?.user_id||
     !challenge?.route_key||!challenge?.offer_id||!challenge?.widget_id||
     !isSha(challenge?.offer_revision_sha256))return null;
    // Both operations are read-only lookups. The negative test itself must
    // have been executed and recorded separately by the authorized UI owner.
    const [orderEnvelope,negativeEnvelope]=await Promise.all([
     transport.readOrderConsent({nonce,callback,challenge}),
     transport.readUncheckedSubmitNegativeTest({nonce,callback,challenge})
    ]);
    const order=verifyEnvelope(orderEnvelope,{
     action:'order_consent_readback',nonce,publicKey,callback,challenge,clock
    });
    const negative=verifyEnvelope(negativeEnvelope,{
     action:'unchecked_submit_negative_test',nonce,publicKey,callback,challenge,clock
    });
    return Object.freeze({
     schema:'bf2026.r127.provider-consent-attestation.v1',
     source:'GETCOURSE_NATIVE_SYSTEM_OFFER_CONSENT_READBACK',
     account_host:HOST,deal_id:String(callback.deal_id),
     deal_number:String(callback.deal_number),offer_id:challenge.offer_id,
     offer_revision_sha256:challenge.offer_revision_sha256,
     native_consent_scope:'SYSTEM_OFFER_CHECKBOX',
     native_consent_accepted:true,native_field_22204810_used_as_proof:false,
     observed_at:order.observed_at,
     provider_negative_test:{
      source:'GETCOURSE_NATIVE_UNCHECKED_SUBMIT_TEST',
      result:'REJECTED_BEFORE_ORDER_CREATION',
      report_sha256:negative.report_sha256,
      observed_at:negative.observed_at
     },
     public_release_allowed:false
    });
   }catch{return null}
  }
 });
}
function assertOwnerPrivateTransport(filePath=TRANSPORT_FILE,uid=process.getuid?.()){
 if(typeof uid!=='number'||filePath!==TRANSPORT_FILE)
  fail('R130_NATIVE_CONSENT_TRANSPORT_PATH_INVALID');
 let dir,st,real;
 try{dir=fs.lstatSync(PRIVATE_ROOT);st=fs.lstatSync(filePath);real=fs.realpathSync(filePath)}
 catch{fail('R130_NATIVE_CONSENT_TRANSPORT_NOT_PROVISIONED')}
 if(!dir.isDirectory()||dir.isSymbolicLink()||dir.uid!==uid||(dir.mode&0o022)!==0||
  !st.isFile()||st.isSymbolicLink()||st.uid!==uid||(st.mode&0o077)!==0||
  st.size<100||st.size>16384||real!==filePath)
  fail('R130_NATIVE_CONSENT_TRANSPORT_NOT_OWNER_PRIVATE');
 return true;
}
function loadConfiguredNativeConsentVerifier(env=process.env){
 if(env.BF2026_R130_NATIVE_CONSENT_OBSERVER_ENABLED!=='1')return null;
 if(typeof env.BF2026_R130_NATIVE_CONSENT_PUBLIC_KEY_FILE!=='string')
  fail('R130_NATIVE_CONSENT_PUBLIC_KEY_REQUIRED');
 const publicKey=readApprovedKey({filePath:env.BF2026_R130_NATIVE_CONSENT_PUBLIC_KEY_FILE});
 assertOwnerPrivateTransport();
 let transport;
 try{transport=require(TRANSPORT_FILE)}catch{fail('R130_NATIVE_CONSENT_TRANSPORT_LOAD_FAILED')}
 return createNativeConsentVerifier({transport,publicKey});
}
module.exports={
 SCHEMA,ISSUER,HOST,TRANSPORT_FILE,MAX_ENVELOPE_AGE_MS,MAX_EVIDENCE_AGE_MS,
 verifyEnvelope,createNativeConsentVerifier,assertOwnerPrivateTransport,
 loadConfiguredNativeConsentVerifier
};
