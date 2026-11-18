'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createBoundary}=require('./site-boundary.cjs');
const {
 DOCS,ORIGINAL,HOLD,planFallback,quoteGuard,allocations,bundleCandidateStructure,bundleUnpaidStructure,
 bundlePaidStructure,decideBundleRelease,createImportDraft,partialOrderStateTransition
}=require('./provider-supported-fallback.cjs');
const adapter=createBoundary().adapter;
const input={kind:'set',items:['rejection_program','union']};
const plan=adapter.plan(input);
const bundleId=9876543; // TEST_ONLY imaginary ID, never a native GetCourse object
function bundle(){
 const rows=allocations(plan);
 return {schema:'bf2026.gc.bundle_offer_readback.r1',provider:'GetCourse',offer_id:bundleId,
  offer_total_rub:11690,currency:'RUB',product_count:2,activation_source:'NATIVE_GETCOURSE_OFFER_READBACK',
  native_evidence_refs:['TEST_ONLY-not-real-offer','TEST_ONLY-not-real-native-reload'],
  products:rows.map(r=>({product_id:r.product_id,training_id:r.training_id,
   allocated_price_rub:r.alloc_price_rub,access_days:365,grant_start:'AFTER_PAY'}))};
}
function unpaid(){
 const rows=allocations(plan);
 return {provenance:{source:'GETCOURSE_NATIVE_ORDER_DETAIL',test_fixture:true},provider_order_id:'TEST_ONLY_UNPAID',
  status:'UNPAID',currency:'RUB',offer_id:bundleId,amount_due_rub:11690,
  product_purchases:rows.map(r=>({product_id:r.product_id,training_id:r.training_id,allocated_price_rub:r.alloc_price_rub})),
  payment_events:[],grants:[]};
}
function paid(){
 const rows=allocations(plan);
 return {provenance:{source:'GETCOURSE_NATIVE_ORDER_DETAIL',test_fixture:true},provider_order_id:'TEST_ONLY_UNPAID',
  status:'PAID',currency:'RUB',offer_id:bundleId,paid_total_rub:11690,
  payment_events:[{id:'TEST_ONLY_EVENT',amount_rub:11690,status:'CAPTURED'}],
  grants:rows.map(r=>({product_id:r.product_id,training_id:r.training_id,duration_days:365,start:'AFTER_PAY',
   status:'GRANTED',paid_event_id:'TEST_ONLY_EVENT',provider_order_id:'TEST_ONLY_UNPAID'})),
  receipt:{receipt_id:'TEST_ONLY_RECEIPT',tax_readback:true},
  consent:{offer_terms_accepted:true},duplicate_guard:{negative_test_passed:true}};
}
test('real R109 plan retains exact Lot5+Union mappings and server-only 11690 total',()=>{
 const p=planFallback({adapter,input});
 assert.equal(p.schema,'bf2026.provider_supported_fallback_plan.r1');
 assert.equal(p.amount_rub,11690);
 assert.equal(p.subtotal_rub,12990);
 assert.equal(p.discount_rub,1300);
 assert.equal(p.release_state,HOLD);
 assert.equal(p.provider_submit_allowed,false);
 assert.equal(p.payment_link,null);
 assert.equal(p.candidates.length,3);
 assert.equal(p.candidates[0].mode,'NATIVE_ONE_OFFER_MULTIPLE_PRODUCTS');
 assert.equal(p.candidates[0].required_new_offers_for_this_PAIR,1);
 assert.ok(p.candidates.every(c=>c.doc.startsWith('https://getcourse.ru/')));
});
test('deterministic nearest-ten discount allocation preserves provenance and exact total',()=>{
 const a=allocations(plan);
 assert.deepEqual(a.map(x=>[x.offer_id,x.product_id,x.training_id,x.base_price,x.discount_rub,x.alloc_price_rub,x.duration_days]),[
  [8933492,4557988,936022301,6990,700,6290,365],
  [8919715,4550895,933861292,6000,600,5400,365]
 ]);
 assert.equal(a.reduce((s,x)=>s+x.alloc_price_rub,0),11690);
 assert.equal(a.reduce((s,x)=>s+x.discount_rub,0),1300);
});
test('tampered/changed R109 quote or wrong mapping is rejected before fallback planning',()=>{
 const fake={...plan,quote:{...plan.quote,total_rub:12990}};
 assert.throws(()=>quoteGuard(fake),{code:'R109_QUOTE_NOT_APPROVED'});
 const wrong={...plan,lines:plan.lines.map((l,i)=>i?{...l,training_ids:[1]}:l)};
 assert.throws(()=>quoteGuard(wrong),{code:'R109_LINE_MAPPING_NOT_APPROVED'});
 assert.throws(()=>planFallback({adapter:{plan:()=>fake},input}),{code:'R109_QUOTE_NOT_APPROVED'});
});
test('native bundle candidate requires ONE different Offer with exactly two existing Products and their Training grants',()=>{
 const x=bundleCandidateStructure(bundle(),plan);
 assert.equal(x.offer_id,bundleId);
 assert.deepEqual(x.product_ids,[4557988,4550895]);
 assert.deepEqual(x.training_ids,[936022301,933861292]);
 assert.equal(x.release_state,HOLD);
 const existing={...bundle(),offer_id:8933492};
 assert.throws(()=>bundleCandidateStructure(existing,plan),{code:'NEW_NATIVE_BUNDLE_OFFER_ID_REQUIRED'});
 const wrong={...bundle(),products:bundle().products.map((x,i)=>i?{...x,training_id:1}:x)};
 assert.throws(()=>bundleCandidateStructure(wrong,plan),{code:'BUNDLE_PRODUCT_ACCESS_OR_PRICE_MISMATCH'});
 const wrongPrice={...bundle(),offer_total_rub:12990};
 assert.throws(()=>bundleCandidateStructure(wrongPrice,plan),{code:'BUNDLE_OFFER_PRICE_MISMATCH'});
});
test('TEST_ONLY unpaid bundle shape checks exact 11690, two Products, no payments or grants; never enables checkout',()=>{
 const x=bundleUnpaidStructure(unpaid(),bundleId,plan);
 assert.equal(x.amount_due_rub,11690);
 assert.equal(x.structural_only,true);
 assert.equal(x.release_state,HOLD);
 assert.throws(()=>bundleUnpaidStructure({...unpaid(),amount_due_rub:12990},bundleId,plan),{code:'NATIVE_UNPAID_BUNDLE_CONTENT_OR_TOTAL_MISMATCH'});
 assert.throws(()=>bundleUnpaidStructure({...unpaid(),payment_events:[{id:'fake'}]},bundleId,plan),{code:'UNPAID_BUNDLE_HAS_PAYMENT_OR_GRANTS'});
 assert.throws(()=>bundleUnpaidStructure({...unpaid(),grants:[{training_id:1}]},bundleId,plan),{code:'UNPAID_BUNDLE_HAS_PAYMENT_OR_GRANTS'});
});
test('TEST_ONLY paid bundle shape checks ONE 11690 charge and exactly two grants, no external grant actions',()=>{
 const x=bundlePaidStructure(paid(),bundleId,plan);
 assert.equal(x.payment_count,1);
 assert.equal(x.provider_purchase_count,2);
 assert.equal(x.grant_authority,'GETCOURSE_NATIVE_ONLY');
 assert.equal(x.external_grant_actions,0);
 assert.equal(x.release_state,HOLD);
 const tooMany={...paid(),payment_events:[...paid().payment_events,{id:'DUP',amount_rub:11690,status:'CAPTURED'}]};
 assert.throws(()=>bundlePaidStructure(tooMany,bundleId,plan),{code:'SINGLE_11690_PAYMENT_NOT_PROVEN'});
 const duplicates={...paid(),grants:[paid().grants[0],paid().grants[0]]};
 assert.throws(()=>bundlePaidStructure(duplicates,bundleId,plan),{code:'WRONG_OR_DUPLICATE_BUNDLE_GRANTS'});
 const wrongEvent={...paid(),grants:paid().grants.map((g,i)=>i?{...g,paid_event_id:'OTHER'}:g)};
 assert.throws(()=>bundlePaidStructure(wrongEvent,bundleId,plan),{code:'WRONG_OR_DUPLICATE_BUNDLE_GRANTS'});
 const otherOrder={...paid(),grants:paid().grants.map((g,i)=>i?{...g,provider_order_id:'OTHER'}:g)};
 assert.throws(()=>bundlePaidStructure(otherOrder,bundleId,plan),{code:'WRONG_OR_DUPLICATE_BUNDLE_GRANTS'});
});
test('structurally complete TEST_ONLY evidence still cannot release a route or masquerade as native proof',()=>{
 const decision=decideBundleRelease({plan,bundleReadback:bundle(),unpaidReadback:unpaid(),paidReadback:paid()});
 assert.equal(decision.route_enabled,false);
 assert.equal(decision.release_state,HOLD);
 assert.equal(decision.code,'INDEPENDENT_TRUSTED_PROVIDER_EVIDENCE_REQUIRED');
 assert.equal(decision.structurally_valid,true);
 const forged=decideBundleRelease({plan,bundleReadback:bundle(),unpaidReadback:unpaid(),
  paidReadback:paid(),verifiedAttestation:true});
 assert.equal(forged.route_enabled,false);
 assert.equal(forged.code,'UNTRUSTED_ATTESTATION_FLAG_NOT_ACCEPTED');
});
test('official Import API fallback is a staged DRY RUN with one offer per request, same provider deal and no payment link',()=>{
 const x=createImportDraft(plan);
 assert.equal(x.runtime_use,'NOT_APPROVED_IMPORT_IS_NOT_REALTIME_CHECKOUT');
 assert.equal(x.actual_http_client_included,false);
 assert.equal(x.stage1.system.multiple_offers,0);
 assert.equal(x.stage2.system.multiple_offers,1);
 assert.equal(x.stage1.system.return_payment_link,0);
 assert.equal(x.stage2.system.return_payment_link,0);
 assert.equal(x.stage1.deal.offer_id,8933492);
 assert.equal(x.stage2.deal.offer_id,8919715);
 assert.equal(x.stage1.deal.deal_cost,6290);
 assert.equal(x.stage2.deal.deal_cost,5400);
 assert.equal(x.stage2.deal.deal_number,'REQUIRED_FROM_VERIFIED_STAGE1_RESPONSE');
 assert.equal(x.stage1.deal.deal_is_paid,0);
 assert.equal(x.stage2.deal.deal_is_paid,0);
 assert.equal(x.payment_link,null);
 assert.equal(x.release_state,HOLD);
 assert.equal(JSON.stringify(x).includes('secret_key'),false);
 assert.equal(JSON.stringify(x).includes('email@yopmail'),false);
});
test('API stage timeout cannot advance or retry until native readback reconciliation',()=>{
 let s=partialOrderStateTransition('DRAFT','STAGE1_SUBMIT');
 assert.equal(s.state,'STAGE1_SUBMITTING');
 s=partialOrderStateTransition(s.state,'TIMEOUT');
 assert.equal(s.state,'UNKNOWN_NEEDS_RECONCILIATION');
 assert.equal(s.route_enabled,false);
 assert.equal(s.payment_link,null);
 assert.throws(()=>partialOrderStateTransition(s.state,'STAGE1_SUBMIT'),{code:'STAGED_IMPORT_TRANSITION_REJECTED'});
 assert.throws(()=>partialOrderStateTransition(s.state,'STAGE2_SUBMIT'),{code:'STAGED_IMPORT_TRANSITION_REJECTED'});
 assert.throws(()=>partialOrderStateTransition(s.state,'PAYMENT_LINK_REVIEWED'),{code:'STAGED_IMPORT_TRANSITION_REJECTED'});
 s=partialOrderStateTransition(s.state,'NATIVE_READBACK_PARTIAL');
 assert.equal(s.state,'PARTIAL_UNPAID_VERIFIED');
 s=partialOrderStateTransition(s.state,'STAGE2_SUBMIT');
 assert.equal(s.state,'STAGE2_SUBMITTING');
 s=partialOrderStateTransition(s.state,'TIMEOUT');
 assert.equal(s.state,'UNKNOWN_NEEDS_RECONCILIATION');
 s=partialOrderStateTransition(s.state,'NATIVE_READBACK_FULL');
 assert.equal(s.state,'COMPOSED_UNPAID_VERIFIED');
 s=partialOrderStateTransition(s.state,'PAYMENT_LINK_REVIEWED');
 assert.equal(s.state,'LINK_RELEASE_REQUIRES_PROVIDER_QA');
 assert.equal(s.payment_link,null);
 assert.equal(s.route_enabled,false);
});
test('native cart is a documented multi-product mechanism but has no approved 11690 discount proof',()=>{
 const x=planFallback({adapter,input}).candidates.find(c=>c.mode==='NATIVE_GETCOURSE_CART');
 assert.equal(x.status,'DOCUMENTED_MULTI_ITEM_CHECKOUT_PRICE_11690_UNVERIFIED');
 assert.equal(planFallback({adapter,input}).release_state,HOLD);
});
