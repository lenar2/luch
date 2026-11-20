'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {inspectNativeWidget,readNativePublicWidget}=require('./native-getcourse-widget-driver.cjs');
const HTML=[
'<script>window.checkboxMailingChecked=false;</script>',
'<form method="post" action="https://study.shkola-dnv.com/pl/lite/block-public/process?id=2263283894&amp;gcSession=DO_NOT_RETURN">',
'<input name="formParams[willCreatePaidDeal]" type="hidden" value="1">',
'<input name="formParams[offer_id][]" type="checkbox" value="8919715" data-price-value="6000">',
'<input name="formParams[offer_id][]" type="checkbox" value="8933492" data-price-value="6990">',
'<div>Я согласна с условиями оферты</div></form>'
].join('');
test('recognizes real GetCourse form structure but fails closed at 12990 vs 11690',()=>{
 const x=inspectNativeWidget(HTML);
 assert.equal(x.provider_order_method,'NATIVE_CUSTOMER_WIDGET_POST');
 assert.equal(x.native_base_total_rub,12990);
 assert.equal(x.server_approved_due_rub,11690);
 assert.equal(x.native_checkout_ready,false);
 assert.equal(x.native_unpaid_order_readback_verified,false);
 assert.equal(x.payment_url,null);
 assert.equal(JSON.stringify(x).includes('gcSession'),false);
});
test('native form transport only does GET, never submits customer data',async()=>{
 let call;
 const r=await readNativePublicWidget({fetchImpl:async(url,opts)=>{
  call={url,opts};return {status:200,url,text:async()=>HTML}
 }});
 assert.equal(call.opts.method,'GET');assert.equal(call.opts.body,undefined);
 assert.equal(r.safe_transport.buyer_data_sent,false);
 assert.equal(r.safe_transport.form_submitted,false);
});
test('rejects foreign offer or price change',()=>{
 assert.throws(()=>inspectNativeWidget(HTML.replace('value="8919715"','value="999"')),{code:'NATIVE_WIDGET_OFFER_COMPOSITION_CHANGED'});
 assert.throws(()=>inspectNativeWidget(HTML.replace('data-price-value="6990"','data-price-value="11690"')),{code:'NATIVE_WIDGET_PRICE_OR_SELECTION_MISMATCH'});
});
test('rejects unknown action host or duplicate native forms',()=>{
 assert.throws(()=>inspectNativeWidget(HTML.replace('https://study.shkola-dnv.com/pl/lite/block-public','https://evil.invalid/pl/lite/block-public')),{code:'NATIVE_WIDGET_ACTION_URL_INVALID'});
 assert.throws(()=>inspectNativeWidget(HTML+HTML),{code:'NATIVE_WIDGET_EXACTLY_ONE_FORM_REQUIRED'});
});
test('rejects unapproved redirect and cannot disclose session tokens',async()=>{
 await assert.rejects(()=>readNativePublicWidget({fetchImpl:async()=>({status:200,url:'https://evil.invalid/',text:async()=>HTML})}),{code:'LIVE_GETCOURSE_WIDGET_REDIRECT_INVALID'});
});

test('native willCreatePaidDeal=0 is recorded, never claimed as working order handler',()=>{
 const x=inspectNativeWidget(HTML.replace('value="1"','value="0"'));
 assert.equal(x.will_create_paid_deal_field_value,0);
 assert.equal(x.native_handler_action_verified,false);
 assert.equal(x.native_checkout_ready,false);
});
