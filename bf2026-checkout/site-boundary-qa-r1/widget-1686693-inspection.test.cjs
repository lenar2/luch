'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const evidence=require('./native-widget-pair-readonly-evidence.json');
const {assessNativeWidgetPair}=require('./native-order-execution-contract.cjs');
test('fresh pair snapshot: distinct form actions, one radio per native form, marketing opt-out default',()=>{
 const result=assessNativeWidgetPair(evidence);
 assert.equal(result.native_forms_observed,2);
 assert.equal(result.one_checked_radio_per_form,true);
 assert.equal(result.distinct_form_action_ids,true);
 assert.deepEqual(result.observed_offer_ids,[8919715,8933492]);
 assert.equal(evidence.widgets[0].iframe.consent.marketing_checked_by_default,false);
 assert.equal(evidence.widgets[1].iframe.consent.marketing_checked_by_default,false);
 assert.equal(evidence.safety.form_submitted,false);
});
