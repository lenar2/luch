'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {createBoundary}=require('./site-boundary.cjs');
const {SPEC,inspect,selection,payload,seal,verify,renderQAPreview}=require('./native-bundle-qa.cjs');
const adapter=createBoundary().adapter,secret=Buffer.alloc(48,0x73),now=2000000000;
const input={kind:'set',items:['rejection_program','union']},key='a'.repeat(32);
const widgetFile='/tmp/bf2026_bundle_widget_1686790.html';
function fixture(){
 return '<script>window.checkboxMailingChecked=false;</script>'+
 '<form action="https://study.shkola-dnv.com/pl/lite/block-public/process?id=2263285969&amp;gcVisitor=redact" method="post">'+
 '<input name="formParams[offer_id][]" type="radio" checked value="8935004" data-price-value="11690">'+
 '<label>Согласие с условиями оферты</label></form>';
}
test('exact GetCourse native bundled form is one checked offer 8935004 with 11690 and the real action',()=>{
 const v=inspect(fixture());
 assert.equal(v.one_form_one_offer_price_pass,true);
 assert.equal(v.offer_id,8935004);assert.equal(v.amount_rub,11690);
 assert.equal(v.form_action_id,'2263285969');
 assert.equal(v.customer_sale_ready,false);
 assert.equal(v.actual_native_unpaid_order_verified,false);
});
test('real public GET fixture (when available) is parsed, not treated as order success',()=>{
 if(!fs.existsSync(widgetFile))return;
 const v=inspect(fs.readFileSync(widgetFile,'utf8'));
 assert.equal(v.one_form_one_offer_price_pass,true);
 assert.equal(v.offer_active_verified,false);
 assert.equal(v.actual_native_paid_grants_verified,false);
});
test('existing two-checkbox 12990 form must never be mistaken for the bundled offer',()=>{
 const h=fs.existsSync('/tmp/bf2026_bundle_widget_1686745.html')
  ?fs.readFileSync('/tmp/bf2026_bundle_widget_1686745.html','utf8')
  :fixture().replace('8935004','8933492').replace('11690','6990');
 assert.throws(()=>inspect(h));
});
test('wrong offer, wrong price, copied second form, no terms, or marketing precheck fails closed',()=>{
 const variants=[
  fixture().replace('value="8935004"','value="8933492"'),
  fixture().replace('data-price-value="11690"','data-price-value="12990"'),
  fixture()+fixture(),
  fixture().replace('условиями оферты','privacy only'),
  fixture().replace('window.checkboxMailingChecked=false','window.checkboxMailingChecked=true'),
  fixture().replace('type="radio"','type="checkbox"')
 ];
 for(const h of variants)assert.throws(()=>inspect(h));
});
test('server signed bundle intent binds ONE GetCourse Offer and two real Products/Training rights at 11690',()=>{
 const p=payload(adapter,input,key);
 assert.equal(p.scope,'SERVER_INTERNAL_QA_ONLY');
 assert.equal(p.native_mode,'ONE_OFFER_TWO_PRODUCTS');
 assert.equal(p.offer_id,SPEC.offer_id);
 assert.equal(p.widget_id,1686790);assert.equal(p.action_id,'2263285969');
 assert.deepEqual(p.products.map(l=>[l.original_offer_id,l.product_id,l.training_id,l.internal_net_rub]),[
  [8933492,4557988,936022301,6290],[8919715,4550895,933861292,5400]]);
 assert.equal(p.products.reduce((s,l)=>s+l.internal_discount_rub,0),1300);
 assert.equal(p.products.reduce((s,l)=>s+l.internal_net_rub,0),11690);
 assert.equal(p.native_order_offer_count_expected,1);
 assert.equal(p.native_grant_count_expected,2);
 assert.equal(p.provider_offer_active,false);
 assert.equal(p.customer_sale_ready,false);
 assert.equal(p.checkout_url,null);
});
test('HMAC signed bundle intent rejects client price or Offer overrides, tampering and expiry',()=>{
 const token=seal({adapter,input,key,secret,now,nonce:'b'.repeat(32)});
 const p=verify({adapter,token,secret,now:now+1});
 assert.equal(p.total_rub,11690);
 assert.equal(p.offer_id,8935004);
 assert.throws(()=>seal({adapter,input:{...input,total_rub:1},key,secret,now}),{code:'BUNDLE_SELECTION_OR_CLIENT_OVERRIDE_INVALID'});
 assert.throws(()=>seal({adapter,input,key:'bad',secret,now}),{code:'STABLE_IDEMPOTENCY_KEY_REQUIRED'});
 assert.throws(()=>verify({adapter,token,secret,now:now+301}),{code:'BUNDLE_EXPIRED'});
 assert.throws(()=>verify({adapter,token,secret:Buffer.alloc(48,9),now:now+1}),{code:'BUNDLE_SIGNATURE_INVALID'});
 const parts=token.split('.');
 const wrong=parts[0]+'.'+parts[1]+'.'+(parts[2].startsWith('A')?'B':'A')+parts[2].slice(1);
 assert.throws(()=>verify({adapter,token:wrong,secret,now:now+1}),{code:'BUNDLE_SIGNATURE_INVALID'});
});
test('QA preview is an actual GetCourse widget embed and not a buyer checkout URL',()=>{
 const h=renderQAPreview();
 assert.match(h,/widget\/script\?id=1686790/);
 assert.match(h,/11 690/);
 assert.match(h,/неактивно/);
 assert.match(h,/noindex/);
 assert.doesNotMatch(h,/8933492/);
});

