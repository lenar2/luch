'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {
 SCHEMA,signFixture,verifyOwnerSignedEnvelope,matchingAttestationRows
}=require('./r129-order-field-registry.cjs');
const template=require('./r129-order-fields.owner-signature.example.json');
const {VARIABLE_SPECS,CALLBACK_URL}=require('./r128-order-callback-contract.cjs');
function fixture(){
 const t=Date.now(),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
 const config={
  schema:'bf2026.r128.getcourse-order-callback-config.v1',
  account_host:'study.shkola-dnv.com',owner_approved:true,
  order_fields:{
   consent_nonce:{scope:'order',title:'BF2026 Consent Nonce',field_id:99129101,type:'string',
    native_readback_verified:true,form_population_verified:true,readback_evidence_sha256:sha('TEST_READBACK_NONCE')},
   offer_revision_sha256:{scope:'order',title:'BF2026 Offer Revision SHA256',field_id:99129102,type:'string',
    native_readback_verified:true,form_population_verified:true,readback_evidence_sha256:sha('TEST_READBACK_REVISION')}
  },
  callback_process:{process_object:'orders',operation:'Вызвать URL',method:'POST',url:CALLBACK_URL,
   content_type:'application/json',authorization_header_configured:true,
   authorization_secret_file_only:true,provider_signature_supported:false,
   created_at_iso8601_timezone_verified:true,error_branch_configured:true,
   readback_evidence_sha256:sha('TEST_ORDER_PROCESS'),body_variables:{...VARIABLE_SPECS}}
 };
 const e={schema:SCHEMA,issued_at:new Date(t-3000).toISOString(),
  expires_at:new Date(t+3600000).toISOString(),process_id:99129999,
  form_population_evidence_sha256:{
   consent_nonce:sha('TEST_FORM_NONCE'),offer_revision_sha256:sha('TEST_FORM_REVISION')
  },config};
 const pair=crypto.generateKeyPairSync('ed25519');
 return {e,pair,signed:signFixture(e,pair.privateKey),now:t};
}
test('R129 template has zero native GetCourse Order field IDs, zero native process ID and no signature',()=>{
 assert.equal(template.schema,SCHEMA);
 assert.equal(template.process_id,null);assert.equal(template.signature,null);
 assert.equal(template.config.order_fields.consent_nonce.field_id,null);
 assert.equal(template.config.order_fields.offer_revision_sha256.field_id,null);
});
test('R129 verifies owner offline Ed25519 signature, exact two ORDER field IDs, process and expiry',()=>{
 const f=fixture();
 const verified=verifyOwnerSignedEnvelope(f.signed,{publicKey:f.pair.publicKey,now:f.now});
 assert.equal(verified.owner_signature_verified,true);
 assert.equal(verified.public_release_allowed,false);
 assert.equal(verified.provider_signature_verified,false);
 assert.equal(verified.native_provider_consent_verified,false);
 assert.deepEqual(verified.order_field_ids,
  {consent_nonce:99129101,offer_revision_sha256:99129102});
});
test('R129 rejects changed signed process IDs, wrong key, expired config, missing form mapping and user field',()=>{
 const f=fixture(),good=f.signed;
 const other=crypto.generateKeyPairSync('ed25519');
 assert.throws(()=>verifyOwnerSignedEnvelope(good,{publicKey:other.publicKey,now:f.now}));
 assert.throws(()=>verifyOwnerSignedEnvelope({...good,process_id:1234},
  {publicKey:f.pair.publicKey,now:f.now}));
 assert.throws(()=>verifyOwnerSignedEnvelope({...good,config:{
  ...good.config,order_fields:{...good.config.order_fields,
   consent_nonce:{...good.config.order_fields.consent_nonce,field_id:22204810}}
 }},{publicKey:f.pair.publicKey,now:f.now}));
 const bad=signFixture({...f.e,expires_at:new Date(f.now-2000).toISOString()},f.pair.privateKey);
 assert.throws(()=>verifyOwnerSignedEnvelope(bad,{publicKey:f.pair.publicKey,now:f.now}));
 const wrong=signFixture({...f.e,form_population_evidence_sha256:{
  consent_nonce:null,offer_revision_sha256:'c'.repeat(64)
 }},f.pair.privateKey);
 assert.throws(()=>verifyOwnerSignedEnvelope(wrong,{publicKey:f.pair.publicKey,now:f.now}));
});
test('R129 rejects unverified/mismatching Postgres rows even with signed owner config',()=>{
 const f=fixture(),v=verifyOwnerSignedEnvelope(f.signed,{publicKey:f.pair.publicKey,now:f.now});
 const rows=Object.entries(v.config.order_fields).map(([field_role,r])=>({
  account_host:'study.shkola-dnv.com',field_role,field_title:r.title,field_scope:'order',
  field_id:r.field_id,native_readback_sha256:r.readback_evidence_sha256,
  native_form_population_sha256:v.form_population_evidence_sha256[field_role],
  owner_signed_payload_sha256:v.signed_payload_sha256,native_verified_at:new Date(f.now),
  state:'OWNER_ATTESTED_QA_ONLY',public_release_allowed:false
 }));
 const p={account_host:'study.shkola-dnv.com',process_id:v.process_id,
  process_scope:'orders',callback_url:CALLBACK_URL,
  native_process_readback_sha256:v.config.callback_process.readback_evidence_sha256,
  owner_signed_payload_sha256:v.signed_payload_sha256,native_verified_at:new Date(f.now),
  state:'OWNER_ATTESTED_QA_ONLY',provider_signature_verified:false,public_release_allowed:false};
 assert.equal(matchingAttestationRows({owner:v,fields:rows,process:[p],now:f.now}).ready,true);
 assert.equal(matchingAttestationRows({owner:v,fields:[],process:[p],now:f.now}).ready,false);
 assert.equal(matchingAttestationRows({owner:v,fields:rows,process:[{...p,process_id:1}],now:f.now}).ready,false);
 assert.equal(matchingAttestationRows({owner:v,fields:rows.map(x=>({...x,field_scope:'user'})),
  process:[p],now:f.now}).ready,false);
 assert.equal(matchingAttestationRows({owner:v,fields:rows,process:[p],
  now:f.now+4000000}).ready,false);
});
