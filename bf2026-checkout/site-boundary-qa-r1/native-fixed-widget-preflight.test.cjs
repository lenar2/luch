'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {inspect,EXPECTED}=require('./native-fixed-widget-preflight.cjs');
const spec=EXPECTED[0];
function fixture(offer=8933492,price=6990,extra=''){
 return [
 '<script>window.checkboxMailingEnabled=true;window.checkboxMailingChecked=false;window.isMailingCheckboxRequired=false;</script>',
 '<form method="post" action="https://study.shkola-dnv.com/pl/lite/block-public/process?id=123">',
 '<input name="formParams[offer_id][]" type="radio" checked value="'+offer+'" data-price-value="'+price+'">',
 '<div data-title="Я согласна с условиями оферты"></div></form>',extra].join('');
}
test('exact single offer and terms passes structural check but not live sales',()=>{
 const x=inspect(fixture(),spec);assert.equal(x.public_structure_pass,true);
 assert.equal(x.public_sale_ready,false);assert.equal(x.form_count,1);
});
test('copy-pasted foreign Union form is blocked',()=>{
 const extra='<form action="https://study.shkola-dnv.com/pl/lite/block-public/process?id=124"><input name="formParams[offer_id][]" type="radio" checked value="8919715" data-price-value="6000"></form>';
 const x=inspect(fixture(8933492,6990,extra),spec);
 assert.equal(x.public_structure_pass,false);assert.equal(x.form_count,2);
 assert.ok(x.issues.includes('FORM_COUNT_NOT_ONE'));
 assert.deepEqual(x.forms.map(f=>f.offers[0].offer_id),[8933492,8919715]);
});
test('unexpected offer or price cannot be embedded',()=>{
 assert.ok(inspect(fixture(8919715),spec).issues.includes('OFFER_MAPPING_MISMATCH'));
 assert.ok(inspect(fixture(8933492,12990),spec).issues.includes('PUBLIC_PRICE_MISMATCH'));
});
test('missing explicit oferta in the same form blocks release',()=>{
 assert.ok(inspect(fixture().replace('Я согласна с условиями оферты',''),spec).issues.includes('EXPLICIT_OFFER_TERMS_MISSING'));
});
test('marketing precheck or forced opt-in blocks release',()=>{
 for(const [before,after] of [['window.checkboxMailingChecked=false','window.checkboxMailingChecked=true'],
 ['window.isMailingCheckboxRequired=false','window.isMailingCheckboxRequired=true']]){
  assert.ok(inspect(fixture().replace(before,after),spec).issues.includes('MARKETING_CONSENT_DEFAULT_OR_REQUIRED'));
 }
});
test('single-offer widget must use one selected radio not an unchecked checkbox',()=>{
 assert.ok(inspect(fixture().replace('type="radio" checked','type="radio"'),spec).issues.includes('DEFAULT_OFFER_SELECTION_MISMATCH'));
 assert.ok(inspect(fixture().replace('type="radio" checked','type="checkbox" checked'),spec).issues.includes('DEFAULT_OFFER_SELECTION_MISMATCH'));
});