const {confirmNativeUnpaidBundleReadback,confirmNativePaidBundleReadback}=require('./native-bundle-qa.cjs');
const realReported=require('./native-bundle-real-order-evidence.json');
test('real reported GetCourse Order #71994 is ONE bundle Offer, two Products, 11690 NEW/UNPAID and zero new grants',()=>{
 const v=confirmNativeUnpaidBundleReadback(realReported);
 assert.equal(v.native_order_number,'71994');
 assert.equal(v.native_deal_id,'924624456');
 assert.equal(v.offer_id,8935004);
 assert.equal(v.order_amount_rub,11690);
 assert.equal(v.product_count,2);
 assert.equal(v.new_grants_before_payment,0);
 assert.equal(v.structural_readback_pass,true);
 assert.equal(v.signed_independent_provider_evidence,false);
 assert.equal(v.paid_receipt_e2e_verified,false);
 assert.equal(v.customer_sale_ready,false);
});
test('one-Offer bundle readback rejects wrong money, double offers, grant-before-payment, and wrong Training',()=>{
 const invalid=[
  {...realReported,order_total_rub:12990},
  {...realReported,native_offer_line_count:2},
  {...realReported,status:'PAID'},
  {...realReported,paid_event_count:1},
  {...realReported,newly_granted_product_ids:[4557988]},
  {...realReported,product_rights_config:[realReported.product_rights_config[0],realReported.product_rights_config[0]]},
  {...realReported,product_rights_config:realReported.product_rights_config.map((x,i)=>i?{...x,training_id:1}:x)},
  {...realReported,native_offer_id:8933492}
 ];
 for(const v of invalid)assert.throws(()=>confirmNativeUnpaidBundleReadback(v));
});
test('paid bundle readback rejects early declaration with no real payment/receipt/grant evidence',()=>{
 assert.throws(()=>confirmNativePaidBundleReadback({unpaid:realReported,paid:undefined}),
  {code:'PAID_BUNDLE_ORDER_OR_ONE_PAYMENT_NOT_VERIFIED'});
 assert.throws(()=>confirmNativePaidBundleReadback({unpaid:realReported,paid:{status:'PAID',amount_captured_rub:11690}}));
});
test('TEST_ONLY paid fixture validates two GetCourse native grants but never unlocks customer sales',()=>{
 const paid={schema:'bf2026.gc.native-bundle.paid-readback.v1',provider:'GetCourse',
  native_deal_id:'924624456',native_order_number:'71994',offer_id:8935004,status:'PAID',currency:'RUB',
  amount_captured_rub:11690,
  captured_payment_events:[{paid_event_id:'TEST_ONLY_PAYMENT',amount_rub:11690,status:'CAPTURED'}],
  grants:[
   {product_id:4557988,training_id:936022301,duration_days:365,start:'AFTER_PAY',provider_deal_id:'924624456',paid_event_id:'TEST_ONLY_PAYMENT'},
   {product_id:4550895,training_id:933861292,duration_days:365,start:'AFTER_PAY',provider_deal_id:'924624456',paid_event_id:'TEST_ONLY_PAYMENT'}
  ],
  receipt:{tax_readback:true,receipt_id:'TEST_ONLY_RECEIPT'},
  consent:{offer_terms_accepted:true},duplicate_guard:{negative_test_passed:true}
 };
 const v=confirmNativePaidBundleReadback({unpaid:realReported,paid});
 assert.equal(v.captured_rub,11690);
 assert.equal(v.two_native_product_grants_verified,true);
 assert.equal(v.external_grant_writes,0);
 assert.equal(v.signed_independent_provider_evidence,false);
 assert.equal(v.customer_sale_ready,false);
 const dup={...paid,grants:[paid.grants[0],paid.grants[0]]};
 assert.throws(()=>confirmNativePaidBundleReadback({unpaid:realReported,paid:dup}),{code:'NATIVE_BUNDLE_GRANT_MAPPING_DUPLICATE_OR_EVENT_MISMATCH'});
 const wrongPayment={...paid,captured_payment_events:[paid.captured_payment_events[0],paid.captured_payment_events[0]]};
 assert.throws(()=>confirmNativePaidBundleReadback({unpaid:realReported,paid:wrongPayment}),{code:'PAID_BUNDLE_ORDER_OR_ONE_PAYMENT_NOT_VERIFIED'});
});
