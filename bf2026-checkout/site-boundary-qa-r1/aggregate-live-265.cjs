'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {canonical}=require('../dynamic-adapter-r1/adapter.cjs');
const dir=__dirname;
const files=fs.readdirSync(dir).filter(x=>/^live-265-part-\d+-\d+\.json$/.test(x));
const parts=files.map(x=>JSON.parse(fs.readFileSync(path.join(dir,x),'utf8'))).sort((a,b)=>a.range.start_inclusive-b.range.start_inclusive);
const observations=parts.flatMap(p=>p.observations).sort((a,b)=>a.vector_index-b.vector_index);
if(observations.length!==265||observations.some((x,i)=>x.vector_index!==i))throw new Error('LIVE_265_RANGE_GAP_OR_DUPLICATE');
if(observations.some(x=>x.quote_http_status!==200||x.site_availability_ready!==false))throw new Error('LIVE_265_NON_PASS');
const digest=crypto.createHash('sha256').update(canonical(observations)).digest('hex');
const totals={};for(const x of observations)totals[String(x.total_rub)]=(totals[String(x.total_rub)]||0)+1;
const out={
 schema:'bf2026.live-r109-265-quote-boundary-evidence.r1',observed_at:new Date().toISOString(),
 site:'https://wf.tati-lar.ru',endpoint:'https://wf.tati-lar.ru/api/checkout/quote',
 pricing_version:parts[0].pricing_version,pricing_file_sha256:parts[0].pricing_file_sha256,
 catalog_canonical_sha256:parts[0].catalog_canonical_sha256,source_vector_digest:parts[0].source_vector_digest,
 input_count:265,http_quote_200_count:observations.filter(x=>x.quote_http_status===200).length,
 adapter_site_price_parity_count:observations.length,
 adapter_ready_for_native_binding_count:observations.filter(x=>x.adapter_ready_for_native_binding).length,
 adapter_blocked_count:observations.filter(x=>!x.adapter_ready_for_native_binding).length,
 all_site_availability_false:observations.every(x=>x.site_availability_ready===false),
 totals_distribution:totals,observed_selection_digest_sha256:digest,
 status_before:parts[0].status_before,status_after:parts[parts.length-1].status_after,
 safety:{native_getcourse_order_created:false,payment_attempted:false,customer_data_submitted:false,
  getcourse_ui_or_lock_touched:false,production_registry_changed:false,site_design_changed:false},
 observations
};
fs.writeFileSync(path.join(dir,'live-265-boundary-evidence.json'),JSON.stringify(out,null,2)+'\n',{mode:0o600});
process.stdout.write(JSON.stringify({input_count:out.input_count,quote_200:out.http_quote_200_count,parity:out.adapter_site_price_parity_count,
 adapter_ready:out.adapter_ready_for_native_binding_count,adapter_blocked:out.adapter_blocked_count,
 all_site_availability_false:out.all_site_availability_false,totals_distribution:totals,digest},null,2)+'\n');

