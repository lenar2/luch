'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createAdapter}=require('./adapter.cjs');
const {requireNativeMatch}=require('./reconcile-native-order.cjs');
const path=require('node:path');
const {compute}=require(path.resolve(process.env.BF_R109_SERVER||'/not-set'));
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'pricing-r107.snapshot.json'),'utf8'));
const entries={};
for(let i=0;i<manifest.products.length;i++){
 const p=manifest.products[i];
 for(const v of p.key==='source'?p.variants:[null]){
  const key=p.key+(v?':'+v.key:'');
  const idx=Object.keys(entries).length;
  entries[key]={offer_ids:[90000000+idx],product_ids:[91000000+idx],
    training_ids:[92000000+idx],release_status:'ACTIVE_VERIFIED',
    native_price_rub:v?v.base_price_rub:p.base_price_rub,access_days:365,
    native_readback_ref:'SYNTHETIC_ONLY_'+idx,grant_readback_ref:'SYNTHETIC_ONLY_'+idx};
 }
}
const adapter=createAdapter({quoteFn:compute,manifest,observedMapping:entries});
function syntheticEvidence(plan){
 const event='SYNTHETIC_PAID_EVENT_001';
 return {source:'INDEPENDENT_NATIVE_READBACK_REQUIRED',status:'PAID',
  paid_at_epoch_s:1000000,paid_event_id:event,order_readback_ref:'SYNTHETIC_ORDER_READBACK_001',
  selection_key:plan.selection_key,currency:'RUB',
  subtotal_rub:plan.quote.subtotal_rub,total_rub:plan.quote.total_rub,
  discount_percent:plan.quote.discount_percent,
  lines:plan.lines.map(l=>({line_key:l.line_key,offer_ids:l.offer_ids,
    product_ids:l.product_ids,training_ids:l.training_ids,base_price_rub:l.base_price_rub})),
  grants:plan.lines.flatMap(l=>l.training_ids.map(t=>({line_key:l.line_key,training_id:t,
    access_start_type:'AFTER_PAY',access_finish_type:'AFTER_DAYS',access_days:365,
    confirmed_paid_event_id:event,grant_readback_ref:'SYNTHETIC_GRANT_READBACK_001'}))),
  fiscal_receipt:{total_rub:plan.quote.total_rub,currency:'RUB',
    native_receipt_ref:'SYNTHETIC_RECEIPT_REF',tax_legal_review_ref:'SYNTHETIC_TAX_REVIEW_REF'},
  consent_readback_ref:'SYNTHETIC_CONSENT_REF',
  duplicate_order_guard_readback_ref:'SYNTHETIC_DUPLICATE_GUARD_REF'};
}
function selections(){
 const keys=manifest.products.map(p=>p.key),audio=new Set(keys.slice(0,4));const output=[];
 for(let mask=0;mask<1<<keys.length;mask++){
  const selected=keys.filter((_,i)=>mask&(1<<i));
  if(selected.length<2||selected.length>5||
     selected.filter(k=>audio.has(k)).length>2||
     (selected.includes('rejection_program')&&selected.some(k=>audio.has(k))))continue;
  for(const v of selected.includes('source')?['1','2']:[null])
    output.push({kind:'set',items:selected,...(v?{source_variant:v}:{})});
 }return output;
}
test('265/265 synthetic native order + 365d grant + fiscal/consent structural comparisons',()=>{
 const all=selections();assert.equal(all.length,265);
 for(const s of all){const p=adapter.plan(s);const actual=syntheticEvidence(p);
   const result=requireNativeMatch(p,actual);
   assert.equal(result.structural_parity,true);
   assert.equal(result.total_rub,p.quote.total_rub);
   assert.equal(result.matched_line_count,p.lines.length);
   assert.match(result.status,/STRUCTURAL_MATCH_ONLY/);
 }
});
test('negative native provider evidence: underpayment, wrong lines, wrong course, wrong days, no receipt/consent',()=>{
 const p=adapter.plan({kind:'set',items:['rejection_program','union']});
 const ev=syntheticEvidence(p);
 for(const [mutate,code] of [
  [x=>x.total_rub++, 'PRICE_OR_SELECTION_MISMATCH'],
  [x=>x.lines.pop(),'LINE_COUNT_MISMATCH'],
  [x=>x.lines[0].offer_ids=[123], 'WRONG_NATIVE_ORDER_LINES'],
  [x=>x.grants[0].training_id=123, 'WRONG_NATIVE_TRAINING_GRANT'],
  [x=>x.grants[0].access_days=364, 'PAID_365D_GRANT_UNVERIFIED'],
  [x=>x.grants[0].confirmed_paid_event_id='wrong_event','PAID_365D_GRANT_UNVERIFIED'],
  [x=>x.fiscal_receipt.native_receipt_ref='', 'FISCAL_RECEIPT_NOT_PROVEN'],
  [x=>x.consent_readback_ref='', 'CONSENT_OR_DUPLICATE_GUARD_NOT_PROVEN'],
  [x=>x.status='UNPAID','PAYMENT_UNPROVEN']
 ]){
  const altered=structuredClone(ev);mutate(altered);
  assert.throws(()=>requireNativeMatch(p,altered),{code});
 }
});
test('unverified native mapping cannot be laundered into paid grant proof',()=>{
 const current=require('./native-mapping-observed.json').entries;
 const held=createAdapter({quoteFn:compute,manifest,observedMapping:current});
 const p=held.plan({kind:'single',lot:5});
 assert.equal(p.ready_for_native_binding,false);
 assert.throws(()=>requireNativeMatch(p,syntheticEvidence(p)),{code:'INTENT_MAPPING_HOLD'});
});

