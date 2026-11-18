'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {reconcileLot5Union,EXPECTED}=require('./reconcile-lot5-union.cjs');
function fixture(){
 const paid='UNIT_TEST_EVENT_NOT_REAL';
 return {
  schema:'bf2026.getcourse.native-order.readback.v1',
  evidence_source:'INDEPENDENT_NATIVE_GETCOURSE_READBACK',
  native_form:{widget_id:1686701,selection_key:EXPECTED.selection_key,
   offer_ids:[8933492,8919715],expected_total_rub:11690,selection_transfer_verified:true,
   public_form_url:'https://wf.tati-lar.ru/__qa__/lot5-union',form_readback_ref:'UNIT_TEST_FORM_REF'},
  order:{order_id:'UNIT_TEST_ORDER_NOT_REAL',status:'PAID',selection_key:EXPECTED.selection_key,
   currency:'RUB',subtotal_rub:12990,discount_percent:10,savings_rub:1300,total_rub:11690,
   pricing_version:EXPECTED.pricing_version,catalog_sha256:EXPECTED.catalog_sha256,
   quote_sha256:EXPECTED.quote_sha256,order_readback_ref:'UNIT_TEST_ORDER_REF'},
  payment:{status:'SUCCEEDED',paid_event_id:paid,paid_amount_rub:11690,currency:'RUB',
   paid_at_epoch_s:1795050000,payment_readback_ref:'UNIT_TEST_PAYMENT_REF'},
  lines:EXPECTED.lines.map(x=>({key:x.key,offer_id:x.offer_id,product_id:x.product_id,
   training_id:x.training_id,unit_price_rub:x.unit_price_rub,line_readback_ref:'UNIT_TEST_LINE_'+x.key})),
  grants:EXPECTED.lines.map(x=>({key:x.key,training_id:x.training_id,status:'ACTIVE',
   access_start_type:'AFTER_PAY',access_finish_type:'AFTER_DAYS',access_days:365,
   confirmed_paid_event_id:paid,grant_readback_ref:'UNIT_TEST_GRANT_'+x.key})),
  receipt:{status:'ISSUED',amount_rub:11690,currency:'RUB',
   fiscal_receipt_ref:'UNIT_TEST_RECEIPT_REF',tax_review_ref:'UNIT_TEST_TAX_REF'},
  consent:{mandatory_offer_terms_accepted:true,consent_readback_ref:'UNIT_TEST_CONSENT_REF'},
  duplicate_guard:{enabled:true,repeat_submit_result:'NO_SECOND_ORDER',negative_test_ref:'UNIT_TEST_DUPLICATE_REF'},
  evidence_refs:{form:'UNIT_TEST_EVIDENCE_FORM',order:'UNIT_TEST_EVIDENCE_ORDER',
   payment:'UNIT_TEST_EVIDENCE_PAYMENT',receipt:'UNIT_TEST_EVIDENCE_RECEIPT',
   tax:'UNIT_TEST_EVIDENCE_TAX',consent:'UNIT_TEST_EVIDENCE_CONSENT',
   duplicate_guard:'UNIT_TEST_EVIDENCE_DUPLICATE',owner_controlled_test:'UNIT_TEST_OWNER_TEST'}
 };
}
test('Lot5+Union contract unit fixture checks exact lines, 11690, 365d grants, receipt and consent (NOT a native order)',()=>{
 const out=reconcileLot5Union(fixture());
 assert.equal(out.structural_match,true);
 assert.equal(out.total_rub,11690);
 assert.equal(out.matched_lines,2);
 assert.equal(out.matched_paid_365d_grants,2);
 assert.equal(out.external_provider_attestation,false);
 assert.match(out.status,/HUMAN_SOURCE_ATTESTATION_REQUIRED/);
});
test('rejects existing Lot5-only widget 1686693 for a two-line set',()=>{
 const f=fixture();f.native_form.widget_id=1686693;
 assert.throws(()=>reconcileLot5Union(f),{code:'NATIVE_MULTI_OFFER_FORM_NOT_PROVEN'});
});
test('rejects wrong subtotal/discount/rounding, one-line order or mismatched IDs',()=>{
 for(const mutate of [
  f=>f.order.total_rub=11691,
  f=>f.order.discount_percent=0,
  f=>f.lines.pop(),
  f=>f.lines[0].offer_id=1,
  f=>f.lines[1].training_id=1
 ]){const f=fixture();mutate(f);assert.throws(()=>reconcileLot5Union(f));}
});
test('rejects unpaid/missing payment and wrong paid amount',()=>{
 for(const mutate of [f=>f.order.status='NEW',f=>f.payment.status='PENDING',
   f=>f.payment.paid_amount_rub=12990,f=>f.payment.paid_event_id='']) {
   const f=fixture();mutate(f);assert.throws(()=>reconcileLot5Union(f));
 }
});
test('rejects either grant unless paid-event-bound and exactly 365 days after pay',()=>{
 for(const mutate of [f=>f.grants[0].access_days=30,
   f=>f.grants[1].access_start_type='FROM_ORDER',
   f=>f.grants[0].confirmed_paid_event_id='OTHER_EVENT',
   f=>f.grants[1].training_id=936022301]){
   const f=fixture();mutate(f);assert.throws(()=>reconcileLot5Union(f));
 }
});
test('rejects missing receipt, tax, consent or duplicate-order negative evidence',()=>{
 for(const mutate of [f=>f.receipt.amount_rub=12990,f=>f.receipt.fiscal_receipt_ref='',
   f=>f.receipt.tax_review_ref='',f=>f.consent.mandatory_offer_terms_accepted=false,
   f=>f.duplicate_guard.repeat_submit_result='SECOND_ORDER_CREATED',
   f=>f.evidence_refs.owner_controlled_test='']){
   const f=fixture();mutate(f);assert.throws(()=>reconcileLot5Union(f));
 }
});

