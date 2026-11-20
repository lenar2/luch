'use strict';
const crypto=require('node:crypto');
const {canonical}=require('./native-order-execution-contract.cjs');
const DOCS=Object.freeze({
 offer_composition:'https://getcourse.ru/blog/1218294#predlozhenie-iz-neskolkih-produktov',
 native_cart:'https://getcourse.ru/blog/275826',
 deal_import:'https://getcourse.ru/help/api'
});
const ORIGINAL=Object.freeze({
 key:'set:rejection_program|union',
 subtotal:12990,discount_percent:10,discount:1300,total:11690,currency:'RUB',
 lines:[
  {key:'rejection_program',offer_id:8933492,product_id:4557988,training_id:936022301,base_price:6990,quantity:1},
  {key:'union',offer_id:8919715,product_id:4550895,training_id:933861292,base_price:6000,quantity:1}
 ]});
const HOLD='NOT_PUBLIC_SALE_READY';
function fail(code){const e=new Error(code);e.code=code;throw e}
function exactSet(actual,expected){return Array.isArray(actual)&&actual.length===expected.length&&
  [...actual].sort((a,b)=>a-b).every((x,i)=>x===[...expected].sort((a,b)=>a-b)[i]);}
function quoteGuard(plan){
 if(!plan||plan.selection_key!==ORIGINAL.key||plan.ready_for_native_binding!==true||
    (plan.blockers||[]).length!==0||!Array.isArray(plan.lines)||plan.lines.length!==2)
  fail('UNVERIFIED_NATIVE_LOT5_UNION_MAPPING');
 const q=plan.quote||{};
 if(q.currency!==ORIGINAL.currency||q.subtotal_rub!==ORIGINAL.subtotal||q.discount_percent!==ORIGINAL.discount_percent||
    q.total_rub!==ORIGINAL.total)fail('R109_QUOTE_NOT_APPROVED');
 for(const original of ORIGINAL.lines){
  const l=plan.lines.find(x=>x.line_key===original.key);
  if(!l||!exactSet(l.offer_ids,[original.offer_id])||!exactSet(l.product_ids,[original.product_id])||
     !exactSet(l.training_ids,[original.training_id])||l.base_price_rub!==original.base_price||
     l.grant?.start!=='AFTER_PAY'||l.grant?.duration_days!==365)
   fail('R109_LINE_MAPPING_NOT_APPROVED');
 }
 return plan;
}
function allocations(plan){
 quoteGuard(plan);
 const rawDiscounts=ORIGINAL.lines.map(l=>Math.floor(l.base_price*ORIGINAL.discount_percent/100));
 const remainder=ORIGINAL.discount-rawDiscounts.reduce((a,b)=>a+b,0);
 if(remainder<0||remainder>ORIGINAL.lines.length)fail('DISCOUNT_ROUNDING_NOT_APPROVED');
 const rank=ORIGINAL.lines.map((l,i)=>({i,base:l.base_price})).sort((a,b)=>b.base-a.base||a.i-b.i);
 const discounts=rawDiscounts.slice();
 for(let i=0;i<remainder;i++)discounts[rank[i].i]++;
 const rows=ORIGINAL.lines.map((l,i)=>({...l,discount_rub:discounts[i],alloc_price_rub:l.base_price-discounts[i],
   grant_start:'AFTER_PAY',duration_days:365}));
 if(rows.reduce((s,l)=>s+l.alloc_price_rub,0)!==ORIGINAL.total||rows.reduce((s,l)=>s+l.discount_rub,0)!==ORIGINAL.discount)
  fail('ALLOCATION_SUM_MISMATCH');
 return rows;
}
function planFallback({adapter,input}){
 if(typeof adapter?.plan!=='function')fail('TRUSTED_R109_ADAPTER_REQUIRED');
 const plan=quoteGuard(adapter.plan(input));
 const rows=allocations(plan);
 return Object.freeze({
  schema:'bf2026.provider_supported_fallback_plan.r1',selection_key:ORIGINAL.key,source:'SERVER_RECOMPUTED_R109',
  amount_rub:ORIGINAL.total,subtotal_rub:ORIGINAL.subtotal,discount_percent:ORIGINAL.discount_percent,
  discount_rub:ORIGINAL.discount,currency:'RUB',allocations:rows,
  candidates:[
   {mode:'NATIVE_ONE_OFFER_MULTIPLE_PRODUCTS',priority:1,doc:DOCS.offer_composition,
    status:'DOCUMENTED_CAPABILITY_UNVERIFIED_IN_ACCOUNT',required_new_offers_for_this_PAIR:1,
    reason:'Single native Offer with both existing Products and fixed 11690 total; two purchases/365d must be proven'},
   {mode:'NATIVE_GETCOURSE_CART',priority:2,doc:DOCS.native_cart,
    status:'DOCUMENTED_MULTI_ITEM_CHECKOUT_PRICE_11690_UNVERIFIED',
    reason:'A cart can combine native Offers, but 10% plus final rounding to 11690 not proven'},
   {mode:'SEQUENTIAL_IMPORT_DEALS',priority:3,doc:DOCS.deal_import,
    status:'DOCUMENTED_IMPORT_ONLY_NOT_REALTIME_CHECKOUT_APPROVED',
    reason:'same deal number; one Offer per request; update with system.multiple_offers=1; Import API is not for operational object management'}
  ],
  release_state:HOLD,payment_link:null,provider_order_id:null,provider_submit_allowed:false,
  auto_grant_allowed:false
 });
}
function bundleCandidateStructure(proof,plan){
 quoteGuard(plan);
 if(!proof||proof.schema!=='bf2026.gc.bundle_offer_readback.r1'||proof.provider!=='GetCourse')
  fail('NATIVE_BUNDLE_EVIDENCE_REQUIRED');
 if(!Number.isSafeInteger(proof.offer_id)||proof.offer_id<=0||
    ORIGINAL.lines.some(x=>x.offer_id===proof.offer_id))fail('NEW_NATIVE_BUNDLE_OFFER_ID_REQUIRED');
 if(proof.offer_total_rub!==ORIGINAL.total||proof.currency!=='RUB')fail('BUNDLE_OFFER_PRICE_MISMATCH');
 if(proof.product_count!==2||!Array.isArray(proof.products)||proof.products.length!==2)
  fail('BUNDLE_EXACT_TWO_PRODUCTS_REQUIRED');
 const rows=allocations(plan);
 for(const row of rows){
  const p=proof.products.find(x=>x.product_id===row.product_id);
  if(!p||p.training_id!==row.training_id||p.allocated_price_rub!==row.alloc_price_rub||
     p.access_days!==365||p.grant_start!=='AFTER_PAY')fail('BUNDLE_PRODUCT_ACCESS_OR_PRICE_MISMATCH');
 }
 if(proof.activation_source!=='NATIVE_GETCOURSE_OFFER_READBACK'||proof.native_evidence_refs?.length<2)
  fail('NATIVE_BUNDLE_READBACK_REFS_REQUIRED');
 return {offer_id:proof.offer_id,source:'NATIVE_GETCOURSE_OFFER_READBACK_STRUCTURAL_ONLY',
  product_ids:rows.map(x=>x.product_id),training_ids:rows.map(x=>x.training_id),
  amount_rub:ORIGINAL.total,release_state:HOLD};
}
function bundleUnpaidStructure(order,bundleOfferId,plan){
 quoteGuard(plan);
 if(!order||order.provenance?.source!=='GETCOURSE_NATIVE_ORDER_DETAIL'||order.status!=='UNPAID'||
    typeof order.provider_order_id!=='string'||!order.provider_order_id.trim())
  fail('NATIVE_UNPAID_BUNDLE_ORDER_REQUIRED');
 if(order.currency!=='RUB'||order.amount_due_rub!==ORIGINAL.total||order.offer_id!==bundleOfferId||
    !Array.isArray(order.product_purchases)||order.product_purchases.length!==2)
  fail('NATIVE_UNPAID_BUNDLE_CONTENT_OR_TOTAL_MISMATCH');
 const rows=allocations(plan);
 for(const l of rows){
  const found=order.product_purchases.find(x=>x.product_id===l.product_id);
  if(!found||found.training_id!==l.training_id||found.allocated_price_rub!==l.alloc_price_rub)
   fail('UNPAID_BUNDLE_PRODUCT_ALLOCATION_MISMATCH');
 }
 if((order.grants||[]).length!==0||(order.payment_events||[]).length!==0)
  fail('UNPAID_BUNDLE_HAS_PAYMENT_OR_GRANTS');
 return {provider_order_id:order.provider_order_id,offer_id:bundleOfferId,amount_due_rub:11690,
  release_state:HOLD,structural_only:true};
}
function bundlePaidStructure(order,bundleOfferId,plan){
 quoteGuard(plan);
 if(!order||order.status!=='PAID'||order.provenance?.source!=='GETCOURSE_NATIVE_ORDER_DETAIL'||
    order.offer_id!==bundleOfferId||order.currency!=='RUB'||order.paid_total_rub!==11690||
    typeof order.provider_order_id!=='string'||!order.provider_order_id.trim())fail('BUNDLE_PAID_ORDER_INVALID');
 if(!Array.isArray(order.payment_events)||order.payment_events.length!==1||
    order.payment_events[0]?.amount_rub!==11690||order.payment_events[0]?.status!=='CAPTURED')
  fail('SINGLE_11690_PAYMENT_NOT_PROVEN');
 const event=order.payment_events[0].id;
 if(!event||!Array.isArray(order.grants)||order.grants.length!==2)fail('TWO_GRANTS_NOT_PROVEN');
 const rows=allocations(plan);
 for(const l of rows){
  const g=order.grants.find(x=>x.training_id===l.training_id);
  if(!g||g.product_id!==l.product_id||g.duration_days!==365||g.start!=='AFTER_PAY'||
     g.status!=='GRANTED'||g.paid_event_id!==event||
     g.provider_order_id!==order.provider_order_id)fail('WRONG_OR_DUPLICATE_BUNDLE_GRANTS');
 }
 if(order.receipt?.tax_readback!==true||!order.receipt?.receipt_id||order.consent?.offer_terms_accepted!==true||
    order.duplicate_guard?.negative_test_passed!==true)fail('RECEIPT_CONSENT_OR_DEDUPE_UNVERIFIED');
 return {provider_order_id:order.provider_order_id,paid_total_rub:11690,
  provider_purchase_count:2,payment_count:1,grant_authority:'GETCOURSE_NATIVE_ONLY',
  external_grant_actions:0,release_state:HOLD,structural_only:true};
}
function decideBundleRelease({plan,bundleReadback,unpaidReadback,paidReadback,verifiedAttestation}={}){
 try{
  const candidate=bundleCandidateStructure(bundleReadback,plan);
  const unpaid=bundleUnpaidStructure(unpaidReadback,candidate.offer_id,plan);
  const paid=bundlePaidStructure(paidReadback,candidate.offer_id,plan);
  if(unpaid.provider_order_id!==paid.provider_order_id)fail('BUNDLE_UNPAID_AND_PAID_ORDER_ID_DIFFER');
  // The structure of a fixture is not an attestation; trusted evidence verification is a separately owned integration.
  if(verifiedAttestation!==undefined)fail('UNTRUSTED_ATTESTATION_FLAG_NOT_ACCEPTED');
  return {route_enabled:false,release_state:HOLD,code:'INDEPENDENT_TRUSTED_PROVIDER_EVIDENCE_REQUIRED',
   structurally_valid:true,provider_order_id:unpaid.provider_order_id};
 }catch(e){
  return {route_enabled:false,release_state:HOLD,code:e.code||'BUNDLE_FALLBACK_UNVERIFIED'};
 }
}
function createImportDraft(plan){
 const rows=allocations(plan);
 return {
  schema:'bf2026.gc.import_deals.staged_dry_run.r1',documentation:DOCS.deal_import,
  supported_method:'POST /pl/api/deals action=add with base64 params',
  runtime_use:'NOT_APPROVED_IMPORT_IS_NOT_REALTIME_CHECKOUT',
  actual_http_client_included:false,requires_email_and_api_secret_at_execution:true,
  requires_provider_issued_deal_number_after_first_step:true,
  stage1:{
   system:{multiple_offers:0,return_payment_link:0,return_deal_number:1,refresh_if_exists:0},
   deal:{offer_id:rows[0].offer_id,deal_cost:rows[0].alloc_price_rub,deal_status:'new',deal_is_paid:0}
  },
  stage2:{
   requires:'VERIFIED_EXISTING_UNPAID_PROVIDER_DEAL_NUMBER_AND_SAME_OWNER',
   system:{multiple_offers:1,return_payment_link:0,return_deal_number:1,refresh_if_exists:0},
   deal:{offer_id:rows[1].offer_id,deal_cost:rows[1].alloc_price_rub,deal_status:'new',deal_is_paid:0,
    deal_number:'REQUIRED_FROM_VERIFIED_STAGE1_RESPONSE'}
  },
  exact_total_rub:11690,offer_count:2,external_grant_calls:0,
  payment_link:null,release_state:HOLD,
  safety:[
   'Never send both Offer IDs in one import request',
   'Never return payment link after partial stage1',
   'Never call stage2 on timeout without provider reconciliation',
   'Never retry stage2 on ambiguous outcome',
   'Never mark order PAID or call paid imports',
   'Do not expose payment or create grants without full native two-line readback at 11690'
  ]
 };
}
function partialOrderStateTransition(state,event){
 const allowed={
  DRAFT:{STAGE1_SUBMIT:'STAGE1_SUBMITTING'},
  STAGE1_SUBMITTING:{STAGE1_VERIFIED:'PARTIAL_UNPAID_VERIFIED',TIMEOUT:'UNKNOWN_NEEDS_RECONCILIATION'},
  PARTIAL_UNPAID_VERIFIED:{STAGE2_SUBMIT:'STAGE2_SUBMITTING'},
  STAGE2_SUBMITTING:{BOTH_LINES_VERIFIED:'COMPOSED_UNPAID_VERIFIED',TIMEOUT:'UNKNOWN_NEEDS_RECONCILIATION'},
  UNKNOWN_NEEDS_RECONCILIATION:{NATIVE_READBACK_FULL:'COMPOSED_UNPAID_VERIFIED',NATIVE_READBACK_PARTIAL:'PARTIAL_UNPAID_VERIFIED'},
  COMPOSED_UNPAID_VERIFIED:{PAYMENT_LINK_REVIEWED:'LINK_RELEASE_REQUIRES_PROVIDER_QA'},
  LINK_RELEASE_REQUIRES_PROVIDER_QA:{PAID_NATIVE_E2E_VERIFIED:'PAID_EVIDENCE_PENDING_OWNER_RELEASE'}
 };
 const next=allowed[state]?.[event];
 if(!next)fail('STAGED_IMPORT_TRANSITION_REJECTED');
 return {state:next,payment_link:null,route_enabled:false,release_state:HOLD,
  ambiguous:next==='UNKNOWN_NEEDS_RECONCILIATION'};
}
module.exports={DOCS,ORIGINAL,HOLD,planFallback,quoteGuard,allocations,bundleCandidateStructure,
 bundleUnpaidStructure,bundlePaidStructure,decideBundleRelease,createImportDraft,partialOrderStateTransition};
