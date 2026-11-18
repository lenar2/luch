'use strict';
const contract=require('./native-order-boundary-contract.json');
function fail(code){const e=new Error(code);e.code=code;throw e}
function assessPublicWidget(evidence){
 const i=evidence?.iframe||{};
 const h=i.hidden_fields||{};
 const controls=Number(i.offer_position_control_count||0)+Number(i.other_offer_selector_count||0);
 return {
  embed_is_checkout: false,
  lot5_handler_scope: contract.public_widget.native_handler_scope,
  offer_id_field_present:h.setted_offer_id?.present===true,
  offer_id_value:h.setted_offer_id?.value??null,
  offer_id_selection_transfer_proven:false,
  multi_offer_control_count:controls,
  multi_offer_selection_proven:false,
  ready_for_two_line_native_order:false
 };
}
// Structural validator for a future independently captured native GetCourse order.
// The caller must authenticate the supplied native readback and evidence references.
// This module deliberately contains no positive/synthetic provider-order fixture.
function validateNativeOrderReadback(order){
 if(!order||typeof order!=='object')fail('NATIVE_PROVIDER_ORDER_READBACK_REQUIRED');
 if(order.provenance?.source!=='GETCOURSE_NATIVE_ORDER_DETAIL')fail('NATIVE_ORDER_PROVENANCE_REQUIRED');
 if(order.provenance?.synthetic===true||order.provenance?.test_fixture===true)fail('SYNTHETIC_ORDER_NOT_PROVIDER_PROOF');
 if(typeof order.provider_order_id!=='string'||!order.provider_order_id.trim())fail('NATIVE_PROVIDER_ORDER_ID_REQUIRED');
 if(order.status!=='PAID'||order.currency!=='RUB'||order.paid_total_rub!==11690)fail('PAID_ORDER_TOTAL_MISMATCH');
 if(order.subtotal_rub!==12990||order.discount_percent!==10)fail('NATIVE_DISCOUNT_MISMATCH');
 const expected=contract.required_native_order.lines;
 if(!Array.isArray(order.lines)||order.lines.length!==2)fail('EXACT_TWO_NATIVE_LINES_REQUIRED');
 const actual=[...order.lines].sort((a,b)=>a.offer_id-b.offer_id);
 const wanted=[...expected].sort((a,b)=>a.offer_id-b.offer_id);
 for(let i=0;i<2;i++){
  for(const k of ['offer_id','product_id','training_id','base_price_rub'])
   if(actual[i]?.[k]!==wanted[i][k])fail('NATIVE_LINE_BINDING_MISMATCH_'+i+'_'+k);
 }
 if(!Array.isArray(order.grants)||order.grants.length!==2)fail('EXACT_TWO_NATIVE_GRANTS_REQUIRED');
 const grants=[...order.grants].sort((a,b)=>a.training_id-b.training_id);
 const training=[...expected].sort((a,b)=>a.training_id-b.training_id);
 const event=grants[0]?.paid_event_id;
 if(!event||grants.some(g=>g.paid_event_id!==event))fail('GRANTS_NOT_BOUND_TO_SAME_PAID_EVENT');
 for(let i=0;i<2;i++){
  if(grants[i].training_id!==training[i].training_id||grants[i].duration_days!==365||
     grants[i].start!=='AFTER_PAY'||grants[i].status!=='GRANTED')fail('NATIVE_GRANT_MISMATCH_'+i);
 }
 if(!order.receipt?.receipt_id||order.receipt?.tax_readback!==true)fail('FISCAL_RECEIPT_OR_TAX_MISSING');
 if(order.consent?.offer_terms_accepted!==true)fail('OFFER_TERMS_CONSENT_MISSING');
 if(order.duplicate_guard?.verified!==true||order.duplicate_guard?.negative_test_passed!==true)
  fail('DUPLICATE_GUARD_NOT_PROVEN');
 const refs=order.provenance?.evidence_refs;
 const required=['order_detail','payment_event','grants','receipt','consent','duplicate_guard'];
 if(!refs||required.some(k=>typeof refs[k]!=='string'||refs[k].length<5))
  fail('NATIVE_EVIDENCE_REFERENCES_INCOMPLETE');
 return {valid:true,provider_order_id:order.provider_order_id,paid_total_rub:11690,line_count:2,
  provider_order_status:'VALIDATED_NATIVE_READBACK_NOT_CREATED_BY_VALIDATOR'};
}
module.exports={contract,assessPublicWidget,validateNativeOrderReadback};

