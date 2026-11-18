'use strict';
// Reproducible QA fixture export — NO GetCourse order creation.
// Live R109 compute is imported as the only source of approved quote prices.
const {createAdapter,sha}=require('./adapter.cjs');
const path=require('node:path'),fs=require('node:fs');
const target=process.env.BF_R109_SERVER;
if(!target)throw Error('BF_R109_SERVER required');
const {compute,manifest:live}=require(path.resolve(target));
const snapshot=require('./pricing-r107.snapshot.json');
if(sha(live)!==sha(snapshot))throw Error('CATALOG_DRIFT_HOLD');
const observations=require('./native-mapping-observed.json');
const adapter=createAdapter({quoteFn:compute,manifest:snapshot,observedMapping:observations.entries});
const keys=snapshot.products.map(x=>x.key),cases=[];
let invalid=0;
for(let mask=0;mask<1<<keys.length;mask++){
 const items=keys.filter((_,i)=>mask&(1<<i));
 for(const v of items.includes('source')?['1','2']:[null]){
  const sel={kind:'set',items,...(v?{source_variant:v}:{})};
  try{
   const p=adapter.plan(sel);
   cases.push({selection_key:p.selection_key,selection:p.selection,
     currency:p.quote.currency,subtotal_rub:p.quote.subtotal_rub,
     discount_percent:p.quote.discount_percent,total_rub:p.quote.total_rub,
     rounding:p.quote.rounding,
     grants:p.lines.map(l=>({line_key:l.line_key,offer_ids:l.offer_ids,product_ids:l.product_ids,
       training_ids:l.training_ids,access_trigger:l.grant.trigger,access_days:l.grant.duration_days})),
     blockers:p.blockers});
  }catch(e){if(e.code!=='INVALID_SELECTION')throw e;invalid++}
 }
}
if(cases.length!==265||invalid!==503||cases.some(x=>x.blockers.length===0))
 throw Error('QA_ENUMERATION_GUARD_FAILED');
const document={schema:'bf2026.qa.265.vectors.r1',status:'SYNTHETIC_PRICING_ONLY_NO_NATIVE_PAYMENT_PASS',
 pricing_version:snapshot.id,catalog_sha256:adapter.catalogSha,
 case_count:cases.length,invalid_count:invalid,
 case_digest_sha256:sha(cases),
 cases};
process.stdout.write(JSON.stringify(document,null,2)+'\n');

