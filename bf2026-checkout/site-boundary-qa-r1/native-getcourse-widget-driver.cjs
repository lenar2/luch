'use strict';
const crypto=require('node:crypto');
const HOST='study.shkola-dnv.com',WIDGET=1686745;
const EXPECTED=[{offer_id:8919715,price_rub:6000},{offer_id:8933492,price_rub:6990}];
function fail(code){const e=new Error(code);e.code=code;throw e}
function attr(tag,key){
 const esc=key.replace(/[^a-zA-Z0-9_]/g,c=>'\\'+c);
 const m=tag.match(new RegExp('(?:^|\\s)'+esc+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27|([^\\s>]+))','i'));
 return m?.[1]??m?.[2]??m?.[3]??null;
}
function inspectNativeWidget(html){
 if(typeof html!=='string'||html.length<100||html.length>512000)fail('NATIVE_WIDGET_HTML_INVALID');
 const forms=[...html.matchAll(/<form\b[\s\S]*?<\/form\s*>/gi)].map(m=>m[0]);
 if(forms.length!==1)fail('NATIVE_WIDGET_EXACTLY_ONE_FORM_REQUIRED');
 const form=forms[0],opening=(form.match(/<form\b[^>]*>/i)||[])[0]||'';
 if(String(attr(opening,'method')||'').toLowerCase()!=='post')fail('NATIVE_WIDGET_NOT_POST');
 let url;try{url=new URL(String(attr(opening,'action')||'').replace(/&amp;/g,'&'))}
 catch{fail('NATIVE_WIDGET_ACTION_URL_INVALID')}
 if(url.protocol!=='https:'||url.hostname!==HOST||url.port||
 url.pathname!=='/pl/lite/block-public/process'||!/^\d+$/.test(url.searchParams.get('id')||''))
  fail('NATIVE_WIDGET_ACTION_URL_INVALID');
 const inputs=[...form.matchAll(/<input\b[^>]*>/gi)].map(m=>m[0]);
 const offers=inputs.filter(x=>attr(x,'name')==='formParams[offer_id][]').map(x=>({
  offer_id:Number(attr(x,'value')),price_rub:Number(attr(x,'data-price-value')),
  type:attr(x,'type'),checked_by_default:/(?:^|\s)checked(?:\s|=|>|\/>)/i.test(x)
 }));
 if(offers.length!==2||JSON.stringify(offers.map(o=>o.offer_id).sort((a,b)=>a-b))!==JSON.stringify(EXPECTED.map(o=>o.offer_id).sort((a,b)=>a-b)))
  fail('NATIVE_WIDGET_OFFER_COMPOSITION_CHANGED');
 for(const o of offers){
  const e=EXPECTED.find(x=>x.offer_id===o.offer_id);
  if(!e||e.price_rub!==o.price_rub||o.type!=='checkbox'||o.checked_by_default)
   fail('NATIVE_WIDGET_PRICE_OR_SELECTION_MISMATCH');
 }
 const handlerField=inputs.find(x=>attr(x,'name')==='formParams[willCreatePaidDeal]');
 if(!handlerField||!['0','1'].includes(attr(handlerField,'value')))
  fail('NATIVE_WIDGET_ORDER_HANDLER_FIELD_MISSING');
 const nativeHandlerValue=Number(attr(handlerField,'value'));
 return Object.freeze({
  schema:'bf2026.getcourse.native-form-readback.v1',provider:'GetCourse',
  provider_order_method:'NATIVE_CUSTOMER_WIDGET_POST',
  source_widget_id:WIDGET,form_action_id:url.searchParams.get('id'),
  stable_action_url:'https://'+HOST+url.pathname+'?id='+url.searchParams.get('id'),
  qa_preview_url:'https://'+HOST+'/pl/lite/widget/widget?id='+WIDGET,
  offer_positions:offers,
  native_base_total_rub:offers.reduce((s,o)=>s+o.price_rub,0),
  server_approved_due_rub:11690,
  will_create_paid_deal_field_value:nativeHandlerValue,
  native_handler_action_verified:false,
  native_unpaid_order_readback_verified:false,
  legal_consent_negative_test_verified:false,
  native_checkout_ready:false,payment_url:null,
  status:'NATIVE_PRICE_HANDLER_AND_ORDER_GATE_HOLD',
  note:'Actual public GetCourse form exists; it must be completed by the buyer. Raw HTML cannot prove a 11690 native order or consent enforcement.'
 });
}
async function readNativePublicWidget({fetchImpl=fetch,timeoutMs=9000}={}){
 const src='https://'+HOST+'/pl/lite/widget/widget?id='+WIDGET;
 let result;
 try{result=await fetchImpl(src,{method:'GET',redirect:'follow',headers:{accept:'text/html'},
   signal:AbortSignal.timeout(timeoutMs)})}
 catch{fail('LIVE_GETCOURSE_WIDGET_UNAVAILABLE')}
 if(result.status!==200)fail('LIVE_GETCOURSE_WIDGET_HTTP_ERROR');
 let final;try{final=new URL(result.url)}catch{fail('LIVE_GETCOURSE_WIDGET_REDIRECT_INVALID')}
 if(final.protocol!=='https:'||final.hostname!==HOST||final.pathname!=='/pl/lite/widget/widget'||
    final.searchParams.get('id')!==String(WIDGET))fail('LIVE_GETCOURSE_WIDGET_REDIRECT_INVALID');
 let html;try{html=await result.text()}catch{fail('LIVE_GETCOURSE_WIDGET_HTML_READ_FAILED')}
 const parsed=inspectNativeWidget(html);
 return {...parsed,public_http_status:200,
  html_sha256:crypto.createHash('sha256').update(html).digest('hex'),
  safe_transport:{method:'GET',buyer_data_sent:false,form_submitted:false,session_tokens_returned:false}};
}
module.exports={WIDGET,EXPECTED,inspectNativeWidget,readNativePublicWidget};
