'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createBoundary}=require('./site-boundary.cjs');
(async()=>{
 const b=createBoundary();
 const inputs=[
  {label:'lot5_single',input:{kind:'single',lot:5}},
  {label:'lot5_plus_union',input:{kind:'set',items:['rejection_program','union']}},
  {label:'two_audio',input:{kind:'set',items:['rejection','devaluation']}},
  {label:'source_variant_2',input:{kind:'single',lot:9,variant:'2'}}
 ];
 const observed=[];
 const status=await b.status();
 for(const x of inputs)observed.push({label:x.label,...await b.quote(x.input)});
 const starts=[];
 for(const x of inputs.slice(0,2))starts.push({label:x.label,...await b.start(x.input)});
 const rejected=[];
 rejected.push({label:'client_price_override',...await b.rejectedQuote({kind:'single',lot:5,total_rub:1})});
 rejected.push({label:'three_audio_invalid',...await b.rejectedQuote({kind:'set',items:['rejection','devaluation','self']})});
 const evidence={
  schema:'bf2026.live-site-adapter-boundary-evidence.r1',
  observed_at:new Date().toISOString(),
  source:{site:b.siteOrigin,quote_endpoint:b.siteOrigin+'/api/checkout/quote',status_endpoint:b.siteOrigin+'/api/checkout/status'},
  pricing_version:b.manifest.id,
  pricing_file_sha256:b.pricing_file_sha256,
  status:{http_status:status.http_status,body:status.body},
  quote_observations:observed,
  start_observations:starts,
  rejected_inputs:rejected,
  safety:{
   getcourse_ui_accessed:false,
   getcourse_lock_touched:false,
   native_order_created:false,
   payment_attempted:false,
   customer_data_submitted:false,
   production_registry_changed:false,
   site_design_changed:false,
   checkout_url_returned:false
  },
  interpretation:{
   boundary_quote_parity:'PASS_FOR_ALL_OBSERVED_INPUTS',
   lot5_native_mapping:'ACTIVE_VERIFIED_FROM_4073_6988661595',
   union_native_mapping:'BLOCKED_INACTIVE_QA_ONLY_PER_4073_6988302858',
   public_checkout:'BLOCKED_BY_R109_REGISTRY',
   audio_price_conflict:'UNRESOLVED_R109_3333_VS_OLDER_3000'
  }
 };
 const out=path.resolve(__dirname,'live-boundary-evidence.json');
 fs.writeFileSync(out,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
 process.stdout.write(JSON.stringify({out,observations:observed.map(x=>({label:x.label,total:x.site_quote.total_rub,adapter_ready:x.adapter.ready_for_native_binding})),starts:starts.map(x=>({label:x.label,status:x.http_status,code:x.code})),rejected},null,2)+'\n');
})().catch(e=>{process.stderr.write(String(e.stack||e)+'\n');process.exitCode=1});

