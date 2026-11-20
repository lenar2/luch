'use strict';
/* Actual patched R128 site process + real PostgreSQL16. No GetCourse requests. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const poolPath=process.env.BF2026_STAGE_PG_POOL_MODULE;
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&
 process.env.BF2026_R128_STAGE_PORT==='18774'&&Boolean(poolPath);
const base='http://127.0.0.1:18774';
const ORIGIN='https://wf.tati-lar.ru';
test('R128 real site stage keeps CTA challenge and GetCourse callback disabled without native order-field readback',
 {skip:!enabled},async t=>{
 const pool=require(poolPath).pool;
 const key=require('node:fs').readFileSync('/srv/factory-scratch/bf2026-r118-relay-stage-20261119/private-widget-qa.secret','utf8').trim();
 const beforeConsent=await pool.query('SELECT count(*)::int n FROM bf2026_r127_consent_challenges');
 const beforeIntents=await pool.query('SELECT count(*)::int n FROM bf2026_single_checkout_qa_intents');
 t.after(()=>pool.end());
 async function request(path,{method='GET',body,origin=ORIGIN,cookie,auth=false,authorization}={}){
  const headers={};if(origin)headers.origin=origin;
  if(auth)headers['x-bf2026-qa-key']=key;
  if(cookie)headers.cookie=cookie;
  if(authorization)headers.authorization=authorization;
  if(body!==undefined)headers['content-type']='application/json';
  const r=await fetch(base+path,{method,headers,
   body:body===undefined?undefined:JSON.stringify(body),redirect:'error'});
  return {status:r.status,headers:r.headers,data:await r.json()};
 }
 await t.test('public status exposes no secrets and enumerates exact verified CTA map counts',async()=>{
  const s=await request('/api/checkout/consent/status');
  assert.equal(s.status,200);
  assert.equal(s.data.native_widget_count,12);
  assert.equal(s.data.individual_route_count,10);
  assert.equal(s.data.qa_only_native_widget_count,2);
  assert.equal(s.data.order_callback_contract_verified,false);
  assert.equal(s.data.callback_secret_configured,false);
  assert.equal(s.data.challenge_issuance_enabled,false);
  assert.equal(s.data.client_field_22204810_accepted_as_proof,false);
  assert.equal(s.data.public_release_allowed,false);
 });
 await t.test('server creates HttpOnly session but never returns raw session token',async()=>{
  const s=await request('/api/checkout/consent/session',{method:'POST'});
  assert.equal(s.status,201);
  assert.equal(s.data.session_created,true);assert.equal(s.data.token_returned,false);
  const cookie=s.headers.get('set-cookie');
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
  globalThis.r128StageCookie=cookie.split(';')[0];
 });
 await t.test('all customer challenge attempts remain HOLD until order fields + callback config are native-read-back',async()=>{
  const good=await request('/api/checkout/consent/challenge',{method:'POST',
   body:{kind:'single',lot:1},cookie:globalThis.r128StageCookie});
  assert.equal(good.status,503);
  assert.equal(good.data.code,'R128_ORDER_CALLBACK_CONTRACT_NOT_VERIFIED');
  assert.equal(good.data.route_key,'single:rejection');
  assert.equal(good.data.offer_id,8934973);
  assert.equal(good.data.widget_id,1686768);
  assert.equal(good.data.client_guard_block_id,2263300143);
  assert.equal(good.data.order_field_ids,null);
  assert.equal(good.data.provider_consent_verified,false);
  assert.equal(good.data.public_release_allowed,false);
  const forged=await request('/api/checkout/consent/challenge',{method:'POST',
   body:{kind:'single',lot:1,offer_id:8934973,consent_checked:true,
    provider_consent_verified:true,offer_revision_sha256:'a'.repeat(64)},
   cookie:globalThis.r128StageCookie});
  assert.equal(forged.status,422);
  const noCookie=await request('/api/checkout/consent/challenge',{method:'POST',
   body:{kind:'single',lot:1}});
  assert.equal(noCookie.status,401);
  const wrongOrigin=await request('/api/checkout/consent/challenge',{method:'POST',
   body:{kind:'single',lot:1},cookie:globalThis.r128StageCookie,origin:'https://attacker.invalid'});
  assert.equal(wrongOrigin.status,403);
 });
 await t.test('Trainer and dynamic sets are not silently mapped to individual native widgets',async()=>{
  const trainer=await request('/api/checkout/consent/challenge',{method:'POST',
   body:{kind:'single',lot:8},cookie:globalThis.r128StageCookie});
  assert.equal(trainer.status,404);
  assert.equal(trainer.data.code,'R128_CTA_NOT_IN_APPROVED_SINGLE_ALLOWLIST');
  const set=await request('/api/checkout/consent/challenge',{method:'POST',
   body:{kind:'set',items:['rejection_program','union']},cookie:globalThis.r128StageCookie});
  assert.equal(set.status,422);
 });
 await t.test('callback remains disabled; direct public checkout still cannot bypass R127',async()=>{
  const cb=await request('/api/checkout/_provider/getcourse/order-created',{method:'POST',
   origin:null,body:{deal_id:'99127001',deal_number:'99127001',user_id:'990000001',
    offers:'8934973',cost_money_value:'3333',status:'new',
    created_at:new Date().toISOString(),consent_nonce:'A'.repeat(43),
    offer_revision_sha256:'a'.repeat(64)}});
  assert.equal(cb.status,503);
  assert.equal(cb.data.state,'HOLD_PROVIDER_CALLBACK_SECRET_NOT_CONFIGURED');
  assert.equal(cb.data.public_release_allowed,false);
  const direct=await request('/api/checkout/start',{method:'POST',
   body:{kind:'set',items:['rejection_program','union']}});
  assert.equal(direct.status,503);
  assert.equal(direct.data.code,'R127_PROVIDER_NATIVE_CONSENT_HOLD');
  assert.equal(Boolean(direct.data.checkout_url),false);
  assert.equal(direct.data.public_release_allowed,false);
  const form=await request('/api/checkout/form?route=single:rejection');
  assert.equal(form.status,404);
 });
 await t.test('no R127 challenge, R124 intent or provider side-effect rows were created',async()=>{
  const afterConsent=await pool.query('SELECT count(*)::int n FROM bf2026_r127_consent_challenges');
  const afterIntents=await pool.query('SELECT count(*)::int n FROM bf2026_single_checkout_qa_intents');
  assert.equal(afterConsent.rows[0].n,beforeConsent.rows[0].n);
  assert.equal(afterIntents.rows[0].n,beforeIntents.rows[0].n);
 });
});
