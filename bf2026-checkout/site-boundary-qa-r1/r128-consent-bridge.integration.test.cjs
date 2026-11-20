'use strict';
/* R128 synthetic callback contract E2E: real site quote logic + real PG16 +
 * actual HTTP bridge + R127 callback handler. No GetCourse request/order/payment.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const STAGE='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&
 process.env.BF2026_R128_TEST_FIXTURE==='1'&&
 process.env.BF2026_R128_STAGE_PORT==='18775'&&
 Boolean(process.env.BF2026_STAGE_PG_POOL_MODULE);
test('R128 all 10 individual native CTAs → server challenge → order-scoped callback → PostgreSQL HOLD',
 {skip:!enabled},async t=>{
 const pool=require(process.env.BF2026_STAGE_PG_POOL_MODULE).pool;
 const site=require(path.join(STAGE,'server.js'));
 const stage=require('./r124-stage-training-overlay.cjs').stageMetadata({
  catalog:site.catalog,registry:site.registry
 });
 const {EXPECTED}=require('./r123-single-widget-adapter.cjs');
 const {createConsentBoundary}=require('./r127-consent-boundary.cjs');
 const {createConsentHttp}=require('./r127-consent-http.cjs');
 const {createConsentBridge}=require('./r128-consent-bridge-http.cjs');
 const {CALLBACK}=require('./r127-consent-http.cjs');
 const TEST_SECRET='R128_TEST_ONLY_NOT_GETCOURSE_'+crypto.randomBytes(32).toString('hex');
 const offers={};
 for(const [key,e] of Object.entries(EXPECTED)){
  offers[key]={offer_id:e.offer_id,
   revision_sha256:crypto.createHash('sha256').update('R128_TEST_FIXTURE_ONLY:'+key).digest('hex'),
   native_readback_verified:true};
 }
 const manifest={schema:'bf2026.r127.offer-revisions.v1',
  source:'TEST_FIXTURE_ONLY',approved:true,offers};
 const boundary=createConsentBoundary({pool,stage,revisionManifest:manifest,
  callbackSecret:TEST_SECRET,nativeConsentVerifier:null,allowTestRevisionFixture:true});
 const bridge=createConsentBridge({boundary,quoteFn:site.compute,checkoutKey:site.checkoutKey,
  stage,allowedOrigin:'https://wf.tati-lar.ru',orderCallbackReady:true});
 const callback=createConsentHttp({boundary,qaAuthorized:()=>false});
 const server=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname;
  if(p.startsWith('/api/checkout/consent/'))return bridge(req,res,p);
  if(p===CALLBACK)return callback(req,res,p);
  res.writeHead(404);res.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const before=await pool.query('SELECT count(*)::int n FROM bf2026_r127_consent_challenges');
 const nonceList=[];
 t.after(async()=>{
  if(nonceList.length){
   const hashes=nonceList.map(n=>crypto.createHash('sha256').update(n).digest('hex'));
   await pool.query('DELETE FROM bf2026_r127_consent_challenges WHERE nonce_sha256=ANY($1::char(64)[])',[hashes]);
  }
  await new Promise(resolve=>server.close(resolve));
  await pool.end();
 });
 async function post(path,body,{cookie,origin='https://wf.tati-lar.ru',authorization}={}){
  const headers={};
  if(origin)headers.origin=origin;
  if(body!==undefined)headers['content-type']='application/json';
  if(cookie)headers.cookie=cookie;
  if(authorization)headers.authorization=authorization;
  const r=await fetch(base+path,{method:'POST',headers,
   body:body===undefined?undefined:JSON.stringify(body),redirect:'error'});
  return {status:r.status,headers:r.headers,data:await r.json()};
 }
 const session=await post('/api/checkout/consent/session');
 assert.equal(session.status,201,JSON.stringify(session.data));
 const setCookie=session.headers.get('set-cookie');
 assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/Secure/);assert.match(setCookie,/SameSite=Strict/);
 const cookie=setCookie.split(';')[0];
 const selections=[
  {kind:'single',lot:1},{kind:'single',lot:2},{kind:'single',lot:3},
  {kind:'single',lot:4},{kind:'single',lot:5},{kind:'single',lot:6},
  {kind:'single',lot:7},{kind:'single',lot:9,variant:'1'},
  {kind:'single',lot:9,variant:'2'},{kind:'single',lot:12}
 ];
 const challenges=[];
 for(const selection of selections){
  const quote=site.compute(selection),key=site.checkoutKey(quote),expected=EXPECTED[key];
  const response=await post('/api/checkout/consent/challenge',selection,{cookie});
  assert.equal(response.status,201,JSON.stringify({selection,data:response.data}));
  const c=response.data;
  assert.equal(c.route_key,key);assert.equal(c.offer_id,expected.offer_id);
  assert.equal(c.widget_id,expected.widget_id);assert.equal(c.amount_rub,expected.price);
  assert.equal(c.client_checkbox_is_not_evidence,true);
  assert.equal(c.provider_consent_verified,false);
  assert.equal(c.public_release_allowed,false);
  assert.equal(c.client_guard_is_provider_proof,false);
  assert.equal(c.native_cta.client_guard_block_id>0,true);
  assert.deepEqual(c.native_cta.product_training_pairs,
   expected.pairs.map(([product_id,training_id])=>({product_id,training_id:training_id||null})));
  nonceList.push(c.nonce);challenges.push({selection,key,expected,c});
 }
 assert.equal(new Set(nonceList).size,10,'nonce must be unique per CTA challenge');
 const badShape=await post('/api/checkout/consent/challenge',
  {kind:'single',lot:1,offer_id:8934973,consent_checked:true},{cookie});
 assert.equal(badShape.status,422);
 const noSession=await post('/api/checkout/consent/challenge',{kind:'single',lot:1});
 assert.equal(noSession.status,401);
 const wrongOrigin=await post('/api/checkout/consent/challenge',{kind:'single',lot:1},
  {cookie,origin:'https://attacker.invalid'});
 assert.equal(wrongOrigin.status,403);
 const trainer=await post('/api/checkout/consent/challenge',{kind:'single',lot:8},{cookie});
 assert.equal(trainer.status,404);
 const set=await post('/api/checkout/consent/challenge',
  {kind:'set',items:['rejection_program','union']},{cookie});
 assert.equal(set.status,422);
 // Simulate only the documented nine-field GetCourse Process payload. This
 // is a local test fixture, NOT a real provider event or native order.
 for(let i=0;i<challenges.length;i++){
  const {expected,c}=challenges[i];
  const id=String(9800000001+i);
  const payload={
   deal_id:id,deal_number:id,user_id:'990000001',
   offers:String(expected.offer_id),cost_money_value:String(expected.price),
   status:'new',created_at:c.issued_at,
   consent_nonce:c.nonce,offer_revision_sha256:c.offer_revision_sha256
  };
  const received=await post(CALLBACK,payload,{origin:null,
   authorization:'Bearer '+TEST_SECRET});
  assert.equal(received.status,202,JSON.stringify(received.data));
  assert.equal(received.data.state,'ORDER_CALLBACK_MATCHED_HOLD');
  assert.equal(received.data.provider_order_matched,true);
  assert.equal(received.data.provider_consent_verified,false);
  assert.equal(received.data.provider_signature_verified,false);
  assert.equal(received.data.public_release_allowed,false);
  const replay=await post(CALLBACK,payload,{origin:null,
   authorization:'Bearer '+TEST_SECRET});
  assert.equal(replay.status,200);assert.equal(replay.data.duplicate,true);
  const altered=await post(CALLBACK,{...payload,deal_number:String(Number(id)+1)},
   {origin:null,authorization:'Bearer '+TEST_SECRET});
  assert.equal(altered.status,409);
 }
 const hashes=nonceList.map(n=>crypto.createHash('sha256').update(n).digest('hex'));
 const rows=await pool.query(
  'SELECT route_key,offer_id,widget_id,amount_rub,state,provider_order_id,'+
  'provider_callback_auth,provider_signature_verified,native_consent_verified,public_release_allowed '+
  'FROM bf2026_r127_consent_challenges WHERE nonce_sha256=ANY($1::char(64)[]) ORDER BY route_key',[hashes]);
 assert.equal(rows.rows.length,10);
 for(const row of rows.rows){
  assert.equal(row.state,'ORDER_CALLBACK_MATCHED_HOLD');
  assert.equal(row.provider_callback_auth,'GETCOURSE_PROCESS_BEARER_SHARED_SECRET');
  assert.equal(row.provider_signature_verified,false);
  assert.equal(row.native_consent_verified,false);
  assert.equal(row.public_release_allowed,false);
 }
 const after=await pool.query('SELECT count(*)::int n FROM bf2026_r127_consent_challenges');
 assert.equal(after.rows[0].n,before.rows[0].n+10);
});
