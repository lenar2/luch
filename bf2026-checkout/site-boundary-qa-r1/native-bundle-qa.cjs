'use strict';
const crypto=require('node:crypto');
const {canonical}=require('./native-order-execution-contract.cjs');
const {quoteGuard,allocations}=require('./provider-supported-fallback.cjs');
const SPEC=Object.freeze({widget_id:1686790,offer_id:8935004,action_id:'2263285969',
 amount_rub:11690,
 script_url:'https://study.shkola-dnv.com/pl/lite/widget/script?id=1686790',
 products:[{product_id:4557988,training_id:936022301,access_days:365},
           {product_id:4550895,training_id:933861292,access_days:365}],
 offer_status:'QA_INACTIVE',customer_sale_ready:false});
function fail(code){const e=new Error(code);e.code=code;throw e}
function attr(tag,key){
 const match=String(tag).match(new RegExp('(?:^|\\s)'+key.replace(/-/g,'\\-')+
  '\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27|([^\\s>]+))','i'));
 return match?.[1]??match?.[2]??match?.[3]??null;
}
function inspect(html){
 if(typeof html!=='string'||html.length>1000000)fail('NATIVE_HTML_REQUIRED');
 const forms=[...html.matchAll(/<form\b[\s\S]*?<\/form\s*>/gi)].map(m=>m[0]);
 if(forms.length!==1)fail('NATIVE_BUNDLE_NOT_ONE_FORM');
 const form=forms[0],inputTags=[...form.matchAll(/<input\b[^>]*>/gi)].map(m=>m[0]);
 const selected=inputTags.filter(x=>attr(x,'name')==='formParams[offer_id][]');
 if(selected.length!==1)fail('NATIVE_BUNDLE_NOT_ONE_OFFER');
 const input=selected[0];
 if(Number(attr(input,'value'))!==SPEC.offer_id||
    Number(attr(input,'data-price-value'))!==SPEC.amount_rub||
    attr(input,'type')!=='radio'||!/(?:^|\s)checked(?:\s|=|>)/i.test(input))
   fail('NATIVE_BUNDLE_OFFER_OR_PRICE_WRONG');
 const opentag=(form.match(/<form\b[^>]*>/i)||[])[0]||'';
 let url;try{url=new URL(attr(opentag,'action').replaceAll('&amp;','&'))}catch{fail('NATIVE_BUNDLE_ACTION_INVALID')}
 if(url.protocol!=='https:'||url.hostname!=='study.shkola-dnv.com'||
    url.pathname!=='/pl/lite/block-public/process'||
    url.searchParams.get('id')!==SPEC.action_id||
    attr(opentag,'method')!=='post')fail('NATIVE_BUNDLE_ACTION_MISMATCH');
 if(!/window\.checkboxMailingChecked\s*=\s*false/i.test(html))fail('MARKETING_PRECHECKED');
 if(!/(?:условиями оферты|оферт|oferta)/i.test(form))fail('NATIVE_OFFER_TERMS_FIELD_MISSING');
 return {native_widget_id:SPEC.widget_id,offer_id:SPEC.offer_id,amount_rub:SPEC.amount_rub,
  form_action_id:SPEC.action_id,one_form_one_offer_price_pass:true,
  legal_consent_negative_test_pass:false,offer_active_verified:false,
  actual_native_unpaid_order_verified:false,actual_native_paid_grants_verified:false,
  customer_sale_ready:false};
}
function selection(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).sort().join(',')!=='items,kind'||input.kind!=='set'||
    !Array.isArray(input.items)||input.items.length!==2||
    new Set(input.items).size!==2||
    !input.items.includes('rejection_program')||!input.items.includes('union'))
   fail('BUNDLE_SELECTION_OR_CLIENT_OVERRIDE_INVALID');
 return {kind:'set',items:['rejection_program','union']};
}
function payload(adapter,input,key){
 if(typeof adapter?.plan!=='function')fail('TRUSTED_ADAPTER_REQUIRED');
 if(typeof key!=='string'||!/^[a-f0-9]{32}$/.test(key))fail('STABLE_IDEMPOTENCY_KEY_REQUIRED');
 const plan=adapter.plan(selection(input));quoteGuard(plan);
 const allocation=allocations(plan);
 if(plan.quote.total_rub!==11690||allocation.length!==2)fail('BUNDLE_PRICE_DRIFT');
 return {
  schema:'bf2026.getcourse.single-offer-two-products.intent.v1',
  scope:'SERVER_INTERNAL_QA_ONLY',selection_key:'set:rejection_program|union',
  checkout_idempotency_key:key,provider:'GetCourse',
  native_mode:'ONE_OFFER_TWO_PRODUCTS',offer_id:SPEC.offer_id,
  widget_id:SPEC.widget_id,action_id:SPEC.action_id,
  subtotal_rub:12990,discount_rub:1300,total_rub:11690,
  products:allocation.map(x=>({original_offer_id:x.offer_id,product_id:x.product_id,
   training_id:x.training_id,base_rub:x.base_price,internal_discount_rub:x.discount_rub,
   internal_net_rub:x.alloc_price_rub,grant_start:'AFTER_PAY',access_days:365})),
  native_order_offer_count_expected:1,native_grant_count_expected:2,
  provider_order_id:null,checkout_url:null,provider_offer_active:false,
  provider_paid_order_verified:false,customer_sale_ready:false
 };
}
function sig(b,secret){return crypto.createHmac('sha256',secret).update('bf2026.gc.bundle.v1.'+b).digest('base64url')}
function seal({adapter,input,key,secret,now=Math.floor(Date.now()/1000),nonce}={}){
 if(!Buffer.isBuffer(secret)||secret.length<32)fail('SERVER_SECRET_REQUIRED');
 if(!Number.isSafeInteger(now))fail('BAD_TIME');
 const n=nonce||crypto.randomBytes(16).toString('hex');
 if(!/^[a-f0-9]{32}$/.test(n))fail('BAD_NONCE');
 const obj={schema:'bf2026.gc.bundle.envelope.v1',issued_at:now,expires_at:now+300,nonce:n,
  order:payload(adapter,input,key)};
 const enc=Buffer.from(canonical(obj)).toString('base64url');
 return 'v1.'+enc+'.'+sig(enc,secret);
}
function verify({adapter,token,secret,now=Math.floor(Date.now()/1000)}={}){
 if(!Buffer.isBuffer(secret)||secret.length<32)fail('SERVER_SECRET_REQUIRED');
 if(typeof token!=='string'||token.length>12000||!/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))fail('BAD_BUNDLE_TOKEN');
 const [,encoded,signature]=token.split('.'),given=Buffer.from(signature,'base64url'),
  expected=Buffer.from(sig(encoded,secret),'base64url');
 if(given.toString('base64url')!==signature||Buffer.from(encoded,'base64url').toString('base64url')!==encoded||
  given.length!==expected.length||!crypto.timingSafeEqual(given,expected))fail('BUNDLE_SIGNATURE_INVALID');
 let v;try{v=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'))}catch{fail('BAD_BUNDLE_TOKEN')}
 if(v.schema!=='bf2026.gc.bundle.envelope.v1'||!Number.isSafeInteger(v.issued_at)||
  !Number.isSafeInteger(v.expires_at)||v.expires_at<=now||
  v.issued_at>now+30||v.expires_at-v.issued_at!==300||
  !/^[a-f0-9]{32}$/.test(v.nonce||''))fail('BUNDLE_EXPIRED');
 if(canonical(v.order)!==canonical(payload(adapter,{kind:'set',items:['rejection_program','union']},v.order?.checkout_idempotency_key)))
  fail('BUNDLE_CATALOG_DRIFT');
 return v.order;
}
function renderQAPreview(){
 const tag=crypto.createHash('sha1').update('bf2026-native-bundle-widget-1686790').digest('hex');
 return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1"><title>QA — Комплект 11 690 ₽</title></head>'+
 '<body style="font:16px system-ui;max-width:780px;margin:20px auto;padding:16px;background:#faf7f1">'+
 '<h1>Исцеление отвержения + Союз нового времени</h1><p><strong>11 690 ₽</strong></p>'+
 '<p>Закрытая проверка GetCourse. Предложение ещё неактивно, не вводите данные покупателей и не оплачивайте.</p>'+
 '<main><script id="'+tag+'" src="'+SPEC.script_url+'"></script></main>'+
 '<p>Эта QA-страница не является публичным платежным маршрутом.</p></body></html>';
}

