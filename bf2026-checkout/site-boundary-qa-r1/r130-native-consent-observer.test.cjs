'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {stable,keyId}=require('./r127-signed-revision-manifest.cjs');
const {validNativeConsentAttestation}=require('./r127-consent-boundary.cjs');
const {
 SCHEMA,ISSUER,HOST,createNativeConsentVerifier,loadConfiguredNativeConsentVerifier
}=require('./r130-native-consent-observer.cjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function fixture(){
 const pair=crypto.generateKeyPairSync('ed25519'),now=Date.now();
 const callback={deal_id:'99013001',deal_number:'9913001',user_id:'990000001',
  consent_nonce:crypto.randomBytes(32).toString('base64url')};
 const challenge={route_key:'single:rejection',offer_id:8934973,
  widget_id:1686768,offer_revision_sha256:sha('R130_TEST_NATIVE_CONSENT_REVISION'),
  issued_at:new Date(now-1000).toISOString(),
  expires_at:new Date(now+600000).toISOString()};
 function envelope(action,extra={}){
  const payload={
   schema:SCHEMA,action,issuer:ISSUER,nonce:callback.consent_nonce,
   account_host:HOST,offer_id:challenge.offer_id,widget_id:challenge.widget_id,
   route_key:challenge.route_key,offer_revision_sha256:challenge.offer_revision_sha256,
   issued_at:new Date(now-1000).toISOString(),
   expires_at:new Date(now+60000).toISOString(),
   ...(action==='order_consent_readback'?{
    deal_id:callback.deal_id,deal_number:callback.deal_number,user_id:callback.user_id,
    native_consent_scope:'SYSTEM_OFFER_CHECKBOX',native_consent_required:true,
    native_consent_accepted:true,user_field_22204810_used_as_proof:false,
    observed_at:new Date(now-2000).toISOString(),
    readback_evidence_sha256:sha('R130_TEST_ORDER_CONSENT_READBACK')
   }:{
    consent_checkbox_omitted:true,result:'REJECTED_BEFORE_ORDER_CREATION',
    order_created:false,observed_at:new Date(now-3000).toISOString(),
    test_run_id:'R130-TEST-NEGATIVE-001',
    provider_response_sha256:sha('R130_TEST_PROVIDER_RESPONSE'),
    report_sha256:sha('R130_TEST_NEGATIVE_REPORT')
   }),...extra
  };
  return {key_id:keyId(pair.publicKey),payload,
   signature:crypto.sign(null,Buffer.from(stable(payload)),pair.privateKey).toString('base64url')};
 }
 const order=envelope('order_consent_readback');
 const negative=envelope('unchecked_submit_negative_test');
 const transport={
  kind:'BF2026_GETCOURSE_NATIVE_CONSENT_READONLY_V1',
  readOnly:true,mutationMethodsAvailable:false,
  async readOrderConsent(){return order},
  async readUncheckedSubmitNegativeTest(){return negative}
 };
 return {pair,now,callback,challenge,order,negative,transport};
}
test('R130 observer returns an R127-compatible attestation only from two signed matching readbacks',async()=>{
 const f=fixture(),v=createNativeConsentVerifier({transport:f.transport,publicKey:f.pair.publicKey});
 const a=await v.verify({callback:f.callback,challenge:f.challenge});
 assert.equal(a.schema,'bf2026.r127.provider-consent-attestation.v1');
 assert.equal(a.source,'GETCOURSE_NATIVE_SYSTEM_OFFER_CONSENT_READBACK');
 assert.equal(a.native_consent_accepted,true);
 assert.equal(a.native_field_22204810_used_as_proof,false);
 assert.equal(a.provider_negative_test.result,'REJECTED_BEFORE_ORDER_CREATION');
 assert.ok(validNativeConsentAttestation(a,{callback:{
  deal_id:f.callback.deal_id,deal_number:f.callback.deal_number
 },challenge:{offer_id:f.challenge.offer_id,
  offer_revision_sha256:f.challenge.offer_revision_sha256},now:f.now}));
});
test('R130 observer fails closed on missing/false consent, USER-field substitution and wrong order binding',async()=>{
 const f=fixture();
 const cases=[
  {order:{...f.order,payload:{...f.order.payload,native_consent_accepted:false}}},
  {order:{...f.order,payload:{...f.order.payload,native_consent_required:false}}},
  {order:{...f.order,payload:{...f.order.payload,user_field_22204810_used_as_proof:true}}},
  {order:{...f.order,payload:{...f.order.payload,deal_id:'123'}}},
  {order:{...f.order,payload:{...f.order.payload,deal_number:'123'}}},
  {order:{...f.order,payload:{...f.order.payload,user_id:'123'}}},
  {order:{...f.order,payload:{...f.order.payload,offer_revision_sha256:'a'.repeat(64)}}}
 ];
 for(const item of cases){
  const transport={...f.transport,readOrderConsent:async()=>item.order};
  const result=await createNativeConsentVerifier({transport,publicKey:f.pair.publicKey})
   .verify({callback:f.callback,challenge:f.challenge});
  assert.equal(result,null);
 }
});
test('R130 observer fails closed on missing/failed unchecked-submit proof or changed Offer revision',async()=>{
 const f=fixture();
 const cases=[
  {consent_checkbox_omitted:false},
  {result:'ORDER_CREATED'},
  {order_created:true},
  {offer_id:8934925},
  {widget_id:1686753},
  {offer_revision_sha256:'b'.repeat(64)},
  {report_sha256:'not-a-sha256'}
 ];
 for(const change of cases){
  const payload={...f.negative.payload,...change};
  const bad={...f.negative,payload,
   signature:crypto.sign(null,Buffer.from(stable(payload)),f.pair.privateKey).toString('base64url')};
  const transport={...f.transport,readUncheckedSubmitNegativeTest:async()=>bad};
  const result=await createNativeConsentVerifier({transport,publicKey:f.pair.publicKey})
   .verify({callback:f.callback,challenge:f.challenge});
  assert.equal(result,null);
 }
});
test('R130 observer rejects wrong key, tampered signatures, stale evidence and nonce replay',async()=>{
 const f=fixture(),other=crypto.generateKeyPairSync('ed25519');
 const wrongKey={...f.order,key_id:keyId(other.publicKey)};
 const tampered={...f.negative,signature:f.negative.signature.slice(0,-5)+'AAAAA'};
 const stalePayload={...f.order.payload,observed_at:new Date(f.now-31*86400000).toISOString()};
 const stale={...f.order,payload:stalePayload,
  signature:crypto.sign(null,Buffer.from(stable(stalePayload)),f.pair.privateKey).toString('base64url')};
 const wrongNoncePayload={...f.negative.payload,nonce:'A'.repeat(43)};
 const wrongNonce={...f.negative,payload:wrongNoncePayload,
  signature:crypto.sign(null,Buffer.from(stable(wrongNoncePayload)),f.pair.privateKey).toString('base64url')};
 for(const [order,negative] of [
  [wrongKey,f.negative],[f.order,tampered],[stale,f.negative],[f.order,wrongNonce]
 ]){
  const transport={...f.transport,readOrderConsent:async()=>order,
   readUncheckedSubmitNegativeTest:async()=>negative};
  assert.equal(await createNativeConsentVerifier({transport,publicKey:f.pair.publicKey})
   .verify({callback:f.callback,challenge:f.challenge}),null);
 }
});
test('R130 observer requires explicitly read-only transport and is OFF by default',()=>{
 assert.equal(loadConfiguredNativeConsentVerifier({}),null);
 const f=fixture();
 assert.throws(()=>createNativeConsentVerifier({
  transport:{...f.transport,mutationMethodsAvailable:true},publicKey:f.pair.publicKey
 }),/R130_NATIVE_CONSENT_READONLY_TRANSPORT_REQUIRED/);
});
test('R130 observer transport errors do not upgrade consent and do not create a provider PASS',async()=>{
 const f=fixture(),transport={...f.transport,
  async readUncheckedSubmitNegativeTest(){throw Error('NO_NATIVE_NEGATIVE_TEST_REPORT')}
 };
 const result=await createNativeConsentVerifier({transport,publicKey:f.pair.publicKey})
  .verify({callback:f.callback,challenge:f.challenge});
 assert.equal(result,null);
});
