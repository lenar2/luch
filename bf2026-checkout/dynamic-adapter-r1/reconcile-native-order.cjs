'use strict';
/**
 * Pure comparison of independently obtained native GetCourse order/entitlement
 * evidence against a server-authoritative BF2026 intent. NO provider access here.
 * A structural match is not third-party payment/receipt/consent attestation.
 */
function requireNativeMatch(plan,order){
 const fail=code=>{const e=new Error(code);e.code=code;throw e};
 const ids=x=>Array.isArray(x)&&x.length&&x.every(n=>Number.isSafeInteger(n)&&n>0);
 const identical=(a,b)=>JSON.stringify([...a].sort((x,y)=>x-y))===JSON.stringify([...b].sort((x,y)=>x-y));
 if(!plan||plan.schema!=='bf2026.order.intent.r1'||!plan.ready_for_native_binding||
    !Array.isArray(plan.blockers)||plan.blockers.length)fail('INTENT_MAPPING_HOLD');
 if(!order||typeof order!=='object'||order.source!=='INDEPENDENT_NATIVE_READBACK_REQUIRED')fail('UNTRUSTED_PROVIDER_EVIDENCE');
 if(order.status!=='PAID'||!Number.isSafeInteger(order.paid_at_epoch_s)||order.paid_at_epoch_s<=0||
    typeof order.paid_event_id!=='string'||order.paid_event_id.length<8)fail('PAYMENT_UNPROVEN');
 if(order.currency!=='RUB'||order.total_rub!==plan.quote.total_rub||
    order.subtotal_rub!==plan.quote.subtotal_rub||
    order.discount_percent!==plan.quote.discount_percent||
    order.selection_key!==plan.selection_key)fail('PRICE_OR_SELECTION_MISMATCH');
 if(typeof order.order_readback_ref!=='string'||order.order_readback_ref.length<8)fail('ORDER_READBACK_MISSING');
 if(!Array.isArray(order.lines)||order.lines.length!==plan.lines.length)fail('LINE_COUNT_MISMATCH');
 const byKey=new Map(order.lines.map(l=>[l.line_key,l]));
 if(byKey.size!==plan.lines.length)fail('DUPLICATE_PROVIDER_LINE');
 for(const intended of plan.lines){
   const actual=byKey.get(intended.line_key);
   if(!actual||actual.base_price_rub!==intended.base_price_rub||
      !ids(actual.offer_ids)||!identical(actual.offer_ids,intended.offer_ids)||
      !ids(actual.product_ids)||!identical(actual.product_ids,intended.product_ids)||
      !ids(actual.training_ids)||!identical(actual.training_ids,intended.training_ids))fail('WRONG_NATIVE_ORDER_LINES');
 }
 const expectedGrants=plan.lines.flatMap(l=>l.training_ids.map(t=>({
   line_key:l.line_key,training_id:t
 })));
 if(!Array.isArray(order.grants)||order.grants.length!==expectedGrants.length)fail('GRANT_COUNT_MISMATCH');
 const seen=new Set();
 for(const g of order.grants){
   const id=g.line_key+'|'+g.training_id;
   if(seen.has(id))fail('DUPLICATE_OR_EXTRA_GRANT');seen.add(id);
   if(!expectedGrants.some(e=>e.line_key===g.line_key&&e.training_id===g.training_id))fail('WRONG_NATIVE_TRAINING_GRANT');
   if(g.access_start_type!=='AFTER_PAY'||g.access_finish_type!=='AFTER_DAYS'||
      g.access_days!==365||g.confirmed_paid_event_id!==order.paid_event_id||
      typeof g.grant_readback_ref!=='string'||g.grant_readback_ref.length<8)fail('PAID_365D_GRANT_UNVERIFIED');
 }
 if(!order.fiscal_receipt||order.fiscal_receipt.total_rub!==plan.quote.total_rub||
    order.fiscal_receipt.currency!=='RUB'||
    typeof order.fiscal_receipt.native_receipt_ref!=='string'||order.fiscal_receipt.native_receipt_ref.length<8||
    typeof order.fiscal_receipt.tax_legal_review_ref!=='string'||order.fiscal_receipt.tax_legal_review_ref.length<8)
      fail('FISCAL_RECEIPT_NOT_PROVEN');
 if(typeof order.consent_readback_ref!=='string'||order.consent_readback_ref.length<8||
    typeof order.duplicate_order_guard_readback_ref!=='string'||order.duplicate_order_guard_readback_ref.length<8)
      fail('CONSENT_OR_DUPLICATE_GUARD_NOT_PROVEN');
 return {structural_parity:true,selection_key:plan.selection_key,total_rub:plan.quote.total_rub,
   matched_line_count:plan.lines.length,matched_training_grants:expectedGrants.length,
   status:'STRUCTURAL_MATCH_ONLY_EXTERNAL_NATIVE_ATTESTATION_STILL_REQUIRED'};
}
module.exports={requireNativeMatch};

