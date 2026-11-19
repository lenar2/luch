'use strict';
/* R128: only owner-read-back order fields + exact Process config can enable
 * GetCourse order callback correlation. A client/user field is never enough.
 */
const fs=require('node:fs');
const path=require('node:path');
const {readOwnerPrivateFile}=require('./r127-consent-boundary.cjs');
const TEMPLATE=require('./r128-order-callback-contract.example.json');
const CALLBACK_URL='https://wf.tati-lar.ru/api/checkout/_provider/getcourse/order-created';
const PRIVATE_ROOT='/srv/factory-scratch/bf2026-r118-relay-stage-20261119/private-credentials';
const FIELD_SPECS=Object.freeze({
 consent_nonce:Object.freeze({title:'BF2026 Consent Nonce'}),
 offer_revision_sha256:Object.freeze({title:'BF2026 Offer Revision SHA256'})
});
const VARIABLE_SPECS=TEMPLATE.callback_process.body_variables;
function fail(code){const e=Error(code);e.code=code;throw e}
function exactKeys(v,keys){
 return !!v&&typeof v==='object'&&!Array.isArray(v)&&
  Object.keys(v).sort().join('|')===[...keys].sort().join('|');
}
function isHex64(v){return typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)}
function validateOrderCallbackConfig(config){
 const hold=(code)=>Object.freeze({ready:false,code,public_release_allowed:false,
  provider_signature_verified:false});
 if(!config||typeof config!=='object'||Array.isArray(config)||
  config.schema!=='bf2026.r128.getcourse-order-callback-config.v1'||
  config.account_host!=='study.shkola-dnv.com'||config.owner_approved!==true)
  return hold('R128_ORDER_CALLBACK_CONFIG_NOT_OWNER_APPROVED');
 if(!exactKeys(config.order_fields,['consent_nonce','offer_revision_sha256']))
  return hold('R128_ORDER_FIELDS_INCOMPLETE');
 const used=new Set();
 for(const [key,spec] of Object.entries(FIELD_SPECS)){
  const f=config.order_fields[key];
  if(!f||f.scope!=='order'||f.title!==spec.title||
   !Number.isSafeInteger(f.field_id)||f.field_id<=0||f.field_id===22204810||
   f.type!=='string'||f.native_readback_verified!==true||
   f.form_population_verified!==true||!isHex64(f.readback_evidence_sha256)||
   used.has(f.field_id))
   return hold('R128_ORDER_FIELD_NOT_NATIVE_VERIFIED_'+key.toUpperCase());
  used.add(f.field_id);
 }
 const p=config.callback_process;
 if(!p||p.process_object!=='orders'||p.operation!=='Вызвать URL'||
  p.method!=='POST'||p.url!==CALLBACK_URL||
  p.content_type!=='application/json'||
  p.authorization_header_configured!==true||
  p.authorization_secret_file_only!==true||
  p.provider_signature_supported!==false||
  p.created_at_iso8601_timezone_verified!==true||
  p.error_branch_configured!==true||
  !isHex64(p.readback_evidence_sha256)||
  !exactKeys(p.body_variables,Object.keys(VARIABLE_SPECS))||
  Object.entries(VARIABLE_SPECS).some(([k,v])=>p.body_variables[k]!==v))
  return hold('R128_GETCOURSE_CALLBACK_PROCESS_NOT_NATIVE_VERIFIED');
 if(config.forbidden_user_field_id===22204810)
  return hold('R128_USER_FIELD_22204810_CANNOT_PROVE_ORDER_CONSENT');
 return Object.freeze({
  ready:true,code:'R128_ORDER_CALLBACK_CONTRACT_VERIFIED',
  order_field_ids:Object.freeze({
   consent_nonce:config.order_fields.consent_nonce.field_id,
   offer_revision_sha256:config.order_fields.offer_revision_sha256.field_id
  }),
  callback_url:CALLBACK_URL,process_object:'orders',
  provider_signature_verified:false,public_release_allowed:false
 });
}
function loadVerifiedOrderCallbackConfig(env=process.env){
 if(!env||typeof env!=='object')return null;
 const p=env.BF2026_R128_ORDER_CALLBACK_CONFIG_FILE;
 const raw=readOwnerPrivateFile(p,{maxBytes:32768});
 if(!raw)return null;
 try{
  const cfg=JSON.parse(raw),result=validateOrderCallbackConfig(cfg);
  return result.ready?Object.freeze({config:cfg,evidence:result}):null;
 }catch{return null}
}
function publicContractStatus({env=process.env,callbackSecretConfigured=false}={}){
 const verified=loadVerifiedOrderCallbackConfig(env);
 return Object.freeze({
  order_fields_native_verified:Boolean(verified),
  order_callback_process_verified:Boolean(verified),
  callback_shared_secret_configured:callbackSecretConfigured===true,
  callback_ready:Boolean(verified)&&callbackSecretConfigured===true,
  provider_signature_verified:false,
  provider_native_consent_negative_test_verified:false,
  client_field_22204810_accepted_as_proof:false,
  public_release_allowed:false
 });
}
module.exports={CALLBACK_URL,PRIVATE_ROOT,FIELD_SPECS,VARIABLE_SPECS,
 validateOrderCallbackConfig,loadVerifiedOrderCallbackConfig,publicContractStatus};
