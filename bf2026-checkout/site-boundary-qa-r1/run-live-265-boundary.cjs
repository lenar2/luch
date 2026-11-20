'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createBoundary}=require('./site-boundary.cjs');
const {canonical}=require('../dynamic-adapter-r1/adapter.cjs');
const vectors=require('./live-265-inputs.json');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const startIndex=Number(process.argv[2]||0),endIndex=Number(process.argv[3]||265);
 if(!Number.isInteger(startIndex)||!Number.isInteger(endIndex)||startIndex<0||endIndex>265||startIndex>=endIndex)
  throw new Error('BAD_RANGE');
 const b=createBoundary();
 if(vectors.case_count!==265||vectors.cases.length!==265)throw new Error('VECTOR_COUNT_MISMATCH');
 if(vectors.catalog_canonical_sha256!==b.adapter.catalogSha)throw new Error('VECTOR_CANONICAL_CATALOG_SHA_MISMATCH');
 const before=await b.status();
 if(before.body.verified_sale_routes!==0||before.body.sales_ready!==false)throw new Error('PRODUCTION_ROUTE_STATE_CHANGED');
 const progressPath=path.resolve(__dirname,'live-265-progress-'+startIndex+'-'+endIndex+'.json');
 let next=startIndex,observed=[];
 if(fs.existsSync(progressPath)){
  const p=JSON.parse(fs.readFileSync(progressPath,'utf8'));
  if(p.start_index!==startIndex||p.end_index!==endIndex)throw new Error('PROGRESS_RANGE_MISMATCH');
  next=p.next_index;observed=p.observations;
  if(next<startIndex||next>endIndex||observed.length!==next-startIndex)throw new Error('PROGRESS_CHECKPOINT_CORRUPT');
 }
 for(let i=next;i<endIndex;i++){
  const c=vectors.cases[i];
  const q=await b.quote(c.selection);
  if(q.site_quote.total_rub!==c.total_rub||
     q.site_quote.subtotal_rub!==c.subtotal_rub||
     q.site_quote.discount_percent!==c.discount_percent||
     q.adapter.selection_key!==c.selection_key||
     q.site_availability.ready!==false)
    throw new Error('LIVE_265_PARITY_FAILURE index='+i+' key='+c.selection_key);
  observed.push({
   vector_index:i,selection_key:c.selection_key,
   subtotal_rub:q.site_quote.subtotal_rub,discount_percent:q.site_quote.discount_percent,
   total_rub:q.site_quote.total_rub,
   adapter_ready_for_native_binding:q.adapter.ready_for_native_binding,
   blocker_count:q.adapter.blockers.length,
   site_availability_ready:q.site_availability.ready,quote_http_status:q.http_status
  });
  next=i+1;
  const progress={start_index:startIndex,end_index:endIndex,next_index:next,observations:observed};
  fs.writeFileSync(progressPath,JSON.stringify(progress)+'\n',{mode:0o600});
  if(next%10===0||next===endIndex)process.stdout.write('LIVE_R109_QUOTES '+next+'/265 PASS\n');
  // One request per second stays below R109's 90/minute IP limit.
  if(next<endIndex)await delay(1000);
 }
 const after=await b.status();
 if(after.body.verified_sale_routes!==0||after.body.sales_ready!==false)
   throw new Error('PRODUCTION_ROUTE_STATE_CHANGED_DURING_READONLY_QA');
 const digest=require('node:crypto').createHash('sha256').update(canonical(observed)).digest('hex');
 const evidence={
  schema:'bf2026.live-r109-265-quote-boundary-part.r1',
  observed_at:new Date().toISOString(),
  range:{start_inclusive:startIndex,end_exclusive:endIndex},
  site:b.siteOrigin,endpoint:b.siteOrigin+'/api/checkout/quote',
  pricing_version:b.manifest.id,pricing_file_sha256:b.pricing_file_sha256,
  catalog_canonical_sha256:vectors.catalog_sha256,source_vector_digest:vectors.source_vector_digest,
  input_count:observed.length,http_quote_200_count:observed.filter(x=>x.quote_http_status===200).length,
  adapter_site_price_parity_count:observed.length,
  adapter_ready_for_native_binding_count:observed.filter(x=>x.adapter_ready_for_native_binding).length,
  adapter_blocked_count:observed.filter(x=>!x.adapter_ready_for_native_binding).length,
  all_site_availability_false:observed.every(x=>x.site_availability_ready===false),
  status_before:{sales_ready:before.body.sales_ready,verified_sale_routes:before.body.verified_sale_routes},
  status_after:{sales_ready:after.body.sales_ready,verified_sale_routes:after.body.verified_sale_routes},
  observed_selection_digest_sha256:digest,observations:observed
 };
 const out=path.resolve(__dirname,'live-265-part-'+startIndex+'-'+endIndex+'.json');
 fs.writeFileSync(out,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
 process.stdout.write(JSON.stringify({out,range:evidence.range,input_count:observed.length,quote_200:evidence.http_quote_200_count,parity:evidence.adapter_site_price_parity_count,adapter_ready:evidence.adapter_ready_for_native_binding_count,adapter_blocked:evidence.adapter_blocked_count,digest},null,2)+'\n');
})().catch(e=>{process.stderr.write(String(e.stack||e)+'\n');process.exitCode=1});

