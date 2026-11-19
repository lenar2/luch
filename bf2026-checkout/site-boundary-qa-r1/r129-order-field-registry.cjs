'use strict';
/* R129: owner-signed, order-scoped GetCourse native field and process config.
 * A signed statement is OWNER ATTESTATION, not GetCourse provider proof.
 * No key/real field ID is provisioned in source or the stage by default.
 */
const crypto=require('node:crypto');
const {readOwnerPrivateFile}=require('./r127-consent-boundary.cjs');
const {readApprovedKey}=require('./r126-signed-native-observer.cjs');
const {stable,keyId}=require('./r127-signed-revision-manifest.cjs');
const {validateOrderCallbackConfig}=require('./r128-order-callback-contract.cjs');
const SCHEMA='bf2026.r129.owner-signed-order-fields.v1';
const MAX_LIFETIME_MS=7*86400000;
const HOST='study.shkola-dnv.com';
const ROLES=Object.freeze(['consent_nonce','offer_revision_sha256']);
function fail(code){const e=Error(code);e.code=code;throw e}
function hash(v){return crypto.createHash('sha256').update(v).digest('hex')}
function isSha(v){return typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)}
function keys(v,list){return !!v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).sort().join('|')===[...list].sort().join('|')}
function iso(v){
 if(typeof v!=='string'||! /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(Z|[+-]\d\d:\d\d)$/.test(v))return null;
 const n=Date.parse(v);return Number.isFinite(n)?n:null;
}
function unsigned(envelope){
 const {signature,...rest}=envelope;
 return rest;
}
function verifyOwnerSignedEnvelope(envelope,{publicKey,now=Date.now()}={}){
 if(!publicKey||publicKey.asymmetricKeyType!=='ed25519')
  fail('R129_OWNER_ED25519_PUBLIC_KEY_REQUIRED');
 if(!keys(envelope,['schema','key_id','issued_at','expires_at','process_id',
  'form_population_evidence_sha256','config','signature'])||
  envelope.schema!==SCHEMA||envelope.key_id!==keyId(publicKey))
  fail('R129_OWNER_CONFIG_ENVELOPE_OR_KEY_MISMATCH');
 const issued=iso(envelope.issued_at),expires=iso(envelope.expires_at);
 if(issued===null||expires===null||issued>now+300000||expires<=now||
   expires<=issued||expires-issued>MAX_LIFETIME_MS)
  fail('R129_OWNER_CONFIG_EXPIRED_OR_TIME_INVALID');
 if(!Number.isSafeInteger(envelope.process_id)||envelope.process_id<=0)
  fail('R129_NATIVE_PROCESS_ID_UNSET');
 const evidence=envelope.form_population_evidence_sha256;
 if(!keys(evidence,ROLES)||!ROLES.every(k=>isSha(evidence[k])))
  fail('R129_ORDER_FORM_POPULATION_EVIDENCE_MISSING');
 const native=validateOrderCallbackConfig(envelope.config);
 if(!native.ready)fail('R129_NATIVE_ORDER_FIELD_MAPPING_UNVERIFIED');
 const supplied=envelope.signature;
 if(typeof supplied!=='string'||!/^[A-Za-z0-9_-]{80,110}$/.test(supplied))
  fail('R129_OWNER_SIGNATURE_MISSING');
 const sig=Buffer.from(supplied,'base64url');
 const payload=stable(unsigned(envelope));
 if(sig.length!==64||
  !crypto.verify(null,Buffer.from(payload),publicKey,sig))
  fail('R129_OWNER_SIGNATURE_INVALID');
 return Object.freeze({
  schema:SCHEMA,owner_signature_verified:true,
  source:'OWNER_ATTESTED_NATIVE_READBACK_NOT_GETCOURSE_VENDOR_SIGNATURE',
  account_host:HOST,
  owner_key_id:envelope.key_id,
  process_id:envelope.process_id,
  signed_payload_sha256:hash(payload),
  form_population_evidence_sha256:Object.freeze({...evidence}),
  order_field_ids:native.order_field_ids,
  config:structuredClone(envelope.config),
  issued_at:envelope.issued_at,
  expires_at:envelope.expires_at,
  public_release_allowed:false,
  provider_signature_verified:false,
  native_provider_consent_verified:false
 });
}
function signFixture(envelope,privateKey){
 if(!privateKey||privateKey.asymmetricKeyType!=='ed25519')
  fail('R129_ED25519_PRIVATE_KEY_REQUIRED');
 const original={...envelope,key_id:keyId(crypto.createPublicKey(privateKey))};
 delete original.signature;
 return {...original,signature:crypto.sign(null,Buffer.from(stable(original)),privateKey)
  .toString('base64url')};
}
function loadOwnerSignedConfig(env=process.env){
 const raw=readOwnerPrivateFile(env?.BF2026_R129_OWNER_SIGNED_CONFIG_FILE,{maxBytes:32768});
 if(!raw||typeof env?.BF2026_R129_OWNER_PUBLIC_KEY_FILE!=='string')return null;
 try{
  const key=readApprovedKey({filePath:env.BF2026_R129_OWNER_PUBLIC_KEY_FILE});
  return verifyOwnerSignedEnvelope(JSON.parse(raw),{publicKey:key});
 }catch{return null}
}
function matchingAttestationRows({fields,process,owner,now=Date.now()}={}){
 const hold=code=>Object.freeze({ready:false,code,
  order_field_ids:null,provider_signature_verified:false,
  provider_native_consent_verified:false,public_release_allowed:false});
 if(!owner||owner.owner_signature_verified!==true||owner.schema!==SCHEMA||
  owner.account_host!==HOST||iso(owner.expires_at)===null||
  iso(owner.expires_at)<=now||!isSha(owner.signed_payload_sha256))
  return hold('R129_OWNER_SIGNED_NATIVE_CONFIG_NOT_AVAILABLE');
 if(!Array.isArray(fields)||fields.length!==2||!process||
  !Array.isArray(process)||process.length!==1)
  return hold('R129_ORDER_FIELD_LEDGER_INCOMPLETE');
 const seen=new Set();
 for(const role of ROLES){
  const r=fields.find(x=>x.field_role===role);
  const expected=owner.config?.order_fields?.[role];
  if(!r||!expected||r.account_host!==HOST||r.field_scope!=='order'||
   r.field_title!==expected.title||
   String(r.field_id)!==String(expected.field_id)||
   !Number.isSafeInteger(Number(r.field_id))||Number(r.field_id)<=0||
   Number(r.field_id)===22204810||seen.has(String(r.field_id))||
   r.state!=='OWNER_ATTESTED_QA_ONLY'||
   r.native_readback_sha256!==expected.readback_evidence_sha256||
   r.native_form_population_sha256!==owner.form_population_evidence_sha256[role]||
   r.owner_signed_payload_sha256!==owner.signed_payload_sha256||
   !r.native_verified_at||r.public_release_allowed!==false)
   return hold('R129_ORDER_FIELD_LEDGER_OR_NATIVE_MAPPING_MISMATCH');
  seen.add(String(r.field_id));
 }
 const p=process[0];
 if(p.account_host!==HOST||p.state!=='OWNER_ATTESTED_QA_ONLY'||
  String(p.process_id)!==String(owner.process_id)||
  p.process_scope!=='orders'||
  p.callback_url!=='https://wf.tati-lar.ru/api/checkout/_provider/getcourse/order-created'||
  p.native_process_readback_sha256!==owner.config.callback_process.readback_evidence_sha256||
  p.owner_signed_payload_sha256!==owner.signed_payload_sha256||
  !p.native_verified_at||p.provider_signature_verified!==false||
  p.public_release_allowed!==false)
  return hold('R129_CALLBACK_PROCESS_LEDGER_MISMATCH');
 return Object.freeze({ready:true,code:'R129_ORDER_FIELDS_OWNER_ATTESTED_QA_ONLY',
  order_field_ids:Object.freeze({...owner.order_field_ids}),
  provider_signature_verified:false,provider_native_consent_verified:false,
  public_release_allowed:false});
}
function createFieldRegistry({pool,owner=null,clock=()=>Date.now()}={}){
 if(typeof pool?.query!=='function')fail('R129_POSTGRES_REQUIRED');
 async function ready(){
  if(!owner)return matchingAttestationRows({});
  try{
   const [f,p]=await Promise.all([
    pool.query('SELECT account_host,field_role,field_title,field_scope,field_id,native_readback_sha256,native_form_population_sha256,owner_signed_payload_sha256,native_verified_at,state,public_release_allowed FROM bf2026_r129_order_fields WHERE account_host=$1 ORDER BY field_role',[HOST]),
    pool.query('SELECT account_host,process_id,process_scope,callback_url,native_process_readback_sha256,owner_signed_payload_sha256,native_verified_at,state,provider_signature_verified,public_release_allowed FROM bf2026_r129_order_process WHERE account_host=$1',[HOST])
   ]);
   return matchingAttestationRows({fields:f.rows,process:p.rows,owner,now:clock()});
  }catch{return Object.freeze({ready:false,code:'R129_ORDER_FIELDS_POSTGRES_UNAVAILABLE',
   order_field_ids:null,provider_signature_verified:false,
   provider_native_consent_verified:false,public_release_allowed:false});}
 }
 async function status(){
  let dbReady=false;
  try{
   const x=await pool.query("SELECT to_regclass('public.bf2026_r129_order_fields') AS a,to_regclass('public.bf2026_r129_order_process') AS b");
   dbReady=Boolean(x.rows?.[0]?.a&&x.rows?.[0]?.b);
  }catch{}
  const match=await ready();
  return Object.freeze({
   route:'R129_GETCOURSE_ORDER_FIELD_REGISTRY_QA_ONLY',
   postgres_ready:dbReady,
   signed_owner_config_configured:Boolean(owner),
   order_field_ids_verified:match.ready,
   native_callback_mapping_verified:match.ready,
   owner_config_expired:owner?iso(owner.expires_at)<=clock():null,
   gate_code:match.code,
   order_field_ids:match.ready?match.order_field_ids:null,
   provider_signature_verified:false,
   native_provider_consent_verified:false,public_release_allowed:false
  });
 }
 return Object.freeze({ready,status});
}
module.exports={SCHEMA,HOST,ROLES,MAX_LIFETIME_MS,verifyOwnerSignedEnvelope,
 signFixture,loadOwnerSignedConfig,matchingAttestationRows,createFieldRegistry};
