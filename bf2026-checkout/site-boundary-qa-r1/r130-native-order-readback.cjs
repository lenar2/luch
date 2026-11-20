'use strict';
/* R130 strict readback contract for ONE multi-position native GetCourse order.
 * Import ACK alone cannot attest positions, invoice total, payment, fiscal
 * receipt, or actual access grants. Missing native fields => HOLD.
 */
function hold(code){return Object.freeze({status:'HOLD',code,
 native_order_positions_verified:false,payment_link_release_allowed:false,
 payment_verified:false,receipt_verified:false,actual_grants_verified:false,
 sales_ready:false,grants_to_write:0})}
function equalInt(v,n){return Number.isSafeInteger(v)&&v===n}
function eqStr(v,x){return String(v??'')===String(x)}
function validateAssembledOrder({plan,dealNumber,dealId,buyerId,readback}={}){
 if(!plan||!Array.isArray(plan.lines)||!plan.lines.length||
  !readback||typeof readback!=='object')
  return hold('R130_NATIVE_ORDER_READBACK_MISSING');
 if(readback.source!=='GETCOURSE_AUTHORIZED_NATIVE_READ_ONLY_ORDER'||
  readback.account_host!=='study.shkola-dnv.com'||
  !eqStr(readback.deal_number,dealNumber)||
  !eqStr(readback.deal_id,dealId)||!eqStr(readback.user_id,buyerId))
  return hold('R130_NATIVE_ORDER_IDENTITY_MISMATCH');
 if(!['new','payment_waiting'].includes(readback.order_status))
  return hold('R130_ORDER_IS_NOT_VERIFIED_UNPAID');
 if(!Array.isArray(readback.positions)||readback.positions.length!==plan.lines.length)
  return hold('R130_ORDER_POSITIONS_NOT_EXACT');
 const seen=new Set();
 let total=0;
 for(let i=0;i<plan.lines.length;i++){
  const got=readback.positions[i],expected=plan.lines[i];
  if(!got||!equalInt(got.offer_id,expected.offer_id)||
   !equalInt(got.quantity,1)||
   !equalInt(got.price_rub,expected.discounted_line_price_rub)||
   seen.has(got.offer_id))
   return hold('R130_NATIVE_POSITION_OFFER_OR_DISCOUNT_MISMATCH');
  total+=got.price_rub;seen.add(got.offer_id);
 }
 if(!equalInt(total,plan.desired_order_total_rub)||
  !equalInt(readback.order_total_rub,plan.desired_order_total_rub)||
  readback.native_order_receipt_count!==0)
  return hold('R130_NATIVE_ORDER_TOTAL_OR_PREPAYMENT_STATE_MISMATCH');
 // Verified unpaid order does NOT release payment without independent
 // owner-approved provider-side offer consent and legitimate payment URL.
 return Object.freeze({status:'NATIVE_UNPAID_ORDER_POSITIONS_VERIFIED_HOLD_CONSENT',
  native_order_positions_verified:true,order_total_rub:total,
  payment_link_release_allowed:false,payment_verified:false,
  receipt_verified:false,actual_grants_verified:false,sales_ready:false,
  grants_to_write:0});
}
function verifyPaidAccess({plan,dealNumber,dealId,buyerId,order,receipt,grants,now=Date.now()}={}){
 if(!plan||!order||!receipt||!Array.isArray(grants))
  return hold('R130_PAID_NATIVE_EVIDENCE_INCOMPLETE');
 if(order.source!=='GETCOURSE_AUTHORIZED_NATIVE_READ_ONLY_ORDER'||
  order.account_host!=='study.shkola-dnv.com'||
  !eqStr(order.deal_number,dealNumber)||!eqStr(order.deal_id,dealId)||
  !eqStr(order.user_id,buyerId)||order.order_status!=='payed')
  return hold('R130_PAID_ORDER_NOT_NATIVE_VERIFIED');
 if(!Array.isArray(order.positions)||order.positions.length!==plan.lines.length)
  return hold('R130_PAID_ORDER_POSITIONS_INCOMPLETE');
 let total=0;
 for(let i=0;i<plan.lines.length;i++){
  const got=order.positions[i],expected=plan.lines[i];
  if(!got||got.offer_id!==expected.offer_id||
   got.price_rub!==expected.discounted_line_price_rub||
   got.quantity!==1)return hold('R130_PAID_ORDER_POSITION_MISMATCH');
  total+=got.price_rub;
 }
 if(total!==plan.desired_order_total_rub||
  order.order_total_rub!==plan.desired_order_total_rub||
  receipt.source!=='GETCOURSE_AUTHORIZED_NATIVE_FISCAL_READBACK'||
  receipt.fiscal_status!=='registered'||receipt.operation!=='income'||
  !eqStr(receipt.deal_id,dealId)||!eqStr(receipt.deal_number,dealNumber)||
  receipt.amount_rub!==total||!receipt.fiscal_receipt_number||
  receipt.refunded!==false)
  return hold('R130_PAID_FISCAL_RECEIPT_NOT_VERIFIED');
 const wanted=plan.all_product_training_pairs;
 if(grants.length!==wanted.length)
  return hold('R130_PAID_ACCESS_GRANT_COUNT_MISMATCH');
 const paidAt=Date.parse(order.payed_at);
 if(!Number.isFinite(paidAt)||paidAt>now||now-paidAt>365*86400000)
  return hold('R130_PAID_TIMESTAMP_INVALID');
 const used=new Set();
 for(const expected of wanted){
  const rows=grants.filter(g=>g?.product_id===expected.product_id&&
   g?.training_id===expected.training_id);
  if(rows.length!==1)return hold('R130_PAID_TRAINING_GRANT_MISSING_OR_DUPLICATE');
  const g=rows[0];
  if(!g.native_purchase_id||used.has(String(g.native_purchase_id))||
   g.source!=='GETCOURSE_AUTHORIZED_NATIVE_PURCHASE_READBACK'||
   !eqStr(g.deal_id,dealId)||!eqStr(g.user_id,buyerId)||
   g.access_status!=='active'||g.grant_mode!=='after_pay'||
   g.access_days!==365)return hold('R130_PAID_ACCESS_IDENTITY_OR_TERM_MISMATCH');
  const start=Date.parse(g.access_from),end=Date.parse(g.access_until);
  if(!Number.isFinite(start)||!Number.isFinite(end)||
   Math.abs(start-paidAt)>36*3600_000||
   Math.abs((end-start)/86400000-365)>1.1||end<=now)
   return hold('R130_PAID_ACCESS_WINDOW_NOT_VERIFIED');
  used.add(String(g.native_purchase_id));
 }
 // Still needs owner release and independently proven native consent.
 return Object.freeze({status:'PAID_RECEIPT_GRANTS_MATCH_HOLD_OWNER_RELEASE',
  native_order_positions_verified:true,
  payment_verified:true,receipt_verified:true,actual_grants_verified:true,
  payment_link_release_allowed:false,sales_ready:false,grants_to_write:0});
}
module.exports={validateAssembledOrder,verifyPaidAccess};
