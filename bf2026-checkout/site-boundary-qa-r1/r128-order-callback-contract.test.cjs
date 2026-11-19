'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const TEMPLATE=require('./r128-order-callback-contract.example.json');
const {CALLBACK_URL,VARIABLE_SPECS,validateOrderCallbackConfig}=require('./r128-order-callback-contract.cjs');
function fixture(){
 return {
  schema:'bf2026.r128.getcourse-order-callback-config.v1',
  account_host:'study.shkola-dnv.com',owner_approved:true,
  order_fields:{
   consent_nonce:{scope:'order',title:'BF2026 Consent Nonce',field_id:910001,
    type:'string',native_readback_verified:true,form_population_verified:true,
    readback_evidence_sha256:'a'.repeat(64)},
   offer_revision_sha256:{scope:'order',title:'BF2026 Offer Revision SHA256',field_id:910002,
    type:'string',native_readback_verified:true,form_population_verified:true,
    readback_evidence_sha256:'b'.repeat(64)}
  },
  callback_process:{
   process_object:'orders',operation:'Вызвать URL',method:'POST',url:CALLBACK_URL,
   content_type:'application/json',authorization_header_configured:true,
   authorization_secret_file_only:true,provider_signature_supported:false,
   created_at_iso8601_timezone_verified:true,error_branch_configured:true,
   readback_evidence_sha256:'c'.repeat(64),
   body_variables:{...VARIABLE_SPECS}
  }
 };
}
test('R128 repo template is intentionally disabled with no fabricated field IDs',()=>{
 assert.equal(TEMPLATE.approved,false);
 assert.equal(TEMPLATE.callback_configured,false);
 assert.equal(TEMPLATE.order_fields.consent_nonce.field_id,null);
 assert.equal(TEMPLATE.order_fields.offer_revision_sha256.field_id,null);
 assert.equal(TEMPLATE.forbidden_evidence.field_id,22204810);
 assert.equal(validateOrderCallbackConfig(TEMPLATE).ready,false);
});
test('R128 accepts only two independently read-back ORDER fields and exact Process callback',()=>{
 const c=fixture(),v=validateOrderCallbackConfig(c);
 assert.equal(v.ready,true);assert.equal(v.public_release_allowed,false);
 assert.equal(v.provider_signature_verified,false);
 assert.deepEqual(v.order_field_ids,{consent_nonce:910001,offer_revision_sha256:910002});
 assert.deepEqual(c.callback_process.body_variables,VARIABLE_SPECS);
});
test('R128 rejects user field 22204810, missing fields, duplicate IDs and unverified form population',()=>{
 const cases=[];
 let x=fixture();x.order_fields.consent_nonce.scope='user';cases.push(x);
 x=fixture();x.order_fields.consent_nonce.field_id=22204810;cases.push(x);
 x=fixture();x.order_fields.offer_revision_sha256.field_id=910001;cases.push(x);
 x=fixture();x.order_fields.offer_revision_sha256.native_readback_verified=false;cases.push(x);
 x=fixture();x.order_fields.consent_nonce.form_population_verified=false;cases.push(x);
 x=fixture();delete x.order_fields.offer_revision_sha256;cases.push(x);
 x=fixture();x.forbidden_user_field_id=22204810;cases.push(x);
 for(const c of cases)assert.equal(validateOrderCallbackConfig(c).ready,false);
});
test('R128 rejects callback endpoint, body variables, timestamp format and missing error branch changes',()=>{
 const cases=[];
 let x=fixture();x.callback_process.url='https://attacker.invalid/callback';cases.push(x);
 x=fixture();x.callback_process.body_variables.consent_nonce='{object.user.BF2026 Consent Nonce}';cases.push(x);
 x=fixture();delete x.callback_process.body_variables.offer_revision_sha256;cases.push(x);
 x=fixture();x.callback_process.created_at_iso8601_timezone_verified=false;cases.push(x);
 x=fixture();x.callback_process.error_branch_configured=false;cases.push(x);
 x=fixture();x.callback_process.provider_signature_supported=true;cases.push(x);
 for(const c of cases)assert.equal(validateOrderCallbackConfig(c).ready,false);
});
