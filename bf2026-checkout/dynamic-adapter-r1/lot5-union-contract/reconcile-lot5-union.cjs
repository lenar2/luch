'use strict';
const EXPECTED=require('./native-order-lot5-union.expected.json');
function fail(code){const e=new Error(code);e.code=code;throw e}
const lines=new Map(EXPECTED.lines.map(x=>[x.key,x]));
function ref(x){return typeof x==='string'&&x.trim().length>=8&&!/^(unknown|todo|null|undefined)$/i.test(x.trim())}
function exactSet(actual,expected){return Array.isArray(actual)&&actual.length===expected.length&&[...actual].sort((a,b)=>a-b).every((x,i)=>x===[...expected].sort((a,b)=>a-b)[i])}
function reconcileLot5Union(record){
 if(!record||record.schema!=='bf2026.getcourse.native-order.readback.v1'||
    record.evidence_source!=='INDEPENDENT_NATIVE_GETCOURSE_READBACK')fail('NATIVE_READBACK_REQUIRED');
 const f=record.native_form;
 if(!f||!Number.isSafeInteger(f.widget_id)||f.widget_id<=0||
    f.widget_id===EXPECTED.existing_widget.id||
    f.selection_key!==EXPECTED.selection_key||
    !exactSet(f.offer_ids,EXPECTED.lines.map(x=>x.offer_id))||
    f.expected_total_rub!==EXPECTED.total_rub||
    f.selection_transfer_verified!==true||
    typeof f.public_form_url!=='string'||!/^https:\/\/wf\.tati-lar\.ru\//.test(f.public_form_url)||
    !ref(f.form_readback_ref))fail('NATIVE_MULTI_OFFER_FORM_NOT_PROVEN');
 const o=record.order,p=record.payment;
 if(!o||o.status!=='PAID'||String(o.order_id||'').length<3||
    o.selection_key!==EXPECTED.selection_key||o.currency!=='RUB'||
    o.subtotal_rub!==EXPECTED.subtotal_rub||o.discount_percent!==EXPECTED.discount_percent||
    o.savings_rub!==EXPECTED.savings_rub||o.total_rub!==EXPECTED.total_rub||
    o.pricing_version!==EXPECTED.pricing_version||o.catalog_sha256!==EXPECTED.catalog_sha256||
    o.quote_sha256!==EXPECTED.quote_sha256||!ref(o.order_readback_ref))fail('NATIVE_ORDER_PRICE_OR_PROVENANCE_MISMATCH');
 if(!p||p.status!=='SUCCEEDED'||typeof p.paid_event_id!=='string'||p.paid_event_id.length<8||
    p.paid_amount_rub!==EXPECTED.total_rub||p.currency!=='RUB'||
    !Number.isSafeInteger(p.paid_at_epoch_s)||p.paid_at_epoch_s<=0||!ref(p.payment_readback_ref))
   fail('CONFIRMED_PAYMENT_NOT_PROVEN');
 if(!Array.isArray(record.lines)||record.lines.length!==2)fail('NATIVE_ORDER_LINE_COUNT_MISMATCH');
 const seen=new Set();
 for(const l of record.lines){
   const x=lines.get(l.key);
   if(!x||seen.has(l.key)||l.offer_id!==x.offer_id||l.product_id!==x.product_id||
      l.training_id!==x.training_id||l.unit_price_rub!==x.unit_price_rub||!ref(l.line_readback_ref))
      fail('NATIVE_ORDER_LINE_PROVENANCE_MISMATCH');
   seen.add(l.key);
 }
 if(seen.size!==2)fail('NATIVE_ORDER_LINE_COUNT_MISMATCH');
 if(!Array.isArray(record.grants)||record.grants.length!==2)fail('PAID_365D_GRANT_COUNT_MISMATCH');
 const grants=new Set();
 for(const g of record.grants){
   const x=lines.get(g.key);
   if(!x||grants.has(g.key)||g.training_id!==x.training_id||g.status!=='ACTIVE'||
      g.access_start_type!=='AFTER_PAY'||g.access_finish_type!=='AFTER_DAYS'||
      g.access_days!==365||g.confirmed_paid_event_id!==p.paid_event_id||
      !ref(g.grant_readback_ref))fail('PAID_365D_GRANT_MISMATCH');
   grants.add(g.key);
 }
 if(grants.size!==2)fail('PAID_365D_GRANT_COUNT_MISMATCH');
 const r=record.receipt;
 if(!r||r.status!=='ISSUED'||r.amount_rub!==EXPECTED.total_rub||r.currency!=='RUB'||
    !ref(r.fiscal_receipt_ref)||!ref(r.tax_review_ref))fail('FISCAL_RECEIPT_OR_TAX_NOT_PROVEN');
 const c=record.consent;
 if(!c||c.mandatory_offer_terms_accepted!==true||!ref(c.consent_readback_ref))
   fail('MANDATORY_CONSENT_NOT_PROVEN');
 const d=record.duplicate_guard;
 if(!d||d.enabled!==true||d.repeat_submit_result!=='NO_SECOND_ORDER'||!ref(d.negative_test_ref))
   fail('DUPLICATE_ORDER_GUARD_NOT_PROVEN');
 const e=record.evidence_refs;
 if(!e||!['form','order','payment','receipt','tax','consent','duplicate_guard','owner_controlled_test'].every(k=>ref(e[k])))
   fail('INDEPENDENT_EVIDENCE_REFERENCES_INCOMPLETE');
 return {
   structural_match:true,
   status:'STRUCTURAL_MATCH_ONLY_HUMAN_SOURCE_ATTESTATION_REQUIRED',
   selection_key:EXPECTED.selection_key,
   total_rub:EXPECTED.total_rub,
   matched_lines:2,
   matched_paid_365d_grants:2,
   payment_event_id:p.paid_event_id,
   provider_order_id:String(o.order_id),
   external_provider_attestation:false
 };
}
module.exports={reconcileLot5Union,EXPECTED};

