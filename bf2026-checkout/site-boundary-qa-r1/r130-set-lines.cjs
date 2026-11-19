'use strict';
/**
 * BF2026 R130 Lot 10: existing GetCourse offers -> one-order Import API plan.
 * NO API calls and NO payment/access assertions. Exact historical native IDs
 * pinned to actual UI readbacks in #4112; 265 offers are NOT created.
 */
const crypto=require('node:crypto');
const {EXPECTED}=require('./r123-single-widget-adapter.cjs');
function fail(code){const e=Error(code);e.code=code;throw e}
const KEY_TO_ROUTE=Object.freeze({
 rejection:'single:rejection',devaluation:'single:devaluation',self:'single:self',
 guilt:'single:guilt',rejection_program:'single:rejection_program',dnv:'single:dnv',
 union:'single:union',trainer:'trainer_qa_only',source:'single:source:1'
});
const TRAINER=Object.freeze({offer_id:8934247,price:28000,
 pairs:Object.freeze([[4550897,935051957]]),source:'UI_READBACK_FULL_WITH_PROMOTION'});
function quoteFromSelection(selection,quoteFn){
 if(!selection||typeof selection!=='object'||Array.isArray(selection)||selection.kind!=='set')
  fail('R130_NOT_A_DYNAMIC_SET');
 let quote;try{quote=quoteFn(selection)}catch{fail('R130_INVALID_SET_SELECTION')}
 if(!quote||quote.kind!=='set'||quote.pricing_version!=='BF2026_LOT10_CUSTOM_SET_R107'||
  quote.currency!=='RUB'||quote.count<2||quote.count>5||
  !Array.isArray(quote.items)||quote.items.length!==quote.count||
  !Number.isSafeInteger(quote.total_rub)||quote.total_rub<=0)
  fail('R130_QUOTE_SCHEMA_OR_VERSION_INVALID');
 return quote;
}
function allocateRubles(quote){
 if(!Array.isArray(quote.items)||!Number.isSafeInteger(quote.subtotal_rub)||
  !Number.isSafeInteger(quote.total_rub)||quote.subtotal_rub<=0||
  quote.total_rub<=0||quote.total_rub>quote.subtotal_rub)
  fail('R130_QUOTE_PRICE_INVALID');
 const subtotal=quote.items.reduce((v,x)=>v+x.base_price_rub,0);
 if(subtotal!==quote.subtotal_rub||quote.items.some(x=>
  !Number.isSafeInteger(x.base_price_rub)||x.base_price_rub<1))
  fail('R130_QUOTE_PRICE_NOT_RECONCILED');
 // Largest-remainder integer allocation. The sum equals the R107 total
 // after the canonical nearest-10 rounding, never more, never less.
 const base=quote.items.map((x,i)=>{
  const numerator=x.base_price_rub*quote.total_rub;
  return {i,amount:Math.floor(numerator/subtotal),remainder:numerator%subtotal};
 });
 let remainder=quote.total_rub-base.reduce((s,x)=>s+x.amount,0);
 if(remainder<0||remainder>=quote.items.length)
  fail('R130_ALLOCATION_REMAINDER_INVALID');
 for(const x of [...base].sort((a,b)=>b.remainder-a.remainder||a.i-b.i)){
  if(!remainder)break;x.amount++;remainder--;
 }
 return base.sort((a,b)=>a.i-b.i).map(x=>x.amount);
}
function buildSetImportPlan({selection,quoteFn}={}){
 if(typeof quoteFn!=='function')fail('R130_SERVER_QUOTE_FUNCTION_REQUIRED');
 const quote=quoteFromSelection(selection,quoteFn);
 const prices=allocateRubles(quote);
 const lines=quote.items.map((item,i)=>{
  const key=item.key;
  const entry=key==='trainer'?TRAINER:
   EXPECTED[key==='source'?'single:source:'+item.variant:KEY_TO_ROUTE[key]];
  if(!entry||!Number.isSafeInteger(entry.offer_id)||entry.offer_id<=0||
   !Array.isArray(entry.pairs)||!entry.pairs.length||
   entry.price!==item.base_price_rub)
   fail('R130_NATIVE_OFFER_OR_PRICE_MISMATCH');
  if(key==='trainer'&&item.base_price_rub!==28000)
   fail('R130_TRAINER_PRICE_MISMATCH');
  if(key==='source'&&!['1','2'].includes(item.variant))
   fail('R130_SOURCE_VARIANT_REQUIRED');
  const pairs=entry.pairs.map(([product_id,training_id])=>{
   if(!Number.isSafeInteger(product_id)||!Number.isSafeInteger(training_id)||
    product_id<=0||training_id<=0)
    fail('R130_NATIVE_PRODUCT_TRAINING_UNVERIFIED');
   return Object.freeze({product_id,training_id,access_days_after_pay:365});
  });
  if(key==='trainer'&&pairs[0].training_id!==935051957)
   fail('R130_TRAINER_FULL_PROGRAM_REQUIRED');
  return Object.freeze({
   key,variant:item.variant??null,site_lot:item.site_lot,
   offer_id:entry.offer_id,full_price_rub:item.base_price_rub,
   discounted_line_price_rub:prices[i],quantity:1,
   access:pairs
  });
 });
 const total=lines.reduce((s,l)=>s+l.discounted_line_price_rub,0);
 if(total!==quote.total_rub)fail('R130_ALLOCATED_TOTAL_MISMATCH');
 const canonical=JSON.stringify({pricing_version:quote.pricing_version,kind:quote.kind,
  lines:lines.map(x=>({key:x.key,variant:x.variant,offer_id:x.offer_id,
   amount:x.discounted_line_price_rub})),total});
 return Object.freeze({
  schema:'bf2026.r130.single-getcourse-order.plan.v1',
  lot:10,pricing_version:quote.pricing_version,items_count:lines.length,
  provider_writes_required:lines.length,
  desired_order_total_rub:total,discount_percent:quote.discount_percent,
  lines:Object.freeze(lines),plan_sha256:crypto.createHash('sha256').update(canonical).digest('hex'),
  all_product_training_pairs:Object.freeze([...new Map(lines.flatMap(l=>l.access)
   .map(x=>[x.product_id+':'+x.training_id,x])).values()]),
  uses_existing_offers_only:true,per_combination_offers_created:0,
  needs_multiple_import_api_requests:true,provider_order_verified:false,
  fiscal_receipt_verified:false,grants_verified:false,
  payment_link_released:false,public_sales_enabled:false
 });
}
module.exports={KEY_TO_ROUTE,TRAINER,allocateRubles,buildSetImportPlan};
