'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createAdapter,canonical}=require('../adapter.cjs');
const SITE_ORIGIN='https://wf.tati-lar.ru';
function requiredPath(env,fallback){
 const p=process.env[env]||fallback;
 if(!p||!fs.existsSync(p))throw new Error('MISSING_'+env);
 return path.resolve(p);
}
function createBoundary(){
 const serverPath=requiredPath('BF_R109_SERVER','/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js');
 const pricingPath=requiredPath('BF_R109_PRICING','/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json');
 const mappingPath=requiredPath('BF_NATIVE_MAPPING',path.resolve(__dirname,'../native-mapping-observed.json'));
 const overlayPath=path.resolve(__dirname,'native-mapping-live-overlay.json');
 const {compute}=require(serverPath);
 const pricingBytes=fs.readFileSync(pricingPath);
 const manifest=JSON.parse(pricingBytes.toString('utf8'));
 const baseMapping=JSON.parse(fs.readFileSync(mappingPath,'utf8'));
 const overlay=JSON.parse(fs.readFileSync(overlayPath,'utf8'));
 if(manifest.id!=='BF2026_LOT10_CUSTOM_SET_R107'||manifest.default_access_days!==365)
   throw new Error('R109_MANIFEST_GUARD');
 const entries={...baseMapping.entries,...overlay.entries};
 const adapter=createAdapter({quoteFn:compute,manifest,observedMapping:entries});
 async function request(route,body){
   const options=body===undefined?{method:'GET',headers:{accept:'application/json'}}:{
     method:'POST',
     headers:{accept:'application/json','content-type':'application/json',origin:SITE_ORIGIN},
     body:JSON.stringify(body)
   };
   const response=await fetch(SITE_ORIGIN+route,{...options,redirect:'manual',signal:AbortSignal.timeout(12000)});
   const raw=await response.text();
   let json;try{json=JSON.parse(raw)}catch{throw new Error('NON_JSON_SITE_RESPONSE_'+response.status+':'+raw.slice(0,180))}
   return {http_status:response.status,body:json};
 }
 async function status(){
   const r=await request('/api/checkout/status');
   if(r.http_status!==200||r.body.ok!==true)throw new Error('SITE_STATUS_UNAVAILABLE');
   return r;
 }
 function comparableSite(q){
   return {kind:q.kind,items:q.items,currency:q.currency,count:q.count,
     subtotal_rub:q.subtotal_rub,discount_percent:q.discount_percent,
     total_rub:q.total_rub,savings_rub:q.savings_rub,pricing_version:q.pricing_version};
 }
 function comparableAdapter(plan,kind){
   return {kind,items:plan.lines.map(l=>({
     key:l.line_key.split(':')[0],site_lot:l.site_lot,variant:l.variant??null,
     base_price_rub:l.base_price_rub
   })),currency:plan.quote.currency,count:plan.quote.count,
     subtotal_rub:plan.quote.subtotal_rub,discount_percent:plan.quote.discount_percent,
     total_rub:plan.quote.total_rub,savings_rub:plan.quote.savings_rub,
     pricing_version:plan.quote.pricing_version};
 }
 async function quote(input){
   const r=await request('/api/checkout/quote',input);
   if(r.http_status!==200||r.body.ok!==true||!r.body.quote)throw new Error('LIVE_R109_QUOTE_REJECTED_'+r.http_status);
   const plan=adapter.plan(input);
   if(canonical(comparableSite(r.body.quote))!==canonical(comparableAdapter(plan,input.kind)))
     throw new Error('SITE_ADAPTER_QUOTE_DIVERGENCE');
   return {
     boundary_status:'PASS_LIVE_SITE_QUOTE_EQUALS_ADAPTER',
     endpoint:SITE_ORIGIN+'/api/checkout/quote',
     http_status:r.http_status,
     input,
     site_quote:r.body.quote,
     site_availability:r.body.availability,
     adapter:{
       selection_key:plan.selection_key,
       ready_for_native_binding:plan.ready_for_native_binding,
       blockers:plan.blockers,
       line_binding_sha256:plan.provenance.line_binding_sha256
     },
     provider_order_status:'NOT_CREATED_BY_BOUNDARY_TEST',
     checkout_url:null
   };
 }
 async function start(input){
   const r=await request('/api/checkout/start',input);
   return {
     endpoint:SITE_ORIGIN+'/api/checkout/start',
     http_status:r.http_status,
     code:r.body.code||null,
     returned_checkout_url:r.body.checkout_url||null,
     quote:r.body.quote||null,
     provider_order_status:'NOT_CREATED_BY_BOUNDARY_TEST'
   };
 }
 async function rejectedQuote(input){
   const r=await request('/api/checkout/quote',input);
   return {http_status:r.http_status,code:r.body.code||null,ok:r.body.ok===true};
 }
 return {status,quote,start,rejectedQuote,adapter,manifest,overlay,siteOrigin:SITE_ORIGIN,
   pricing_file_sha256:require('node:crypto').createHash('sha256').update(pricingBytes).digest('hex')};
}
module.exports={createBoundary,SITE_ORIGIN};