function confirmNativeUnpaidBundleReadback(readback){
 if(!readback||readback.schema!=='bf2026.gc.native-bundle.order-readback.v1'||
   readback.provider!=='GetCourse'||readback.capture_source!=='NATIVE_ADMIN_AND_USER_PRODUCTS_READBACK')
  fail('REAL_NATIVE_BUNDLE_ORDER_READBACK_REQUIRED');
 if(!/^\d+$/.test(String(readback.native_deal_id||''))||
    !/^\d+$/.test(String(readback.native_order_number||''))||
    !['NEW','Новый'].includes(readback.status))
  fail('NATIVE_BUNDLE_NOT_NEW_UNPAID');
 if(readback.native_offer_id!==SPEC.offer_id||readback.native_offer_line_count!==1||
    readback.order_total_rub!==11690||readback.currency!=='RUB'||
    readback.paid_total_rub!==0||readback.paid_event_count!==0)
  fail('NATIVE_BUNDLE_ONE_OFFER_11690_UNPAID_MISMATCH');
 if(!Array.isArray(readback.product_rights_config)||readback.product_rights_config.length!==2)
  fail('NATIVE_BUNDLE_TWO_PRODUCT_RIGHTS_REQUIRED');
 for(const expected of SPEC.products){
  const found=readback.product_rights_config.filter(x=>x.product_id===expected.product_id);
  if(found.length!==1||found[0].training_id!==expected.training_id||
    found[0].grant_start!=='AFTER_PAY'||found[0].access_days!==365)
   fail('NATIVE_BUNDLE_PRODUCT_TRAINING_RIGHTS_MISMATCH');
 }
 if(!Array.isArray(readback.newly_granted_product_ids)||readback.newly_granted_product_ids.length!==0)
  fail('UNPAID_NATIVE_BUNDLE_EARLY_GRANT');
 if(!Array.isArray(readback.source_refs)||readback.source_refs.length<2||
    readback.source_refs.some(x=>typeof x!=='string'||x.length<12))
  fail('NATIVE_BUNDLE_READBACK_SOURCE_REFS_REQUIRED');
 return Object.freeze({
  mode:'ONE_NATIVE_BUNDLE_OFFER_TWO_PRODUCTS',
  native_order_number:String(readback.native_order_number),
  native_deal_id:String(readback.native_deal_id),
  offer_id:SPEC.offer_id,
  order_amount_rub:11690,status:'UNPAID',
  product_count:2,configured_access_days:365,
  new_grants_before_payment:0,
  structural_readback_pass:true,
  signed_independent_provider_evidence:false,
  paid_receipt_e2e_verified:false,
  customer_sale_ready:false
 });
}
function confirmNativePaidBundleReadback({unpaid,paid}={}){
 const original=confirmNativeUnpaidBundleReadback(unpaid);
 if(!paid||paid.schema!=='bf2026.gc.native-bundle.paid-readback.v1'||
    paid.provider!=='GetCourse'||paid.native_deal_id!==original.native_deal_id||
    paid.native_order_number!==original.native_order_number||
    paid.offer_id!==SPEC.offer_id||paid.status!=='PAID'||
    paid.currency!=='RUB'||paid.amount_captured_rub!==11690||
    paid.captured_payment_events?.length!==1)
  fail('PAID_BUNDLE_ORDER_OR_ONE_PAYMENT_NOT_VERIFIED');
 const captured=paid.captured_payment_events[0];
 if(!captured||typeof captured.paid_event_id!=='string'||!captured.paid_event_id.trim()||
    captured.amount_rub!==11690||captured.status!=='CAPTURED')
  fail('SINGLE_NATIVE_11690_PAYMENT_NOT_VERIFIED');
 if(!Array.isArray(paid.grants)||paid.grants.length!==2)
  fail('BOTH_NATIVE_PRODUCT_GRANTS_REQUIRED');
 for(const expected of SPEC.products){
  const grants=paid.grants.filter(x=>x.product_id===expected.product_id);
  if(grants.length!==1||grants[0].training_id!==expected.training_id||
    grants[0].duration_days!==365||grants[0].start!=='AFTER_PAY'||
    grants[0].provider_deal_id!==original.native_deal_id||
    grants[0].paid_event_id!==captured.paid_event_id)
   fail('NATIVE_BUNDLE_GRANT_MAPPING_DUPLICATE_OR_EVENT_MISMATCH');
 }
 if(paid.receipt?.tax_readback!==true||!paid.receipt?.receipt_id||
    paid.consent?.offer_terms_accepted!==true||
    paid.duplicate_guard?.negative_test_passed!==true)
  fail('NATIVE_BUNDLE_RECEIPT_CONSENT_OR_DUPLICATE_GUARD_MISSING');
 return Object.freeze({
  provider_order_id:original.native_deal_id,
  native_order_number:original.native_order_number,
  captured_rub:11690,paid_event_id:captured.paid_event_id,
  two_native_product_grants_verified:true,
  external_grant_writes:0,
  structural_paid_readback_pass:true,
  signed_independent_provider_evidence:false,
  customer_sale_ready:false
 });
}

module.exports={SPEC,inspect,selection,payload,seal,verify,renderQAPreview,confirmNativeUnpaidBundleReadback,confirmNativePaidBundleReadback};
