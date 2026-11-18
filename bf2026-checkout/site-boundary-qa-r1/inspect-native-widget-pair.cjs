'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const BASE='https://study.shkola-dnv.com';
const HOST='study.shkola-dnv.com';
const SPECS=[
 {widget_id:1686693,offer_id:8933492,product_id:4557988,training_id:936022301,base_price_rub:6990,selection_key:'rejection_program'},
 {widget_id:1686738,offer_id:8919715,product_id:4550895,training_id:933861292,base_price_rub:6000,selection_key:'union'}
];
async function get(url){
 let last;
 for(let attempt=0;attempt<4;attempt++){
  try{
   const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{accept:'text/html,application/javascript,*/*'}});
   return {status:r.status,content_type:r.headers.get('content-type')||'',body:await r.text()};
  }catch(e){last=e;if(attempt<3)await new Promise(resolve=>setTimeout(resolve,800*(attempt+1)));}
 }
 throw last;
}
function sha(s){return crypto.createHash('sha256').update(s).digest('hex')}
function attrs(tag){
 const out={};
 for(const m of tag.matchAll(/([A-Za-z_][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))
  out[m[1].toLowerCase()]=m[2]??m[3]??m[4]??'';
 return out;
}
function hasBooleanAttr(tag,name){return new RegExp('(?:^|\\s)'+name+'(?:\\s|=|>)','i').test(tag)}
function boolVar(html,name){
 const m=html.match(new RegExp('window\\.'+name+'\\s*=\\s*(true|false)','i'));
 return m?m[1].toLowerCase()==='true':null;
}
function textOf(s){return s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()}
async function inspectOne(spec){
 const embedUrl=BASE+'/pl/lite/widget/script?id='+spec.widget_id;
 const iframeUrl=BASE+'/pl/lite/widget/widget?&id='+spec.widget_id+'&ref=&loc='+encodeURIComponent('https://wf.tati-lar.ru/');
 const [embed,iframe]=await Promise.all([get(embedUrl),get(iframeUrl)]);
 if(embed.status!==200)throw Error('WIDGET_EMBED_HTTP_'+spec.widget_id+'_'+embed.status);
 if(iframe.status!==200)throw Error('WIDGET_IFRAME_HTTP_'+spec.widget_id+'_'+iframe.status);
 const html=iframe.body;
 const formTag=(html.match(/<form\b[^>]*>/i)||[])[0]||'';
 if(!formTag)throw Error('PUBLIC_FORM_MISSING_'+spec.widget_id);
 const f=attrs(formTag);
 const action=new URL(f.action||'');
 if(action.protocol!=='https:'||action.hostname!==HOST||action.pathname!=='/pl/lite/block-public/process')
  throw Error('UNEXPECTED_NATIVE_FORM_ACTION_'+spec.widget_id);
 const actionKeys=[...action.searchParams.keys()].filter(k=>k!=='id').sort();
 const stableAction=action.origin+action.pathname+'?id='+encodeURIComponent(action.searchParams.get('id')||'');
 const inputTags=[...html.matchAll(/<input\b[^>]*>/gi)].map(m=>({tag:m[0],attrs:attrs(m[0])}));
 const offerInputs=inputTags.filter(x=>x.attrs.name==='formParams[offer_id][]');
 const offers=offerInputs.map(x=>({
  name:x.attrs.name,type:x.attrs.type||null,value:x.attrs.value||null,
  checked:hasBooleanAttr(x.tag,'checked'),
  class:x.attrs.class||null,
  data_price_rub:Number(x.attrs['data-price-value']||0)||null
 }));
 const submit=(html.match(/<button\b[^>]*type=["']submit["'][^>]*>[\s\S]*?<\/button>/i)||[])[0]||'';
 const scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>m[1]);
 const result={
  widget_id:spec.widget_id,offer_id:spec.offer_id,product_id:spec.product_id,training_id:spec.training_id,
  selection_key:spec.selection_key,base_price_rub:spec.base_price_rub,
  embed:{url:embedUrl,http_status:embed.status,bytes:Buffer.byteLength(embed.body),sha256:sha(embed.body)},
  iframe:{url:iframeUrl,http_status:iframe.status,bytes:Buffer.byteLength(html),sha256:sha(html),
   form:{method:(f.method||'get').toLowerCase(),action_url_stable:stableAction,action_id:action.searchParams.get('id')||null,
    dynamic_session_parameter_names:actionKeys,dynamic_values_redacted:true,
    data_open_new_window:f['data-open-new-window']||null,data_sequential_request:f['data-sequential-request']||null},
   offer_input_name:'formParams[offer_id][]',offer_input_count:offers.length,offer_inputs:offers,
   formparams_will_create_paid_deal:inputTags.find(x=>x.attrs.name==='formParams[willCreatePaidDeal]')?.attrs.value||null,
   formparams_in_widget:inputTags.find(x=>x.attrs.name==='formParams[in_widget]')?.attrs.value||null,
   submit_button_caption:textOf(submit.replace(/<\/?button[^>]*>/gi,'')),
   consent:{offer_terms_enabled:boolVar(html,'globalCheckboxEnabled'),offer_terms_required:boolVar(html,'persodataConfirm'),
    marketing_enabled:boolVar(html,'checkboxMailingEnabled'),marketing_checked_by_default:boolVar(html,'checkboxMailingChecked'),
    marketing_optional_from_ui_readback:true,marketing_optional_source:'ai-factory-evidence#4073/comment/6993420543'},
   form_id_dynamic:/<form\b[^>]*\bid=["']ltForm\d+["']/i.test(html),
   script_sources:scripts.filter(x=>/superlite|widget|custom-form/i.test(x)).slice(0,10)},
  native_mapping_source:'ai-factory-evidence#4073/comment/6993420543'
 };
 return result;
}
async function inspect(){
 const widgets=[];
 for(const spec of SPECS)widgets.push(await inspectOne(spec));
 const ids=widgets.flatMap(w=>w.iframe.offer_inputs.map(x=>Number(x.value)));
 const formActions=widgets.map(w=>w.iframe.form.action_url_stable);
 const allExpected=SPECS.map(s=>s.offer_id).sort((a,b)=>a-b);
 const observed=ids.slice().sort((a,b)=>a-b);
 return {
  schema:'bf2026.getcourse.native-widget-pair.readonly.r1',
  observed_at:new Date().toISOString(),
  widgets,
  pair_assessment:{
   observed_native_form_count:widgets.length,
   observed_offer_radio_count:ids.length,
   each_widget_has_exactly_one_offer_radio:widgets.every(w=>w.iframe.offer_input_count===1&&w.iframe.offer_inputs[0].type==='radio'&&w.iframe.offer_inputs[0].checked),
   exact_expected_offer_ids:JSON.stringify(observed)===JSON.stringify(allExpected),
   distinct_native_form_action_ids:new Set(widgets.map(w=>w.iframe.form.action_id)).size===2,
   distinct_native_form_action_urls:new Set(formActions).size===2,
   same_native_form:false,
   one_native_form_with_both_offers_observed:false,
   multi_offer_selection_transfer_verified:false,
   native_two_line_order_verified:false,
   classification:'TWO_DISTINCT_NATIVE_SINGLE_OFFER_FORMS_NOT_ONE_MULTI_OFFER_FORM'
  },
  safety:{public_get_only:true,form_submitted:false,buyer_data_entered:false,order_created:false,payment_attempted:false,getcourse_ui_or_lock_touched:false,session_values_persisted:false}
 };
}
if(require.main===module){
 inspect().then(result=>{
  const out=path.resolve(__dirname,'native-widget-pair-readonly-evidence.json');
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  process.stdout.write(JSON.stringify({out,observed_at:result.observed_at,pair_assessment:result.pair_assessment,
   widgets:result.widgets.map(w=>({widget_id:w.widget_id,offer_id:w.offer_id,embed_http:w.embed.http_status,iframe_http:w.iframe.http_status,
    action:w.iframe.form.action_url_stable,radio:w.iframe.offer_inputs,marketing:w.iframe.consent.marketing_checked_by_default}))},null,2)+'\n');
 }).catch(e=>{process.stderr.write(String(e.stack||e)+'\n');process.exitCode=1});
}
module.exports={inspect};
