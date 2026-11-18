'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const BASE='https://study.shkola-dnv.com';
async function get(url){
 const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{accept:'text/html,application/javascript,*/*'}});
 const body=await r.text();
 return {status:r.status,contentType:r.headers.get('content-type')||'',body};
}
function sha(s){return crypto.createHash('sha256').update(s).digest('hex')}
async function inspect(){
 const scriptUrl=BASE+'/pl/lite/widget/script?id=1686693';
 const script=await get(scriptUrl);
 if(script.status!==200)throw new Error('WIDGET_EMBED_SCRIPT_HTTP_'+script.status);
 const baseMatch=script.body.match(/iframe\.src\s*=\s*['"]([^'"]+\/pl\/lite\/widget\/widget)['"]/);
 if(!baseMatch)throw new Error('WIDGET_IFRAME_BASE_NOT_FOUND');
 const iframeUrl=new URL(baseMatch[1]);
 iframeUrl.searchParams.set('id','1686693');
 const iframe=await get(iframeUrl.toString());
 if(iframe.status!==200)throw new Error('WIDGET_IFRAME_HTTP_'+iframe.status);
 const html=iframe.body;
 const formId=(html.match(/<form\b[^>]*\bid=["']([^"']+)["']/i)||[])[1]||null;
 const dataId=(html.match(/\bdata-id\s*=\s*["']?(\d+)/i)||[])[1]||null;
 const hiddenOffer=(html.match(/<input\b[^>]*name=["']formParams\[setted_offer_id\]["'][^>]*>/i)||[])[0]||'';
 const positionCount=(html.match(/form-position-input/g)||[]).length;
 const selectableOfferCount=(html.match(/(?:offer-select-input|prolong-offer)/g)||[]).length;
 const superliteSrc=(html.match(/<script[^>]+src=["']([^"']*superlite-block[^"']*)["']/i)||[])[1]||null;
 let modalInjection={asset_found:false,explicit_offer_position_supported:false,external_value_object_fill:false};
 let superliteSha=null;
 if(superliteSrc){
  const u=new URL(superliteSrc,BASE);
  const asset=await get(u.toString());
  if(asset.status===200){
   superliteSha=sha(asset.body);
   modalInjection={
    asset_found:true,
    explicit_offer_position_supported:asset.body.includes('position.offer_id'),
    external_value_object_fill:asset.body.includes('.external-value."+key).val(d)')
   };
  }
 }
 const result={
  schema:'bf2026.getcourse.widget.public-readonly-inspection.r1',
  observed_at:new Date().toISOString(),
  widget_id:1686693,
  embed_script:{url:scriptUrl,http_status:script.status,content_type:script.contentType,bytes:Buffer.byteLength(script.body),sha256:sha(script.body),
   forwards_parent_query:script.body.includes('window.location.search.substring(1)')},
  iframe:{url:iframeUrl.toString(),http_status:iframe.status,content_type:iframe.contentType,bytes:Buffer.byteLength(html),form_id:formId,block_data_id:dataId,
   hidden_setted_offer_id_count:(html.match(/formParams\[setted_offer_id\]/g)||[]).length,
   hidden_setted_offer_id_has_value_attribute:/<input\b[^>]*name=["']formParams\[setted_offer_id\]["'][^>]*\bvalue\s*=/i.test(hiddenOffer),
   form_position_input_count:positionCount,other_offer_selector_count:selectableOfferCount,
   global_offer_terms_checkbox_enabled:/window\.globalCheckboxEnabled\s*=\s*true/.test(html),
   mailing_checkbox_enabled:/window\.checkboxMailingEnabled\s*=\s*true/.test(html),
   mailing_checkbox_checked_by_default:/window\.checkboxMailingChecked\s*=\s*true/.test(html),
   mailing_checkbox_required:/window\.isMailingCheckboxRequired\s*=\s*true/.test(html),
   action_path:(html.match(/\baction=["']https:\/\/study\.shkola-dnv\.com([^"'?]+)/i)||[])[1]||null},
  modal_injection:modalInjection,
  modal_js_sha256:superliteSha,
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

