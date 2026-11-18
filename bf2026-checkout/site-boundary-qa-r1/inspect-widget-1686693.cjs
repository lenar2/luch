'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const BASE='https://study.shkola-dnv.com';
async function get(url){
 let last;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{accept:'text/html,application/javascript,*/*'}});
   const body=await r.text();
   return {status:r.status,contentType:r.headers.get('content-type')||'',body};
  }catch(e){last=e;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));}
 }
 throw last;
}
function sha(s){return crypto.createHash('sha256').update(s).digest('hex')}
function attrs(s){
 return Object.fromEntries([...s.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(m=>[m[1].toLowerCase(),m[3]]));
}
function cleanText(s){return s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()}
function variable(html,name){
 const re=new RegExp('window\\.'+name+'\\s*=\\s*(true|false)','i');
 const m=html.match(re);return m?m[1].toLowerCase()==='true':null;
}
async function inspect(){
 const embedUrl=BASE+'/pl/lite/widget/script?id=1686693';
 const embed=await get(embedUrl);
 if(embed.status!==200)throw new Error('WIDGET_EMBED_SCRIPT_HTTP_'+embed.status);
 const iframeBase=(embed.body.match(/iframe\.src\s*=\s*['"]([^'"]+\/pl\/lite\/widget\/widget)['"]/i)||[])[1];
 if(!iframeBase)throw new Error('WIDGET_IFRAME_BASE_NOT_FOUND');
 const iframeUrl=new URL(iframeBase);
 iframeUrl.searchParams.set('id','1686693');
 const iframe=await get(iframeUrl.toString());
 if(iframe.status!==200)throw new Error('WIDGET_IFRAME_HTTP_'+iframe.status);
 const html=iframe.body;
 const formTag=(html.match(/<form\b[^>]*>/i)||[])[0]||'';
 if(!formTag)throw new Error('PUBLIC_FORM_NOT_FOUND');
 const fa=attrs(formTag);
 const action=new URL(fa.action||'',BASE);
 const dynamicQueryNames=[...action.searchParams.keys()].filter(k=>k!=='id').sort();
 const stableAction=action.origin+action.pathname+(action.searchParams.has('id')?'?id='+encodeURIComponent(action.searchParams.get('id')):'');
 const inputTags=[...html.matchAll(/<input\b[^>]*>/gi)].map(m=>attrs(m[0]));
 const offerInput=inputTags.find(a=>a.name==='formParams[setted_offer_id]')||null;
 const valueInput=name=>inputTags.find(a=>a.name===name)||null;
 const submitTag=(html.match(/<button\b[^>]*type=["']submit["'][^>]*>[\s\S]*?<\/button>/i)||[])[0]||'';
 const submitCaption=cleanText(submitTag.replace(/<\/?button[^>]*>/gi,''));
 const superliteSrc=(html.match(/<script[^>]+src=["']([^"']*superlite-block[^"']*)["']/i)||[])[1]||null;
 let modalInjection={asset_found:false,explicit_offer_position_supported:false,external_value_object_fill:false};
 let superliteSha=null;
 if(superliteSrc){
  const asset=await get(new URL(superliteSrc,BASE).toString());
  if(asset.status===200){
   superliteSha=sha(asset.body);
   modalInjection={asset_found:true,
    explicit_offer_position_supported:asset.body.includes('position.offer_id'),
    external_value_object_fill:asset.body.includes('.external-value."+key).val(d)')};
  }
 }
 const result={
  schema:'bf2026.getcourse.widget.public-readonly-inspection.r2',
  observed_at:new Date().toISOString(),
  widget_id:1686693,
  embed_script:{url:embedUrl,http_status:embed.status,content_type:embed.contentType,bytes:Buffer.byteLength(embed.body),sha256:sha(embed.body),
   forwards_parent_query:embed.body.includes('window.location.search.substring(1)'),
   appends_widget_id:embed.body.includes('&id=1686693'),
   appends_referrer_and_location:embed.body.includes('document.referrer')&&embed.body.includes('document.location.href'),
   optional_clrt_query_data:embed.body.includes('window.clrtQueryData')},
  iframe:{url:iframeUrl.toString(),http_status:iframe.status,content_type:iframe.contentType,bytes:Buffer.byteLength(html),sha256:sha(html),
   block_data_id:(html.match(/data-block-id=["'](\d+)["']/i)||[])[1]||null,
   form:{method:(fa.method||'get').toLowerCase(),action_url:stableAction,action_query:{id:action.searchParams.get('id')||null,
     dynamic_session_parameter_names:dynamicQueryNames,dynamic_values_redacted:true},
     data_open_new_window:fa['data-open-new-window']||null,data_sequential_request:fa['data-sequential-request']||null},
   hidden_fields:{
    setted_offer_id:{name:'formParams[setted_offer_id]',present:!!offerInput,value_attribute_present:!!offerInput&&Object.hasOwn(offerInput,'value'),
      value:offerInput?.value??null,class:offerInput?.class||null},
    will_create_paid_deal:{name:'formParams[willCreatePaidDeal]',value:valueInput('formParams[willCreatePaidDeal]')?.value??null},
    in_widget:{name:'formParams[in_widget]',value:valueInput('formParams[in_widget]')?.value??null}
   },
   buyer_input_names:inputTags.map(a=>a.name).filter(n=>['formParams[email]','formParams[full_name]','formParams[phone]'].includes(n)),
   submit_button_caption:submitCaption,
   offer_terms:{enabled:variable(html,'globalCheckboxEnabled'),persodata_confirm:variable(html,'persodataConfirm')},
   marketing_consent:{enabled:variable(html,'checkboxMailingEnabled'),checked_by_default:variable(html,'checkboxMailingChecked'),
     required:variable(html,'isMailingCheckboxRequired')},
   offer_position_control_count:(html.match(/form-position-input/g)||[]).length,
   other_offer_selector_count:(html.match(/offer-select-input|prolong-offer/g)||[]).length,
   form_id_is_dynamic:/<form\b[^>]*\bid=["']ltForm\d+["']/i.test(html)},
  modal_injection:modalInjection,
  modal_js_sha256:superliteSha,
  interpretation:{native_handler_scope_from_latest_ui_readback:'LOT5_ONLY_OFFER_8933492',
   dynamic_query_to_offer_id_binding_observed:false,multi_offer_selection_observed:false,
   public_embed_is_standalone_checkout_url:false},
  safety:{form_submitted:false,customer_data_entered:false,order_created:false,payment_attempted:false,ui_or_lock_touched:false}
 };
 return result;
}
if(require.main===module){
 inspect().then(result=>{
  const out=path.resolve(__dirname,'widget-1686693-inspection.json');
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  process.stdout.write(JSON.stringify({out,result},null,2)+'\n');
 }).catch(e=>{process.stderr.write(String(e.stack||e)+'\n');process.exitCode=1});
}
module.exports={inspect};

