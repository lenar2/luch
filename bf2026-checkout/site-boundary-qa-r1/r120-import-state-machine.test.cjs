'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {plan}=require('../r119-import.cjs');
const {API_URL,createImportIntent,buildStepRequest,verifyImportApiResponse}=require('./r120-import-state-machine.cjs');
const identitySecret=Buffer.alloc(32,0x42),apiKey='TEST_ONLY_NOT_A_PROVIDER_CREDENTIAL_123';
const selection={kind:'set',items:['rejection_program','union']};
const r119=plan(selection,'qa@example.invalid','a'.repeat(32));
const response=(overrides={})=>({success:'true',action:'add',result:{
 success:'true',error:false,deal_id:'924624456',deal_number:'71994',user_id:'524210421',
 payment_link:'https://study.shkola-dnv.com/pl/sales/payment/71994',...overrides}});
const transport={responseUrl:API_URL,tlsVerified:true,redirected:false};
test('intent binds exact quote and HMACs identity without storing email',()=>{
 const i=createImportIntent({selection,email:'QA@example.invalid',checkoutIdempotencyKey:'a'.repeat(32),identitySecret});
 assert.equal(i.total_rub,11690);assert.equal(i.line_count,2);
 assert.deepEqual(i.lines, [{offer_id:8933492,amount_rub:6290},{offer_id:8919715,amount_rub:5400}]);
 assert.equal(JSON.stringify(i).includes('qa@example.invalid'),false);
 const j=createImportIntent({selection,email:'other@example.invalid',checkoutIdempotencyKey:'b'.repeat(32),identitySecret});
 assert.notEqual(i.customer_identity_hmac,j.customer_identity_hmac);
});
test('first Import API request is HTTPS POST, one new unpaid offer and no guessed deal number',()=>{
 const r=buildStepRequest({r119Plan:r119,step:0,apiKey});
 const p=new URLSearchParams(r.body),v=JSON.parse(Buffer.from(p.get('params'),'base64').toString());
 assert.equal(r.url,API_URL);assert.equal(r.provider_call_performed,false);assert.equal(r.do_not_log_body,true);
 assert.equal(p.get('action'),'add');assert.equal(p.get('key'),apiKey);
 assert.equal(v.deal.offer_id,8933492);assert.equal(v.deal.deal_cost,6290);
 assert.equal(v.deal.deal_is_paid,0);assert.equal(v.deal.deal_status,'new');
 assert.equal(v.system.multiple_offers,0);assert.equal(v.system.return_deal_number,1);
 assert.equal(v.system.return_payment_link,0);assert.equal(v.deal.deal_number,undefined);
 assert.equal(v.system.refresh_if_exists,0);
});
test('second Import API request appends only to provider-returned deal number',()=>{
 assert.throws(()=>buildStepRequest({r119Plan:r119,step:1,apiKey}),/PROVIDER_ORDER_NUMBER_REQUIRED/);
 const r=buildStepRequest({r119Plan:r119,step:1,apiKey,providerDealNumber:'71994'});
 const v=JSON.parse(Buffer.from(new URLSearchParams(r.body).get('params'),'base64').toString());
 assert.equal(v.deal.offer_id,8919715);assert.equal(v.deal.deal_cost,5400);
 assert.equal(v.deal.deal_number,'71994');assert.equal(v.deal.deal_is_paid,0);
 assert.equal(v.system.multiple_offers,1);assert.equal(v.system.return_payment_link,1);
});
test('GetCourse response identity is accepted only from exact TLS account host',()=>{
 const v=verifyImportApiResponse({body:response(),...transport,step:0});
 assert.equal(v.provider,'GetCourse');assert.equal(v.provider_deal_id,924624456);
 assert.equal(v.provider_deal_number,'71994');assert.equal(v.provider_user_id,524210421);
 assert.equal(v.transport,'HTTPS_TLS_VERIFIED');
 assert.equal(v.provider_response_signature,'NOT_DOCUMENTED_BY_GETCOURSE');
 assert.equal(v.payment_verified,false);assert.equal(v.grants_verified,false);
});
test('second response must preserve provider deal, number and user identity',()=>{
 const first=verifyImportApiResponse({body:response(),...transport,step:0});
 const second=verifyImportApiResponse({body:response(),...transport,step:1,previous:first});
 assert.equal(second.payment_link,'https://study.shkola-dnv.com/pl/sales/payment/71994');
 assert.throws(()=>verifyImportApiResponse({body:response({deal_id:'999'}),...transport,step:1,previous:first}),/ORDER_IDENTITY_CHANGED/);
 assert.throws(()=>verifyImportApiResponse({body:response({deal_number:'71996'}),...transport,step:1,previous:first}),/ORDER_IDENTITY_CHANGED/);
 assert.throws(()=>verifyImportApiResponse({body:response({user_id:'524210422'}),...transport,step:1,previous:first}),/ORDER_IDENTITY_CHANGED/);
});
test('provider response rejects transport spoofing, redirects and failed API calls',()=>{
 assert.throws(()=>verifyImportApiResponse({body:response(),responseUrl:'https://evil.example/pl/api/deals',tlsVerified:true,redirected:false,step:0}),/TRANSPORT_NOT_VERIFIED/);
 assert.throws(()=>verifyImportApiResponse({body:response(),...transport,tlsVerified:false,step:0}),/TRANSPORT_NOT_VERIFIED/);
 assert.throws(()=>verifyImportApiResponse({body:response(),...transport,redirected:true,step:0}),/TRANSPORT_NOT_VERIFIED/);
 assert.throws(()=>verifyImportApiResponse({body:{success:'false',action:'add',result:{}},...transport,step:0}),/ACTION_FAILED/);
 assert.throws(()=>verifyImportApiResponse({body:response({error:true}),...transport,step:0}),/RESULT_FAILED/);
 assert.throws(()=>verifyImportApiResponse({body:response({deal_id:'0'}),...transport,step:0}),/IDENTITY_INCOMPLETE/);
 assert.throws(()=>verifyImportApiResponse({body:response({user_id:'abc'}),...transport,step:0}),/IDENTITY_INCOMPLETE/);
});
test('payment link required only after second append and must remain on account host',()=>{
 assert.throws(()=>verifyImportApiResponse({body:response({payment_link:undefined}),...transport,step:1,
  previous:verifyImportApiResponse({body:response(),...transport,step:0})}),/PAYMENT_LINK_MISSING/);
 const first=verifyImportApiResponse({body:response(),...transport,step:0});
 assert.throws(()=>verifyImportApiResponse({body:response({payment_link:'https://evil.example/pay'}),...transport,step:1,previous:first}),/PAYMENT_LINK_HOST_INVALID/);
});
test('no payment status or paid flag can be asserted by Import API response verifier',()=>{
 const v=verifyImportApiResponse({body:response(),...transport,step:0});
 assert.equal(v.payment_verified,false);assert.equal(v.grants_verified,false);assert.equal(v.live_sale_release,false);
});
test('R119 plan remains explicitly candidate-only and network-free',()=>{
 assert.equal(r119.live_enabled,false);
 assert.throws(()=>buildStepRequest({r119Plan:{...r119,live_enabled:true},step:0,apiKey}),/TEST_PLAN_REQUIRED/);
 assert.throws(()=>buildStepRequest({r119Plan:r119,step:0,apiKey:'short'}),/API_KEY_REQUIRED/);
});
