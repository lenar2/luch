'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const STAGE='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
const stage=process.env.BF2026_STAGE_ONLY==='1';
const {buildSetImportPlan}=require('./r130-set-lines.cjs');
const {validateAssembledOrder,verifyPaidAccess}=require('./r130-native-order-readback.cjs');
const {ownerConfig,createOwnerImportTransport}=require('./r130-write-provider-config.cjs');
test('R130 native readback never claims payment/grants without real provider source', {skip:!stage},()=>{
 const q=require(STAGE+'/server.js').compute;
 const plan=buildSetImportPlan({selection:{
  kind:'set',items:['rejection_program','union','trainer','source','dnv'],source_variant:'2'
 },quoteFn:q});
 const base={source:'GETCOURSE_AUTHORIZED_NATIVE_READ_ONLY_ORDER',
  account_host:'study.shkola-dnv.com',deal_id:'991301',deal_number:'812345678901234',
  user_id:'991302',order_status:'new',
  positions:plan.lines.map(l=>({offer_id:l.offer_id,quantity:1,price_rub:l.discounted_line_price_rub})),
  order_total_rub:plan.desired_order_total_rub,native_order_receipt_count:0};
 const state=validateAssembledOrder({plan,dealId:'991301',dealNumber:'812345678901234',buyerId:'991302',readback:base});
 assert.equal(state.status,'NATIVE_UNPAID_ORDER_POSITIONS_VERIFIED_HOLD_CONSENT');
 assert.equal(state.payment_link_release_allowed,false);
 assert.equal(state.actual_grants_verified,false);
 for(const diff of [
  {...base,account_host:'attacker.invalid'},
  {...base,order_total_rub:1},
  {...base,positions:base.positions.slice(0,-1)},
  {...base,positions:base.positions.map((p,i)=>i===1?{...p,offer_id:123}:p)},
  {...base,positions:base.positions.map((p,i)=>i===1?{...p,price_rub:p.price_rub-1}:p)},
  {...base,order_status:'payed'},
  {...base,source:'WEBHOOK_CLIENT_CLAIM'}
 ]){
  const result=validateAssembledOrder({plan,dealId:'991301',dealNumber:'812345678901234',buyerId:'991302',readback:diff});
  assert.equal(result.status,'HOLD');
  assert.equal(result.payment_link_release_allowed,false);
 }
 const grants=plan.all_product_training_pairs.map((item,i)=>({
  ...item,source:'GETCOURSE_AUTHORIZED_NATIVE_PURCHASE_READBACK',
  native_purchase_id:'PURCHASE_'+i,deal_id:'991301',user_id:'991302',
  access_status:'active',grant_mode:'after_pay',access_days:365,
  access_from:'2026-11-19T09:00:00Z',access_until:'2027-11-19T09:00:00Z'
 }));
 const invoice={...base,order_status:'payed',payed_at:'2026-11-19T09:00:00Z'};
 const receipt={source:'GETCOURSE_AUTHORIZED_NATIVE_FISCAL_READBACK',
  fiscal_status:'registered',operation:'income',deal_id:'991301',
  deal_number:'812345678901234',amount_rub:plan.desired_order_total_rub,
  fiscal_receipt_number:'TEST_ONLY',refunded:false};
 const witness=verifyPaidAccess({plan,dealId:'991301',
  dealNumber:'812345678901234',buyerId:'991302',order:invoice,
  receipt,grants,now:Date.parse('2026-11-20T08:00:00Z')});
 assert.equal(witness.actual_grants_verified,true);
 assert.equal(witness.sales_ready,false);
 assert.equal(witness.status,'PAID_RECEIPT_GRANTS_MATCH_HOLD_OWNER_RELEASE');
 assert.equal(verifyPaidAccess({plan,dealId:'991301',
  dealNumber:'812345678901234',buyerId:'991302',order:invoice,
  receipt,grants:grants.slice(0,-1),now:Date.parse('2026-11-20T08:00:00Z')}).status,'HOLD');
 assert.equal(verifyPaidAccess({plan,dealId:'991301',
  dealNumber:'812345678901234',buyerId:'991302',order:invoice,
  receipt:{...receipt,amount_rub:1},grants,now:Date.parse('2026-11-20T08:00:00Z')}).status,'HOLD');
});
test('R130 write credential remains disabled unless owner provides private write key',()=>{
 assert.equal(ownerConfig({}),null);
 assert.equal(createOwnerImportTransport({env:{}}),null);
 assert.equal(ownerConfig({BF2026_R130_IMPORT_ENABLED:'1',
  BF2026_R130_WRITE_KEY_FILE:'/tmp/fake-read-only-key'}),null);
});
