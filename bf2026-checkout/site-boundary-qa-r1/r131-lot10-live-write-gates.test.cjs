'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createSetOrderWorker}=require('./r130-set-order-worker.cjs');
test('R131 production Import worker cannot send order with unverified GetCourse automatic email policy',async()=>{
 let dbCalls=0,providerCalls=0;
 const pool={query:async()=>{dbCalls++;throw Error('DB_MUST_NOT_BE_TOUCHED')},
  connect:async()=>{dbCalls++;throw Error('DB_MUST_NOT_BE_TOUCHED')}};
 const verified={
  owner_enabled:true,native_order_fields_verified:true,
  provider_side_consent_enforced:true,
  buyer_order_specific_consent_verified:true,
  write_api_key_owner_approved:true,
  source_provider_identity_verified:true
 };
 const worker=createSetOrderWorker({pool,quoteFn:()=>{throw Error('QUOTE_MUST_NOT_BE_CALLED')},
  transport:{send:async()=>{providerCalls++;throw Error('PROVIDER_MUST_NOT_BE_CALLED')}},
  allowExternalWrites:true,testOnly:false,requiredNativePreflight:async()=>verified});
 await assert.rejects(worker.assembleOnce({}),{code:'R130_LIVE_ORDER_PREFLIGHT_UNVERIFIED'});
 assert.equal(dbCalls,0);assert.equal(providerCalls,0);
 const worker2=createSetOrderWorker({pool,quoteFn:()=>{throw Error('QUOTE_MUST_NOT_BE_CALLED')},
  transport:{send:async()=>{providerCalls++;throw Error('PROVIDER_MUST_NOT_BE_CALLED')}},
  allowExternalWrites:true,testOnly:false,requiredNativePreflight:async()=>({
   ...verified,owner_controlled_qa_buyer_verified:true,
   provider_order_notification_behavior_owner_approved:false
  })});
 await assert.rejects(worker2.assembleOnce({}),{code:'R130_LIVE_ORDER_PREFLIGHT_UNVERIFIED'});
 assert.equal(dbCalls,0);assert.equal(providerCalls,0);
});
