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
 await t.test('QA routes require auth and no real revision/callback secret is configured',async()=>{
  assert.equal((await get('/api/checkout/_qa/consent-boundary/status',false)).status,404);
  const s=await get('/api/checkout/_qa/consent-boundary/status');
  assert.equal(s.status,200);
  assert.equal(s.data.postgres_ready,true);
  assert.equal(s.data.approved_offer_revisions,0);
  assert.equal(s.data.callback_shared_secret_configured,false);
  assert.equal(s.data.provider_native_consent_verifier_configured,false);
  assert.equal(s.data.provider_native_unchecked_submit_negative_test_verified,false);
  assert.equal(s.data.legacy_user_custom_field_22204810_accepted_as_proof,false);
  assert.equal(s.data.public_release_allowed,false);
 });
 await t.test('session can be issued but challenge fails without owner-approved offer revision',async()=>{
  const sessionResponse=await fetch(base+'/api/checkout/_qa/consent-boundary/session',{method:'POST',headers:{'x-bf2026-qa-key':key},redirect:'error'});
  const session={status:sessionResponse.status,data:await sessionResponse.json(),headers:sessionResponse.headers};
  assert.equal(session.status,201);
  const cookie=session.headers.get('set-cookie').split(';')[0];
  assert.match(session.headers.get('set-cookie'),/HttpOnly/);
  assert.match(session.headers.get('set-cookie'),/Secure/);
  const challenge=await post('/api/checkout/_qa/consent-boundary/challenge',{route_key:'single:rejection'},{cookie});
  assert.equal(challenge.status,503);
  assert.equal(challenge.data.code,'R127_OFFER_REVISION_NOT_OWNER_VERIFIED');
  assert.equal(challenge.data.provider_consent_verified,false);
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
  assert.ok([
   'HOLD_PROVIDER_CALLBACK_SECRET_NOT_CONFIGURED',
   'HOLD_NATIVE_GETCOURSE_ORDER_FIELD_IDS_OR_CALLBACK_CONFIG'
  ].includes(r.data.state));
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
