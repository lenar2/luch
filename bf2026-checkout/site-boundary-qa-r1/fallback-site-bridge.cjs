'use strict';
const {
 planFallback,decideBundleRelease,createImportDraft,HOLD
}=require('./provider-supported-fallback.cjs');
function assertCleanInput(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(new Error('BAD_FALLBACK_SELECTION'),{code:'BAD_FALLBACK_SELECTION'});
 const keys=Object.keys(input).sort().join(',');
 const expected=input.kind==='set'?'items,kind':'kind,lot';
 if(keys!==expected)throw Object.assign(new Error('CLIENT_PRICING_OVERRIDE_FORBIDDEN'),{code:'CLIENT_PRICING_OVERRIDE_FORBIDDEN'});
}
function problem(code,plan){
 return {
  ok:false,http_status:503,code,route_enabled:false,verified_sale_routes_increment:0,
  checkout_url:null,payment_link:null,order_created:false,
  provider_write_performed:false,grant_write_performed:false,release_state:HOLD,
  amount_rub:plan.amount_rub,selection_key:plan.selection_key
 };
}
function createFallbackBoundary({adapter}={}){
 if(!adapter||typeof adapter.plan!=='function')throw new Error('TRUSTED_R109_ADAPTER_REQUIRED');
 return {
  quote(input){
   assertCleanInput(input);
   const plan=planFallback({adapter,input});
   return {ok:true,http_status:200,quote:{
     currency:plan.currency,selection_key:plan.selection_key,subtotal_rub:plan.subtotal_rub,
     discount_percent:plan.discount_percent,discount_rub:plan.discount_rub,total_rub:plan.amount_rub,
     lines:plan.allocations.map(l=>({
      offer_id:l.offer_id,product_id:l.product_id,training_id:l.training_id,
      base_price_rub:l.base_price,discount_rub:l.discount_rub,allocated_price_rub:l.alloc_price_rub,
      access_days:l.duration_days,grant_start:l.grant_start
     }))
    },provider_order_status:'NOT_CREATED',checkout_url:null,sales_ready:false};
  },
  start(input,{mode='NATIVE_ONE_OFFER_MULTIPLE_PRODUCTS',evidence}={}){
   assertCleanInput(input);
   const plan=planFallback({adapter,input});
   if(mode='NATIVE_ONE_OFFER_MULTIPLE_PRODUCTS'){
    const decision=decideBundleRelease({plan:adapter.plan(input),
     bundleReadback:evidence?.bundleReadback,
     unpaidReadback:evidence?.unpaidReadback,
     paidReadback:evidence?.paidReadback,
     verifiedAttestation:evidence?.verifiedAttestation});
    return {...problem(decision.code,plan),strategy:mode,
      structural_qa_pass:decision.structurally_valid===true,
      next_action:'Obtain independently attested real native bundle Offer + unpaid/paid readbacks. Do not use structural QA as provider evidence.'};
   }
   if(mode==='NATIVE_GETCOURSE_CART')return {...problem('NATIVE_CART_11690_DISCOUNT_UNVERIFIED',plan),strategy:mode,
    next_action:'Verify an actual native GetCourse cart order with approved 11690 total before any route is registered.'};
   if(mode==='SEQUENTIAL_IMPORT_DEALS')return {...problem('IMPORT_API_NOT_APPROVED_FOR_REALTIME_SALES',plan),strategy:mode,
    stage_preview:createImportDraft(adapter.plan(input)),
    next_action:'Import API is documented for importing deals, not operative checkout; require owner and independent native provider E2E before reconsidering.'};
   return {...problem('UNSUPPORTED_FALLBACK_MODE',plan)};
  }
 };
}
module.exports={createFallbackBoundary};
