'use strict';
/* R126 real stage HTTP+PostgreSQL negative proof, no artificial native PASS.
 * Never sends a GetCourse API request; all flags and credentials absent.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {EXPECTED}=require('./r123-single-widget-adapter.cjs');
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&
 process.env.BF2026_R126_STAGE_PORT==='18772'&&
 Boolean(process.env.BF2026_STAGE_PG_POOL_MODULE);
const base='http://127.0.0.1:18772';
test('R126 real site server/PG native readback HOLD and exact ten CTA gates', {skip:!enabled},async t=>{
 const pool=require(process.env.BF2026_STAGE_PG_POOL_MODULE).pool;
 assert.equal(pool.options.host,'127.0.0.1');
 assert.equal(Number(pool.options.port),55439);
 assert.equal(pool.options.database,'bfstage');
 const qaKey=fs.readFileSync('/srv/factory-scratch/bf2026-r118-relay-stage-20261119/private-widget-qa.secret','utf8').trim();
 const prefix='/api/checkout/_qa/provider-verification/';
 async function call(part,{auth=true,method='GET',headers={},body}={}){
  const r=await fetch(base+part,{method,
   headers:{...auth?{'x-bf2026-qa-key':qaKey}:{},...headers},body,redirect:'error'});
  return {status:r.status,data:await r.json()};
 }
 const before={};
 for(const [name,sql] of Object.entries({
  r123:"SELECT count(*)::int n FROM bf2026_getcourse_readback_once",
  r124:"SELECT count(*)::int n FROM bf2026_single_checkout_qa_intents",
  events:"SELECT count(*)::int n FROM bf2026_getcourse_callback_hints",
  native:"SELECT count(*)::int n FROM bf2026_native_bundle_verification"
 }))before[name]=(await pool.query(sql)).rows[0].n;
 t.after(async()=>pool.end());
 await t.test('private route authorization and stage default OFF',async()=>{
  assert.equal((await call(prefix+'status',{auth:false})).status,404);
  const status=await call(prefix+'status');
  assert.equal(status.status,200,JSON.stringify(status));
  assert.equal(status.data.configured_feature_enabled,false);
  assert.equal(status.data.configured_native_observer_enabled,false);
  assert.equal(status.data.configured_read_only_secret_file,false);
  assert.equal(status.data.provider_reader_connected,false);
  assert.equal(status.data.postgres_ledger_ready,true);
  assert.equal(status.data.export_readback_available,false);
  assert.equal(status.data.cta_total,10);
  assert.deepEqual(status.data.cta_feature_keys_enabled,[]);
  assert.equal(status.data.public_release_allowed,false);
  assert.equal(status.data.receipt_verified,false);
  assert.equal(status.data.actual_grants_verified,false);
  assert.equal(status.data.provider_side_unchecked_consent_verified,false);
 });
 await t.test('no native Export API evidence in actual postgres -> full HOLD',async()=>{
  const response=await call(prefix+'bundle');
  assert.equal(response.status,200);
  assert.equal(response.data.state,'HOLD_NATIVE_READBACK_FEATURE_OR_SECRET_DISABLED');
  assert.equal(response.data.export_order_identity_verified,false);
  assert.equal(response.data.export_accepted_payment_verified,false);
  assert.equal(response.data.independently_attested_receipt_structure,false);
  assert.equal(response.data.independently_attested_grants_structure,false);
  assert.equal(response.data.provider_cryptographic_signature_verified,false);
  assert.equal(response.data.public_release_allowed,false);
  assert.equal(response.data.checkout_url,null);
  assert.equal(response.data.missing_requirements.length,6);
 });
 await t.test('fixed 10 forms individual server feature gates, pinned Offer/Widget/Training/price',async()=>{
  const all=await call(prefix+'routes');
  assert.equal(all.status,200);
  assert.equal(all.data.routes.length,10);
  assert.equal(all.data.routes.every(x=>x.configured_feature_enabled===false),true);
  assert.equal(all.data.routes.every(x=>x.public_release_allowed===false),true);
  for(const [key,e] of Object.entries(EXPECTED)){
   const status=await call(prefix+'cta?route='+encodeURIComponent(key));
   assert.equal(status.status,200,key);
   const x=status.data;
   assert.equal(x.route_key,key);
   assert.equal(x.offer_id,e.offer_id);
   assert.equal(x.widget_id,e.widget_id);
   assert.equal(x.amount_rub,e.price);
   assert.deepEqual(x.product_training_pairs,
    e.pairs.map(([product_id,training_id])=>({product_id,training_id:training_id||null})),key);
   assert.equal(x.configured_feature_enabled,false);
   assert.equal(x.reason,'HOLD_FEATURE_DISABLED');
   assert.equal(x.public_release_allowed,false);
   assert.equal(x.checkout_url,null);
  }
  assert.equal((await call(prefix+'cta?route=single%3Atrainer')).status,404);
  assert.equal((await call(prefix+'cta?route=single%3Arejection&offer=8934973')).status,404);
 });
 await t.test('refresh is disabled even with valid key, and no key/invalid key denied',async()=>{
  const id=crypto.randomBytes(16).toString('hex');
  const noKey=await call(prefix+'refresh',{method:'POST'});
  assert.equal(noKey.status,422);
  const response=await call(prefix+'refresh',{method:'POST',headers:{
   'x-bf2026-idempotency-key':id
  }});
  assert.equal(response.status,202);
  assert.equal(response.data.state,'HOLD_GETCOURSE_READONLY_PROVIDER_UNCONFIGURED');
  assert.equal(response.data.public_release_allowed,false);
  const withBody=await call(prefix+'refresh',{method:'POST',headers:{
   'content-type':'application/json','x-bf2026-idempotency-key':id
  },body:'{"payment_verified":true}'});
  assert.equal(withBody.status,415);
  assert.equal((await call(prefix+'refresh',{method:'GET'})).status,404);
  assert.equal((await call(prefix+'refresh',{method:'POST',headers:{
   'x-bf2026-idempotency-key':id,origin:'https://spoof.example'
  }})).status,403);
 });
 await t.test('no public orders, checkout, fiscal receipt, grants or feature release',async()=>{
  const s=await call('/api/checkout/status',{auth:false});
  assert.equal(s.status,200);
  assert.equal(s.data.sales_ready,false);
  assert.equal(s.data.verified_sale_routes,0);
  for(const q of [{kind:'single',lot:1},{kind:'single',lot:9,variant:'2'},{kind:'single',lot:12}]){
   const r=await call('/api/checkout/start',{auth:false,method:'POST',
    headers:{'content-type':'application/json','origin':'https://wf.tati-lar.ru'},
    body:JSON.stringify(q)});
   assert.equal(r.status,503);
   assert.equal(r.data.code,'GETCOURSE_OFFER_NOT_READY');
   assert.equal(r.data.checkout_url,undefined);
  }
  assert.equal((await call('/api/checkout/form?route=single%3Arejection',{auth:false})).status,404);
 });
 await t.test('PG rows/leases unchanged after real HTTP E2E, no provider calls',async()=>{
  for(const [name,sql] of Object.entries({
   r123:"SELECT count(*)::int n FROM bf2026_getcourse_readback_once",
   r124:"SELECT count(*)::int n FROM bf2026_single_checkout_qa_intents",
   events:"SELECT count(*)::int n FROM bf2026_getcourse_callback_hints",
   native:"SELECT count(*)::int n FROM bf2026_native_bundle_verification"
  })){
   const n=(await pool.query(sql)).rows[0].n;
   assert.equal(n,before[name],name);
  }
  const budget=await pool.query(
   "SELECT request_count,outstanding_export_id FROM bf2026_getcourse_export_budget WHERE account_host='study.shkola-dnv.com'");
  assert.equal(Number(budget.rows[0].request_count),0);
  assert.equal(budget.rows[0].outstanding_export_id,null);
 });
});
