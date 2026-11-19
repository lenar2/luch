'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),fs=require('node:fs');
const STAGE='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
const ROOT='/srv/factory-scratch/bf2026-r130-lot10-stage-20261119';
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&
 process.env.BF2026_R131_STAGE_ONLY==='1'&&
 process.env.BF2026_R131_SITE_PORT==='18776'&&
 process.env.BF2026_STAGE_PG_POOL_MODULE===STAGE+'/stage-pool-module.cjs';
const rand=()=>crypto.randomBytes(32).toString('hex');
test('R131 actual isolated site HTTP → PostgreSQL16 single-order QA preparation; no GetCourse writes',
 {skip:!enabled},async t=>{
 const pool=require(STAGE+'/stage-pool-module.cjs').pool;
 const secret=fs.readFileSync(ROOT+'/private-widget-qa.secret','utf8').trim();
 const base='http://127.0.0.1:18776';
 const keys=[];
 t.after(async()=>{
  for(const key of keys)
   await pool.query('DELETE FROM bf2026_r130_set_order_steps WHERE intent_key=$1',[key]);
  for(const key of keys)
   await pool.query('DELETE FROM bf2026_r130_set_order_intents WHERE intent_key=$1',[key]);
  await pool.end();
 });
 async function req(path,{method='GET',body,auth=true,key,origin='https://wf.tati-lar.ru'}={}){
  const headers={};
  if(auth)headers['x-bf2026-qa-key']=secret;
  if(origin)headers.origin=origin;
  if(key)headers['x-bf2026-idempotency-key']=key;
  if(body!==undefined)headers['content-type']='application/json';
  const r=await fetch(base+path,{method,headers,
   body:body===undefined?undefined:JSON.stringify(body),redirect:'error'});
  return {code:r.status,data:await r.json()};
 }
 const before=await pool.query('SELECT count(*)::int n FROM bf2026_r130_set_order_intents');
 const status=await req('/api/checkout/_qa/set-order/status');
 assert.equal(status.code,200);assert.equal(status.data.live_provider_import_enabled,false);
 const anon=await req('/api/checkout/_qa/set-order/intent?key='+rand(),{auth:false});
 assert.equal(anon.code,404);
 const k=rand();keys.push(k);
 const selection={kind:'set',items:['rejection','union']};
 const body={selection,email:'r131-stage-test@example.invalid',
  nonce:crypto.randomBytes(32).toString('base64url'),offerRevisionSha256:'c'.repeat(64)};
 const badBuyer=await req('/api/checkout/_qa/set-order/prepare',{
  method:'POST',key:k,body:{...body,email:'real-customer@example.com'}});
 assert.equal(badBuyer.code,422);
 const deniedOrigin=await req('/api/checkout/_qa/set-order/prepare',{
  method:'POST',key:k,body,origin:'https://attacker.invalid'});
 assert.equal(deniedOrigin.code,403);
 const anonPost=await req('/api/checkout/_qa/set-order/prepare',{
  method:'POST',key:k,body,auth:false});
 assert.equal(anonPost.code,404);
 const [first,repeat]=await Promise.all([
  req('/api/checkout/_qa/set-order/prepare',{method:'POST',key:k,body}),
  req('/api/checkout/_qa/set-order/prepare',{method:'POST',key:k,body})
 ]);
 assert.deepEqual([first.code,repeat.code].sort(),[200,201]);
 assert.deepEqual([first.data.duplicate,repeat.data.duplicate].sort(),[false,true]);
 assert.equal(first.data.offer_ids.length,2);
 assert.deepEqual(first.data.offer_ids,[8934973,8919715]);
 assert.equal(first.data.priced_lines_rub.reduce((s,v)=>s+v,0),8400);
 assert.equal(first.data.provider_requests_sent,0);
 assert.equal(first.data.status.state,'PREPARED');
 assert.equal(first.data.public_checkout_url,null);
 assert.equal(first.data.public_release_allowed,false);
 const conflict=await req('/api/checkout/_qa/set-order/prepare',{
  method:'POST',key:k,body:{...body,
   selection:{kind:'set',items:['rejection','dnv']}}});
 assert.equal(conflict.code,409);
 const reuse=rand();keys.push(reuse);
 const nonceReplay=await req('/api/checkout/_qa/set-order/prepare',{
  method:'POST',key:reuse,body});
 assert.equal(nonceReplay.code,409);
 assert.equal(nonceReplay.data.code,'R131_ONE_TIME_CONSENT_NONCE_REUSED');
 const snapshot=await req('/api/checkout/_qa/set-order/intent?key='+k);
 assert.equal(snapshot.code,200);
 assert.equal(snapshot.data.status.state,'PREPARED');
 assert.equal(snapshot.data.status.imported_line_count,0);
 assert.equal(snapshot.data.status.public_payment_link,null);
 const customerPost=await req('/api/checkout/set/prepare',{
  method:'POST',auth:false,key:rand(),body});
 assert.equal(customerPost.code,404);
 const forbiddenCheckout=await req('/api/checkout/set/execute',{
  method:'POST',body:{kind:'set',items:['rejection','union']}});
 assert.equal(forbiddenCheckout.code,503);
 assert.equal(forbiddenCheckout.data.public_release_allowed,false);
 const row=await pool.query('SELECT state,current_step,public_release_allowed FROM bf2026_r130_set_order_intents WHERE intent_key=$1',[k]);
 assert.equal(row.rows.length,1);assert.equal(row.rows[0].state,'PREPARED');
 assert.equal(row.rows[0].current_step,0);assert.equal(row.rows[0].public_release_allowed,false);
 const step=await pool.query('SELECT count(*)::int n FROM bf2026_r130_set_order_steps WHERE intent_key=$1',[k]);
 assert.equal(step.rows[0].n,2);
 const after=await pool.query('SELECT count(*)::int n FROM bf2026_r130_set_order_intents');
 assert.equal(after.rows[0].n,before.rows[0].n+1);
 console.log('R131_REAL_SITE_QA_INTENT',JSON.stringify({
  concurrent_post_requests:2,unique_prepared_order_intents:1,
  native_offer_positions:2,desired_rub:8400,nonce_replay_rejected:true,
  getcourse_api_requests:0,payment_links:0,public_sale_enabled:false
 }));
});
