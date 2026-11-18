'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const contract=require('./native-order-boundary-contract.json');
const evidence=require('./native-widget-pair-readonly-evidence.json');
const {assessPublicWidget,validateNativeOrderReadback}=require('./native-order-boundary-contract.cjs');
test('native contract uses exact two real Offer/Product/Training mappings and R109 total',()=>{
 const lines=contract.required_native_order.lines;
 assert.deepEqual(lines.map(x=>[x.offer_id,x.product_id,x.training_id,x.base_price_rub,x.access_days,x.grant_start]),[
  [8933492,4557988,936022301,6990,365,'AFTER_PAY'],
  [8919715,4550895,933861292,6000,365,'AFTER_PAY']
 ]);
 assert.equal(contract.required_native_order.subtotal_rub,12990);
 assert.equal(contract.required_native_order.discount_percent,10);
 assert.equal(contract.required_native_order.discount_rub,1300);
 assert.equal(contract.required_native_order.paid_total_rub,11690);
 assert.equal(contract.classification,'REQUIREMENTS_ONLY_NOT_NATIVE_ORDER_EVIDENCE');
});
test('latest public widget pair is not a proven single two-line native form',()=>{
 const result=assessPublicWidget(evidence);
 assert.equal(result.native_form_count,2);
 assert.equal(result.native_offer_radio_count,2);
 assert.deepEqual(result.observed_offer_ids,[8919715,8933492]);
 assert.equal(result.each_form_has_one_checked_radio,true);
 assert.equal(result.distinct_form_action_ids,true);
 assert.equal(result.one_native_form_with_both_offers,false);
 assert.equal(result.multi_offer_selection_proven,false);
 assert.equal(result.ready_for_two_line_native_order,false);
 assert.equal(contract.current_evidence.native_paid_two_line_order,'NOT_OBSERVED');
});
test('native order validator refuses missing, synthetic or unattested provider evidence',()=>{
 assert.throws(()=>validateNativeOrderReadback(null),{code:'NATIVE_PROVIDER_ORDER_READBACK_REQUIRED'});
 assert.throws(()=>validateNativeOrderReadback({provenance:{source:'UNIT_TEST',test_fixture:true}}),{code:'NATIVE_ORDER_PROVENANCE_REQUIRED'});
 assert.throws(()=>validateNativeOrderReadback({provenance:{source:'GETCOURSE_NATIVE_ORDER_DETAIL',synthetic:true}}),{code:'SYNTHETIC_ORDER_NOT_PROVIDER_PROOF'});
 assert.throws(()=>validateNativeOrderReadback({provenance:{source:'GETCOURSE_NATIVE_ORDER_DETAIL'}}),{code:'NATIVE_PROVIDER_ORDER_ID_REQUIRED'});
});
