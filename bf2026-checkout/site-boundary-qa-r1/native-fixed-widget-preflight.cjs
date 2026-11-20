'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const EXPECTED=[
 {widget_id:1686693,title:'Исцеление отвержения',offer_id:8933492,price_rub:6990},
 {widget_id:1686738,title:'Союз нового времени',offer_id:8919715,price_rub:6000},
 {widget_id:1686740,title:'Школа девушек на выданье',offer_id:8934207,price_rub:7200},
 {widget_id:1686741,title:'Источник I',offer_id:8934262,price_rub:6000},
 {widget_id:1686753,title:'Аудиотерапия «Исцеление раны обесценивания»',offer_id:8934925,price_rub:3333}
];
function attr(tag,key){
 const re=new RegExp('(?:^|\\s)'+key+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27|([^\\s>]+))','i');
 const m=String(tag).match(re);return m?.[1]??m?.[2]??m?.[3]??null;
}
function has(tag,key){return new RegExp('(?:^|\\s)'+key+'(?:\\s|=|>)','i').test(tag)}
function globalVar(html,key){const m=html.match(new RegExp('window\\.'+key+'\\s*=\\s*(true|false)','i'));return m?m[1]==='true':null}
function inspect(html,spec){
 const forms=[...String(html).matchAll(/<form\b[\s\S]*?<\/form\s*>/gi)].map(m=>m[0]);
 const parts=forms.map((form,index)=>{
  const inputs=[...form.matchAll(/<input\b[^>]*>/gi)].map(m=>m[0]);
  const offers=inputs.filter(tag=>attr(tag,'name')==='formParams[offer_id][]').map(tag=>({
   offer_id:Number(attr(tag,'value')),price_rub:Number(attr(tag,'data-price-value')),
   type:attr(tag,'type'),checked:has(tag,'checked')
  }));
  const action=attr((form.match(/<form\b[^>]*>/i)||[])[0]||'','action');
  const u=action?new URL(action,'https://study.shkola-dnv.com'):null;
  return {index,offers,has_explicit_offer_terms:/(?:условиями оферты|оферт|oferta)/i.test(form),action_id:u?.searchParams.get('id')||null};
 });
 const issues=[];
 if(parts.length!==1)issues.push('FORM_COUNT_NOT_ONE');
 if(parts.some(p=>p.offers.length!==1))issues.push('MULTI_OFFER_FIXED_FORM');
 if(parts.length===1){
  const p=parts[0],o=p.offers[0];
  if(!o||o.offer_id!==spec.offer_id)issues.push('OFFER_MAPPING_MISMATCH');
  if(!o||o.price_rub!==spec.price_rub)issues.push('PUBLIC_PRICE_MISMATCH');
  if(!o||o.type!=='radio'||!o.checked)issues.push('DEFAULT_OFFER_SELECTION_MISMATCH');
  if(!p.has_explicit_offer_terms)issues.push('EXPLICIT_OFFER_TERMS_MISSING');
 }
 const marketing={enabled:globalVar(html,'checkboxMailingEnabled'),
  checked:globalVar(html,'checkboxMailingChecked'),required:globalVar(html,'isMailingCheckboxRequired')};
 if(marketing.checked!==false||marketing.required!==false)issues.push('MARKETING_CONSENT_DEFAULT_OR_REQUIRED');
 return {widget_id:spec.widget_id,title:spec.title,expected_offer_id:spec.offer_id,
  expected_price_rub:spec.price_rub,form_count:parts.length,forms:parts,marketing,
  public_structure_pass:issues.length===0,issues,public_sale_ready:false,
  public_sale_blocker:'REAL_UNPAID_PAID_RECEIPT_AND_ACCESS_E2E_NOT_VERIFIED'};
}
async function inspectLive(){
 const reports=[];
 for(const spec of EXPECTED){
  const url='https://study.shkola-dnv.com/pl/lite/widget/widget?id='+spec.widget_id;
  const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{accept:'text/html'}});
  const html=await response.text(),report=inspect(html,spec);
  reports.push({...report,url,http_status:response.status,
   response_sha256:crypto.createHash('sha256').update(html).digest('hex'),
   ...(response.status!==200?{issues:[...report.issues,'NATIVE_IFRAME_UNAVAILABLE'],public_structure_pass:false}:{})});
 }
 return {schema:'bf2026.native.fixed-widget.public-preflight.r1',observed_at:new Date().toISOString(),
  scoped_check:'ONLY_5_KNOWN_FIXED_WIDGETS_NOT_265_COMBINATIONS',reports,
  structure_pass_count:reports.filter(x=>x.public_structure_pass).length,
  structure_fail_count:reports.filter(x=>!x.public_structure_pass).length,
  verified_sale_routes:0,customer_sale_ready:false,
  safety:{public_get_only:true,forms_submitted:false,orders_created:false,payments_attempted:false,
   getcourse_ui_or_lock_touched:false,production_changed:false,buyer_data_stored:false}};
}
if(require.main===module){
 inspectLive().then(x=>{
  const file=path.join(__dirname,'native-fixed-widget-preflight-evidence.json');
  fs.writeFileSync(file,JSON.stringify(x,null,2)+'\n',{mode:0o600});
  process.stdout.write(JSON.stringify({file,observed_at:x.observed_at,pass:x.structure_pass_count,fail:x.structure_fail_count,
   widgets:x.reports.map(r=>({widget:r.widget_id,forms:r.form_count,offer_ids:r.forms.flatMap(f=>f.offers.map(o=>o.offer_id)),issues:r.issues}))},null,2)+'\n');
 }).catch(e=>{process.stderr.write(String(e.stack||e)+'\n');process.exitCode=1});
}
module.exports={EXPECTED,inspect,inspectLive};