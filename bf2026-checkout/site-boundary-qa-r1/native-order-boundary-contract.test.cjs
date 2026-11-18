'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const contract=require('./native-order-boundary-contract.json');
const evidence=require('./widget-1686693-inspection.json');
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
test('fresh live Widget 1686693 is not a proven two-line selection-transfer form',()=>{
 const result=assessPublicWidget(evidence);
 assert.equal(evidence.iframe.hidden_fields.setted_offer_id.value,null);
 assert.equal(result.offer_id_selection_transfer_proven,false);
 assert.equal(result.multi_offer_control_count,0);
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
