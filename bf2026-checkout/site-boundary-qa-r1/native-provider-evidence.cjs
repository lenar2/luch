'use strict';
const crypto=require('node:crypto');
const EXPECTED={
 form_host:'study.shkola-dnv.com',
 form_path:'/pl/lite/widget/widget',
 action_path:'/pl/lite/block-public/process',
 action_host:'study.shkola-dnv.com',
 selection_field:'formParams[offer_id][]',
 lines:[
  {offer_id:8933492,product_id:4557988,training_id:936022301,base_price_rub:6990,quantity:1},
  {offer_id:8919715,product_id:4550895,training_id:933861292,base_price_rub:6000,quantity:1}
 ],
 subtotal_rub:12990,discount_percent:10,discount_rub:1300,total_rub:11690
};
const verifiedObjects=new WeakSet();
function fail(code){const e=new Error(code);e.code=code;throw e}
function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const v of Object.values(value))deepFreeze(v);Object.freeze(value);}return value;}
function canonical(x){
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(x&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype)
  return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 if(x===null||['string','number','boolean'].includes(typeof x))return JSON.stringify(x);
 return fail('NON_CANONICAL_EVIDENCE_VALUE');
}
function sha256(x){return crypto.createHash('sha256').update(Buffer.isBuffer(x)?x:Buffer.from(String(x))).digest('hex')}
function attrs(tag){
 const out={};
 for(const m of tag.matchAll(/([A-Za-z_][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))
  out[m[1].toLowerCase()]=m[2]??m[3]??m[4]??'';
 for(const name of ['checked','multiple','selected'])if(new RegExp('(?:^|\\s)'+name+'(?:\\s|=|/?>)','i').test(tag))out[name]='';
 return out;
}
function decodeHtml(s){return String(s).replace(/&amp;/g,'&').replace(/&#38;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");}
function stableAction(raw){
 let u;try{u=new URL(decodeHtml(raw))}catch{fail('NATIVE_FORM_ACTION_URL_INVALID')}
 if(u.protocol!=='https:'||u.hostname!==EXPECTED.action_host||u.pathname!==EXPECTED.action_path||!u.searchParams.get('id'))
  fail('NATIVE_FORM_ACTION_URL_INVALID');
 return {origin:u.origin,path:u.pathname,action_id:u.searchParams.get('id')};
}
function parseNativeForm(html,bundle){
 const forms=[...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form\s*>/gi)];
 if(forms.length!==1)fail('EXACTLY_ONE_NATIVE_FORM_REQUIRED');
 const formAttrs=attrs('<form '+forms[0][1]+'>');
 if(String(formAttrs.method||'').toLowerCase()!=='post')fail('NATIVE_FORM_METHOD_NOT_POST');
 const action=stableAction(formAttrs.action||'');
 if(action.action_id!==String(bundle.form.action_id))fail('NATIVE_FORM_ACTION_ID_MISMATCH');
 const publicUrl=new URL(bundle.form.public_url);
 if(publicUrl.protocol!=='https:'||publicUrl.hostname!==EXPECTED.form_host||publicUrl.pathname!==EXPECTED.form_path||
    publicUrl.searchParams.get('id')!==String(bundle.form.widget_id))fail('NATIVE_WIDGET_PUBLIC_URL_MISMATCH');
 const body=forms[0][2];
 const selected=[];
 const inputs=[...body.matchAll(/<input\b[^>]*>/gi)].map(m=>attrs(m[0]));
 for(const a of inputs){
  if(a.name!==EXPECTED.selection_field)continue;
  if(a.type!=='checkbox')fail('NATIVE_FORM_NOT_MULTI_SELECTABLE');
  if(Object.prototype.hasOwnProperty.call(a,'checked'))selected.push(Number(a.value));
 }
 const selects=[...body.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select\s*>/gi)];
 for(const m of selects){
  const a=attrs('<select '+m[1]+'>');
  if(a.name!==EXPECTED.selection_field)continue;
  if(!Object.prototype.hasOwnProperty.call(a,'multiple'))fail('NATIVE_FORM_NOT_MULTI_SELECTABLE');
  for(const opt of m[2].matchAll(/<option\b[^>]*>/gi)){
   const oa=attrs(opt[0]);if(Object.prototype.hasOwnProperty.call(oa,'selected'))selected.push(Number(oa.value));
  }
 }
 const sorted=selected.sort((a,b)=>a-b);
 const expected=EXPECTED.lines.map(x=>x.offer_id).sort((a,b)=>a-b);
 if(JSON.stringify(sorted)!==JSON.stringify(expected))fail('NATIVE_FORM_SELECTED_OFFER_IDS_MISMATCH');
 if(bundle.form.selection_field!==EXPECTED.selection_field)fail('NATIVE_FORM_SELECTION_FIELD_MISMATCH');
 const declared=(bundle.form.offer_ids||[]).map(Number).sort((a,b)=>a-b);
 if(JSON.stringify(declared)!==JSON.stringify(expected))fail('NATIVE_FORM_DECLARED_OFFER_IDS_MISMATCH');
 if(bundle.form.method&&String(bundle.form.method).toUpperCase()!=='POST')fail('NATIVE_FORM_METHOD_NOT_POST');
 if(!['MULTI_VALUE_CHECKBOX','MULTI_VALUE_SELECT'].includes(bundle.form.selection_encoding))fail('NATIVE_FORM_SELECTION_ENCODING_UNSUPPORTED');
 return {
  widget_id:Number(bundle.form.widget_id),public_url:bundle.form.public_url,
  method:'POST',action_id:action.action_id,
  action_url_stable:action.origin+action.path+'?id='+encodeURIComponent(action.action_id),
  selection_field:EXPECTED.selection_field,selection_encoding:bundle.form.selection_encoding,
  selected_offer_ids:sorted
 };
}
function validateOrderShape(order,form,captureType){
 if(!order||order.source!=='GETCOURSE_NATIVE_ORDER_DETAIL')fail('NATIVE_ORDER_SOURCE_INVALID');
 if(captureType==='LIVE_PROVIDER_CAPTURE'&&(order.synthetic===true||order.test_fixture===true))
  fail('SYNTHETIC_ORDER_CANNOT_BE_LIVE_EVIDENCE');
 if(typeof order.provider_order_id!=='string'||!order.provider_order_id.trim())fail('NATIVE_PROVIDER_ORDER_ID_REQUIRED');
 if(String(order.source_form_action_id)!==form.action_id||Number(order.source_form_widget_id)!==form.widget_id)
  fail('NATIVE_ORDER_NOT_RECONCILED_TO_FORM_ACTION');
 if(!['UNPAID','PAID'].includes(order.status)||order.currency!=='RUB')fail('NATIVE_ORDER_STATUS_OR_CURRENCY_INVALID');
 if(order.subtotal_rub!==EXPECTED.subtotal_rub||order.discount_percent!==EXPECTED.discount_percent||
    order.discount_rub!==EXPECTED.discount_rub)fail('NATIVE_ORDER_DISCOUNT_RECONCILIATION_FAILED');
 if(order.status==='UNPAID'&&order.amount_due_rub!==EXPECTED.total_rub)fail('NATIVE_UNPAID_AMOUNT_DUE_MISMATCH');
 if(order.status==='PAID'&&order.paid_total_rub!==EXPECTED.total_rub)fail('NATIVE_PAID_TOTAL_MISMATCH');
 if(!Array.isArray(order.lines)||order.lines.length!==2)fail('NATIVE_ORDER_MUST_HAVE_EXACTLY_TWO_LINES');
 const lines=[...order.lines].sort((a,b)=>a.offer_id-b.offer_id);
 const wanted=[...EXPECTED.lines].sort((a,b)=>a.offer_id-b.offer_id);
 for(let i=0;i<2;i++){
  for(const k of ['offer_id','product_id','training_id','base_price_rub','quantity']){
   if(lines[i]?.[k]!==wanted[i][k])fail('NATIVE_ORDER_LINE_MISMATCH_'+i+'_'+k);
  }
  if(lines[i].line_total_rub!==undefined&&lines[i].line_total_rub!==wanted[i].base_price_rub)
   fail('NATIVE_ORDER_LINE_TOTAL_MISMATCH_'+i);
 }
 if(order.status==='UNPAID'){
  if(Array.isArray(order.grants)&&order.grants.length)fail('GRANTS_BEFORE_CONFIRMED_PAYMENT');
 }else{
  if(!Array.isArray(order.grants)||order.grants.length!==2)fail('PAID_ORDER_REQUIRES_EXACTLY_TWO_GRANTS');
  const grants=[...order.grants].sort((a,b)=>a.training_id-b.training_id);
  const byTraining=[...wanted].sort((a,b)=>a.training_id-b.training_id);
  const paidEvent=grants[0]?.paid_event_id;
  if(!paidEvent||grants.some(g=>g.paid_event_id!==paidEvent))fail('GRANTS_NOT_BOUND_TO_SAME_PAID_EVENT');
  for(let i=0;i<2;i++){
   const g=grants[i],w=byTraining[i];
   if(g.offer_id!==w.offer_id||g.product_id!==w.product_id||g.training_id!==w.training_id||
      g.provider_order_id!==order.provider_order_id||g.duration_days!==365||g.start!=='AFTER_PAY'||g.status!=='GRANTED')
    fail('PAID_GRANT_MAPPING_MISMATCH_'+i);
  }
  if(!order.payment_event_id||order.payment_event_id!==paidEvent)fail('PAID_EVENT_ID_MISMATCH');
  if(!order.receipt?.receipt_id||order.receipt?.tax_readback!==true)fail('FISCAL_RECEIPT_OR_TAX_MISSING');
  if(order.consent?.offer_terms_accepted!==true)fail('OFFER_TERMS_CONSENT_MISSING');
  if(order.duplicate_guard?.verified!==true||order.duplicate_guard?.negative_test_passed!==true)
   fail('DUPLICATE_GUARD_NOT_PROVEN');
 }
 return JSON.parse(JSON.stringify(order));
}
function verifySignature(unsigned,attestation,key){
 if(!attestation||attestation.algorithm!=='Ed25519'||typeof attestation.signature!=='string'||
    typeof attestation.key_id!=='string')fail('PROVIDER_EVIDENCE_ATTESTATION_MISSING');
 if(!key)fail('PROVIDER_EVIDENCE_TRUST_KEY_UNKNOWN');
 if(!key.publicKey)fail('PROVIDER_EVIDENCE_PUBLIC_KEY_MISSING');
 let signature;try{signature=Buffer.from(attestation.signature,'base64url')}catch{fail('PROVIDER_EVIDENCE_SIGNATURE_INVALID')}
 if(signature.length!==64||!crypto.verify(null,Buffer.from(canonical(unsigned)),key.publicKey,signature))
  fail('PROVIDER_EVIDENCE_SIGNATURE_INVALID');
}
function verifyProviderEvidenceBundle({bundle,artifacts,trustedKeys,nowMs=Date.now(),maxAgeMs=24*60*60*1000}){
 if(!bundle||bundle.schema!=='bf2026.getcourse.provider-evidence.v1'||bundle.provider!=='GetCourse')
  fail('PROVIDER_EVIDENCE_SCHEMA_INVALID');
 if(!['LIVE_PROVIDER_CAPTURE','TEST_FIXTURE'].includes(bundle.capture_type))fail('PROVIDER_EVIDENCE_CAPTURE_TYPE_INVALID');
 if(typeof bundle.attested_by!=='string'||!bundle.attested_by.trim())fail('PROVIDER_EVIDENCE_ATTESTOR_REQUIRED');
 const capturedAt=Date.parse(bundle.captured_at);
 if(!Number.isFinite(capturedAt)||capturedAt>nowMs+5*60*1000||nowMs-capturedAt>maxAgeMs)
  fail('PROVIDER_EVIDENCE_CAPTURE_TIME_INVALID');
 const attestation=bundle.attestation;
 const key=trustedKeys?.[attestation?.key_id];
 verifySignature(Object.fromEntries(Object.entries(bundle).filter(([k])=>k!=='attestation')),attestation,key);
 const expectedTrust=bundle.capture_type==='LIVE_PROVIDER_CAPTURE'?'SITE_ENGINEER_ATTESTED':'TEST_ONLY';
 if(key.trust_level!==expectedTrust)fail('PROVIDER_EVIDENCE_TRUST_LEVEL_MISMATCH');
 if(bundle.capture_type==='LIVE_PROVIDER_CAPTURE'&&key.usage!=='BF2026_GETCOURSE_PROVIDER_EVIDENCE')
  fail('PROVIDER_EVIDENCE_KEY_USAGE_INVALID');
 const formArtifact=bundle.artifacts?.form_html,orderArtifact=bundle.artifacts?.order_json;
 if(!formArtifact?.ref||!orderArtifact?.ref||formArtifact.ref===orderArtifact.ref||
    !/^[a-f0-9]{64}$/.test(formArtifact.sha256||'')||!/^[a-f0-9]{64}$/.test(orderArtifact.sha256||''))
  fail('PROVIDER_EVIDENCE_ARTIFACT_MANIFEST_INVALID');
 const formBytes=artifacts?.[formArtifact.ref],orderBytes=artifacts?.[orderArtifact.ref];
 if(formBytes===undefined||orderBytes===undefined)fail('PROVIDER_EVIDENCE_ARTIFACT_MISSING');
 const formHtml=Buffer.isBuffer(formBytes)?formBytes.toString('utf8'):String(formBytes);
 const orderJson=Buffer.isBuffer(orderBytes)?orderBytes.toString('utf8'):String(orderBytes);
 if(sha256(formBytes)!==formArtifact.sha256||sha256(orderBytes)!==orderArtifact.sha256)
  fail('PROVIDER_EVIDENCE_ARTIFACT_HASH_MISMATCH');
 let order;try{order=JSON.parse(orderJson)}catch{fail('NATIVE_ORDER_ARTIFACT_NOT_JSON')}
 const form=parseNativeForm(formHtml,bundle);
 const normalizedOrder=validateOrderShape(order,form,bundle.capture_type);
 const result={
  schema:'bf2026.verified-provider-evidence.v1',
  evidence_class:bundle.capture_type==='LIVE_PROVIDER_CAPTURE'?'SITE_ENGINEER_ATTESTED_PROVIDER_CAPTURE':'TEST_FIXTURE_ONLY',
  provider_verified:bundle.capture_type==='LIVE_PROVIDER_CAPTURE'&&key.trust_level==='SITE_ENGINEER_ATTESTED',
  key_id:attestation.key_id,captured_at:bundle.captured_at,
  form,order:normalizedOrder,
  artifact_refs:{form_html:formArtifact.ref,order_json:orderArtifact.ref},
  artifact_sha256:{form_html:formArtifact.sha256,order_json:orderArtifact.sha256},
  attested_by:bundle.attested_by||null
 };
 deepFreeze(result);
 verifiedObjects.add(result);
 return result;
}
function assertLiveProviderEvidence(evidence){
 if(!evidence||!verifiedObjects.has(evidence)||evidence.provider_verified!==true||
    evidence.evidence_class!=='SITE_ENGINEER_ATTESTED_PROVIDER_CAPTURE')
  fail('LIVE_PROVIDER_EVIDENCE_REQUIRED');
 return evidence;
}
function buildNativeMultiOfferCapability(evidence){
 assertLiveProviderEvidence(evidence);
 if(evidence.order.status!=='UNPAID')fail('NATIVE_UNPAID_TWO_LINE_ORDER_REQUIRED');
 return Object.freeze({
  provider:'GetCourse',mode:'ONE_NATIVE_ORDER_MULTI_OFFER',
  selection_field:evidence.form.selection_field,selection_encoding:evidence.form.selection_encoding,
  provider_selection_binding_verified:true,native_unpaid_two_line_order_verified:true,independent_reviewed:false,
  form_offer_ids:evidence.form.selected_offer_ids,native_order_offer_ids:evidence.order.lines.map(x=>x.offer_id),
  native_public_form_url:evidence.form.public_url,native_form_action_url:evidence.form.action_url_stable,
  native_form_get_ref:evidence.artifact_refs.form_html,native_unpaid_order_readback_ref:evidence.artifact_refs.order_json,
  native_order_id:evidence.order.provider_order_id,
  evidence
 });
}
module.exports={EXPECTED,canonical,sha256,verifyProviderEvidenceBundle,assertLiveProviderEvidence,
 buildNativeMultiOfferCapability};
