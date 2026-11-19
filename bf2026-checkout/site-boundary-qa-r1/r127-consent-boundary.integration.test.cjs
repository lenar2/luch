'use strict';
// Real PostgreSQL16 + real HTTP handler, with a TEST-ONLY callback secret and
// TEST-ONLY offer-revision fixture. This is protocol E2E, NEVER provider proof.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const http=require('node:http');
const pool=require('/srv/factory-scratch/bf2026-r118-relay-stage-20261119/stage-pool-module.cjs').pool;
const {createConsentBoundary,COOKIE}=require('./r127-consent-boundary.cjs');
const {createConsentHttp}=require('./r127-consent-http.cjs');
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&
 process.env.BF2026_R127_STAGE_PORT==='18774'&&
 Boolean(process.env.BF2026_STAGE_PG_POOL_MODULE);
const TEST_SECRET='R127_TEST_ONLY_NOT_A_GETCOURSE_SECRET_'+crypto.randomBytes(24).toString('hex');
const QA='R127_TEST_ONLY_QA_HEADER_'+crypto.randomBytes(16).toString('hex');
const route='single:rejection',offer=8934973;
test('R127 real PG + HTTP: nonce/order/revision/timestamp/replay, always native-consent HOLD', {skip:!enabled},async t=>{
 const table=await pool.query("SELECT to_regclass('public.bf2026_r127_consent_challenges') AS t");
 assert.ok(table.rows[0].t,'R127 migration missing');
 const revision=crypto.createHash('sha256').update('TEST_FIXTURE_ONLY;never owner approved').digest('hex');
 const boundary=createConsentBoundary({
  pool,stage:{stage_only:true,catalog:{pricing_version:'BF2026_TEST_ONLY'}},
  revisionManifest:{schema:'bf2026.r127.offer-revisions.v1',
   source:'TEST_FIXTURE_ONLY',approved:true,
   offers:{[route]:{offer_id:offer,revision_sha256:revision,native_readback_verified:true}}},
  callbackSecret:TEST_SECRET,nativeConsentVerifier:null,
  allowTestRevisionFixture:true
 });
 const handler=createConsentHttp({boundary,qaAuthorized:req=>req.headers['x-bf2026-qa-key']===QA});
 const server=http.createServer((req,res)=>handler(req,res,new URL(req.url,'http://localhost').pathname));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 let nonceHash=null;
 t.after(async()=>{if(nonceHash)await pool.query('DELETE FROM bf2026_r127_consent_challenges WHERE nonce_sha256=$1',[nonceHash]);server.close();await pool.end()});
 async function call(path,{method='GET',qa=true,headers={},body}={}){
  const h={...qa?{'x-bf2026-qa-key':QA}:{},...headers};
  const r=await fetch(base+path,{method,headers:h,body,redirect:'error'});
  return {status:r.status,headers:r.headers,data:await r.json()};
 }
 await t.test('private auth, server-generated HttpOnly session, no browser-supplied session id',async()=>{
  assert.equal((await call('/api/checkout/_qa/consent-boundary/status',{qa:false})).status,404);
  const s=await call('/api/checkout/_qa/consent-boundary/status');
  assert.equal(s.status,200);
  assert.equal(s.data.approved_offer_revisions,1);
  assert.equal(s.data.callback_shared_secret_configured,true);
  assert.equal(s.data.provider_native_consent_verifier_configured,false);
  assert.equal(s.data.provider_native_unchecked_submit_negative_test_verified,false);
  assert.equal(s.data.client_checkbox_trusted,false);
  assert.equal(s.data.legacy_user_custom_field_22204810_accepted_as_proof,false);
  const session=await call('/api/checkout/_qa/consent-boundary/session',{method:'POST'});
  assert.equal(session.status,201);
  const cookie=session.headers.get('set-cookie');
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
  globalThis.r127Cookie=cookie.split(';')[0];
 });
 await t.test('challenge binds exact server-owned route/Offer/revision/time and one-time nonce',async()=>{
  const ch=await call('/api/checkout/_qa/consent-boundary/challenge',{method:'POST',
   headers:{cookie:globalThis.r127Cookie,'content-type':'application/json'},
   body:JSON.stringify({route_key:route})});
  assert.equal(ch.status,201,JSON.stringify(ch.data));
  assert.equal(ch.data.offer_id,offer);assert.equal(ch.data.amount_rub,3333);
  assert.equal(ch.data.offer_revision_sha256,revision);
  assert.match(ch.data.nonce,/^[A-Za-z0-9_-]{40,100}$/);
  assert.equal(ch.data.client_checkbox_is_not_evidence,true);
  assert.equal(ch.data.provider_consent_verified,false);
  assert.equal(ch.data.public_release_allowed,false);
  globalThis.r127Challenge=ch.data;
  nonceHash=crypto.createHash('sha256').update(ch.data.nonce).digest('hex');
  const noSession=await call('/api/checkout/_qa/consent-boundary/challenge',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({route_key:route})});
  assert.equal(noSession.status,422);
  const tampered=await call('/api/checkout/_qa/consent-boundary/challenge',{method:'POST',
   headers:{cookie:globalThis.r127Cookie,'content-type':'application/json'},
   body:JSON.stringify({route_key:route,offer_id:123,consent_checked:true,offer_revision_sha256:revision})});
  assert.equal(tampered.status,422);
 });
 const callback=()=>({
  deal_id:'99127001',deal_number:'99127001',user_id:'524210421',
  offers:String(offer),cost_money_value:'3333',status:'new',
  created_at:new Date(Date.now()+1000).toISOString(),
  consent_nonce:globalThis.r127Challenge.nonce,
  offer_revision_sha256:revision
 });
 async function provider(body,secret=TEST_SECRET){
  return call('/api/checkout/_provider/getcourse/order-created',{method:'POST',qa:false,
   headers:{authorization:'Bearer '+secret,'content-type':'application/json'},
   body:JSON.stringify(body)});
 }
 await t.test('callback bearer source auth required; client consent boolean not an accepted field',async()=>{
  assert.equal((await provider(callback(),'wrong-secret')).status,401);
  assert.equal((await provider({...callback(),consent_checked:true})).status,422);
  assert.equal((await provider({...callback(),provider_consent_verified:true})).status,422);
 });
 await t.test('exact provider order callback matches nonce/offer/revision/time, but does NOT prove consent',async()=>{
  const badOffer=await provider({...callback(),offers:'8934925'});
  assert.equal(badOffer.status,409);
  const badRevision=await provider({...callback(),offer_revision_sha256:'0'.repeat(64)});
  assert.equal(badRevision.status,409);
  const badTime=await provider({...callback(),created_at:new Date(Date.now()-30*60_000).toISOString()});
  assert.equal(badTime.status,409);
  globalThis.r127ProviderPayload=callback();
  const ok=await provider(globalThis.r127ProviderPayload);
  assert.equal(ok.status,202,JSON.stringify(ok.data));
  assert.equal(ok.data.state,'ORDER_CALLBACK_MATCHED_HOLD');
  assert.equal(ok.data.provider_order_matched,true);
  assert.equal(ok.data.provider_consent_verified,false);
  assert.equal(ok.data.provider_negative_test_verified,false);
  assert.equal(ok.data.provider_signature_verified,false);
  assert.equal(ok.data.public_release_allowed,false);
  const inspect=await call('/api/checkout/_qa/consent-boundary/inspect?nonce='+encodeURIComponent(globalThis.r127Challenge.nonce));
  assert.equal(inspect.status,200);
  assert.equal(inspect.data.state,'ORDER_CALLBACK_MATCHED_HOLD');
  assert.equal(inspect.data.native_consent_verified,false);
  assert.equal(inspect.data.provider_signature_verified,false);
  assert.equal(inspect.data.public_release_allowed,false);
 });
 await t.test('exact callback replay idempotent; changed replay denied',async()=>{
  const duplicate=await provider(globalThis.r127ProviderPayload);
  assert.equal(duplicate.status,200);assert.equal(duplicate.data.duplicate,true);
  const changed=await provider({...globalThis.r127ProviderPayload,deal_number:'99127002'});
  assert.equal(changed.status,409);
 });
 await t.test('nonce cannot be reused for a second provider order',async()=>{
  const reuse=await provider({...globalThis.r127ProviderPayload,deal_id:'99127002',deal_number:'99127002'});
  assert.equal(reuse.status,409);
 });
 await t.test('PostgreSQL stores only matched order correlation and permanent HOLD',async()=>{
  const q=await pool.query('SELECT state,offer_id,provider_order_id,provider_callback_auth,provider_signature_verified,native_consent_verified,public_release_allowed FROM bf2026_r127_consent_challenges WHERE nonce_sha256=$1',[nonceHash]);
  assert.equal(q.rows.length,1);
  assert.equal(q.rows[0].state,'ORDER_CALLBACK_MATCHED_HOLD');
  assert.equal(Number(q.rows[0].offer_id),offer);
  assert.equal(q.rows[0].provider_order_id,'99127001');
  assert.equal(q.rows[0].provider_callback_auth,'GETCOURSE_PROCESS_BEARER_SHARED_SECRET');
  assert.equal(q.rows[0].provider_signature_verified,false);
  assert.equal(q.rows[0].native_consent_verified,false);
  assert.equal(q.rows[0].public_release_allowed,false);
 });
});
