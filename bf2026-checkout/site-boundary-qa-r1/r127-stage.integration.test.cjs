'use strict';
// Real patched R127 isolated site server + PostgreSQL16, no GC key/callback
// configuration, no provider request, no order/payment/grant writes.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const poolPath=process.env.BF2026_STAGE_PG_POOL_MODULE;
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&
 process.env.BF2026_R127_STAGE_PORT==='18774'&&Boolean(poolPath);
const base='http://127.0.0.1:18774';
test('R127 actual isolated site HTTP/PG defaults HOLD and direct HTTP cannot bypass consent', {skip:!enabled},async t=>{
 const pool=require(poolPath).pool;
 const key=fs.readFileSync('/srv/factory-scratch/bf2026-r118-relay-stage-20261119/private-widget-qa.secret','utf8').trim();
 const before=await pool.query('SELECT count(*)::int n FROM bf2026_r127_consent_challenges');
 const beforeIntents=await pool.query('SELECT count(*)::int n FROM bf2026_single_checkout_qa_intents');
 t.after(()=>pool.end());
 async function get(path,auth=true){
  const r=await fetch(base+path,{headers:auth?{'x-bf2026-qa-key':key}:{},redirect:'error'});
  return {status:r.status,data:await r.json(),headers:r.headers};
 }
 async function post(path,body,headers={}){
  const r=await fetch(base+path,{method:'POST',headers:{
   'content-type':'application/json','origin':'https://wf.tati-lar.ru','x-bf2026-qa-key':key,...headers
  },body:JSON.stringify(body),redirect:'error'});
  return {status:r.status,data:await r.json(),headers:r.headers};
 }
 await t.test('R130 versioned manifest status is private and no owner trust/config is installed',async()=>{
  assert.equal((await get('/api/checkout/_qa/manifest/status',false)).status,404);
  const s=await get('/api/checkout/_qa/manifest/status');
  assert.equal(s.status,200);
  assert.equal(s.data.postgres_ready,true);
  assert.equal(s.data.trust_root_configured,false);
  assert.equal(s.data.r127_route_manifest_verified,false);
  assert.equal(s.data.manifest_active,false);
  assert.equal(s.data.manifest_version,null);
  assert.equal(s.data.site_entry_count,12);
  assert.equal(s.data.individual_route_count,10);
  assert.equal(s.data.public_release_allowed,false);
 });
 await t.test('private R127 session/challenge cannot bypass missing R130 signed manifest',async()=>{
  const response=await fetch(base+'/api/checkout/_qa/consent-boundary/session',{
   method:'POST',headers:{'x-bf2026-qa-key':key},redirect:'error'
  });
  const result={status:response.status,data:await response.json()};
  assert.equal(result.status,503);
  assert.equal(result.data.code,'R130_VERSIONED_MANIFEST_NOT_ACTIVE');
  assert.equal(result.data.public_release_allowed,false);
 });
 await t.test('GetCourse callback route remains disabled without private server-only secret',async()=>{
  const response=await fetch(base+'/api/checkout/_provider/getcourse/order-created',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({
    deal_id:'99127001',deal_number:'99127001',user_id:'524210421',offers:'8934973',
    cost_money_value:'3333',status:'new',created_at:new Date().toISOString(),
    consent_nonce:'A'.repeat(43),offer_revision_sha256:'0'.repeat(64)
   }),redirect:'error'});
  const r={status:response.status,data:await response.json()};
  assert.equal(r.status,503);
  // R129's stricter owner-signed ORDER-field gateway deliberately denies
  // before R127 can even inspect its shared callback secret. Both states
  // must fail closed and neither can prove native consent or payment.
  assert.equal(r.data.code,'R130_VERSIONED_MANIFEST_NOT_ACTIVE');
  assert.equal(r.data.state,'HOLD_OWNER_SIGNED_12_ENTRY_MANIFEST_OR_R127_ROUTE_REVISION');
  assert.notEqual(r.data.public_release_allowed,true);
 });
 await t.test('direct public checkout/start cannot trust fake client consent/JS/provider flags',async()=>{
  const status=await get('/api/checkout/status',false);
  assert.equal(status.status,200);
  assert.equal(status.data.sales_ready,false);
  assert.equal(status.data.verified_sale_routes,0);
  const cases=[
   {kind:'single',lot:1},
   {kind:'single',lot:1,consent_checked:true,consent:true,provider_consent_verified:true,
    consent_nonce:'A'.repeat(43),offer_revision_sha256:'0'.repeat(64)},
   {kind:'single',lot:9,variant:'2',consent_checked:true},
   {kind:'set',items:['rejection','union']}
  ];
  for(const body of cases){
   const r=await post('/api/checkout/start',body);
   assert.notEqual(r.status,200,JSON.stringify({body,data:r.data}));
   assert.equal(Boolean(r.data.checkout_url),false);
   assert.notEqual(r.data.public_release_allowed,true);
  }
  const validSet=await post('/api/checkout/start',{kind:'set',items:['rejection','union']});
  assert.equal(validSet.status,503);
  assert.equal(validSet.data.code,'R127_PROVIDER_NATIVE_CONSENT_HOLD');
  assert.equal(validSet.data.provider_consent_verified,false);
  assert.equal(validSet.data.checkout_url,null);
  assert.equal(validSet.data.public_release_allowed,false);
 });
 await t.test('R127 and R124 staging rows unchanged; no order, payment, receipt, or grant writes',async()=>{
  const after=await pool.query('SELECT count(*)::int n FROM bf2026_r127_consent_challenges');
  const intents=await pool.query('SELECT count(*)::int n FROM bf2026_single_checkout_qa_intents');
  assert.equal(after.rows[0].n,before.rows[0].n);
  assert.equal(intents.rows[0].n,beforeIntents.rows[0].n);
 });
});
