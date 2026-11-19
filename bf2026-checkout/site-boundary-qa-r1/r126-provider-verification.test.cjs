'use strict';
// R126 security regression: NO synthetic native PASS or provider call.
// All fixtures are deliberately invalid; signed observer must be provisioned
// by a real owner-approved backend before any native fiscal/grant inference.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {strictConfig,safeResult,routeGate,validateNativeReceiptAndGrants,
 SUBJECT}=require('./r126-provider-verification.cjs');
const {stageMetadata}=require('./r124-stage-training-overlay.cjs');
const fs=require('node:fs');
const path=require('node:path');
const {validateSignedEnvelope,createSignedReadOnlyObserver,readApprovedKey}=require('./r126-signed-native-observer.cjs');
const DIR='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
test('R126 default no native provider, feature keys disabled',()=>{
 const c=strictConfig({env:{}});
 assert.equal(c.globalFlag,false);
 assert.equal(c.nativeObserverFlag,false);
 assert.equal(c.exportSecretPathConfigured,false);
 assert.deepEqual(c.routeFlags,{});
});
test('R126 only exact known existing CTA feature names permitted',()=>{
 for(const v of ['single:trainer','single:rejection;single:union',
  'single:rejection,../secret','single:rejection,single:rejection',
  'single:bundle','single:source:3']){
  assert.throws(()=>strictConfig({env:{BF2026_R126_CTA_KEYS:v}}));
 }
 assert.throws(()=>strictConfig({env:{BF2026_R126_PROVIDER_VERIFY_ENABLED:'true'}}));
 assert.throws(()=>strictConfig({env:{BF2026_R126_NATIVE_OBSERVER_ENABLED:'1'}}),{
  code:'R126_OBSERVER_REQUIRES_GLOBAL_VERIFY_FLAG'
 });
 const c=strictConfig({env:{BF2026_R126_PROVIDER_VERIFY_ENABLED:'1',
  BF2026_R126_CTA_KEYS:'single:rejection,single:source:2'}});
 assert.equal(c.globalFlag,true);
 assert.equal(c.routeFlags['single:rejection'],true);
 assert.equal(c.routeFlags['single:source:2'],true);
});
test('R126 exact staged 10 route gate remains HOLD even with all feature flags on',()=>{
 const files=name=>JSON.parse(fs.readFileSync(path.join(DIR,name),'utf8'));
 const stage=stageMetadata({catalog:files('catalog-r110.json'),registry:files('offer-registry.json')});
 const all=['single:rejection','single:devaluation','single:self','single:guilt',
 'single:rejection_program','single:dnv','single:union',
 'single:source:1','single:source:2','single:personal_zoom'];
 assert.equal(all.length,10);
 for(const key of all){
  const gate=routeGate({key,stage,globalFlag:true,routeFlags:{[key]:true}});
  assert.equal(gate.configured_feature_enabled,true);
  assert.equal(gate.public_release_allowed,false);
  assert.equal(gate.receipt_verified,false);
  assert.equal(gate.actual_grants_verified,false);
  assert.equal(gate.provider_side_unchecked_consent_verified,false);
  assert.equal(gate.checkout_url,null);
 }
 assert.throws(()=>routeGate({key:'single:trainer',stage}),{code:'R126_CTA_NOT_APPROVED'});
});
test('R126 malformed or forged paid ledger row never becomes receipt/grant evidence',()=>{
 for(const obj of [
  null,{}, {state:'PAYMENT_RECORD_MATCHED',source:'WEBHOOK_HINT'},
  {state:'UNRECOGNIZED',source:'GETCOURSE_EXPORT_API_READONLY'},
  {state:'PAYMENT_RECORD_MATCHED',source:'GETCOURSE_EXPORT_API_READONLY',
   deal_id:'924624456',order_number:'71994',offer_id:8935004,order_total_rub:11690,
   order_status:'payed',paid_total_rub:11690,payment_amount_rub:11690,
   payment_status:'accepted',product_identity_verified:true,payment_record_verified:true}
 ])assert.throws(()=>safeResult(obj));
});
test('R126 independent receipt / grants require full native identity, never raw client claims',()=>{
 for(const candidate of [
  undefined,{amount_rub:11690},{account_host:SUBJECT.account_host,
   qa_user_id:SUBJECT.qa_user_id,order_number:SUBJECT.order_number,
   deal_id:SUBJECT.deal_id,offer_id:SUBJECT.offer_id,
   amount_rub:11690,fiscal_status:'unregistered',
   fiscal_receipt_number:'123456789',refunded:false}
 ])assert.throws(()=>validateNativeReceiptAndGrants({
  receipt:candidate,grants:[{product_id:4557988,training_id:936022301}]
 }));
});
test('R126 signer refuses unsigned, invalid and unprovisioned observer',()=>{
 assert.throws(()=>readApprovedKey({filePath:'/tmp/not-allowed.pem'}));
 assert.throws(()=>createSignedReadOnlyObserver({transport:{}}));
 assert.throws(()=>validateSignedEnvelope({envelope:{payload:{},signature:'fake',key_id:'x'},
  action:'origin',nonce:'a',key:null}));
});
