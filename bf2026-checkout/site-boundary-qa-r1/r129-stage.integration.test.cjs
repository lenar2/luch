'use strict';
/* Actual R129 patched site + existing R128 frontend preview, real PG16.
 * No signed native config or real GetCourse field ID: every route stays HOLD.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ROOT='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&
 process.env.BF2026_R129_SITE_PORT==='18774'&&
 process.env.BF2026_STAGE_PG_POOL_MODULE===ROOT+'/stage-pool-module.cjs';
const SITE='http://127.0.0.1:18774';
const PREVIEW='http://127.0.0.1:18775';
const ORIGIN='https://wf.tati-lar.ru';
test('R129 actual staged site+preview HTTP and PostgreSQL reject all unverified order field and Process mappings',
 {skip:!enabled},async t=>{
 const {pool}=require(ROOT+'/stage-pool-module.cjs');
 const qa=fs.readFileSync(ROOT+'/private-widget-qa.secret','utf8').trim();
 t.after(()=>pool.end());
 async function call(base,path,{method='GET',body,cookie,origin=ORIGIN,qaAuth=false,auth}={}){
  const headers={};if(origin)headers.origin=origin;
  if(body!==undefined)headers['content-type']='application/json';
  if(cookie)headers.cookie=cookie;
  if(qaAuth)headers['x-bf2026-qa-key']=qa;
  if(auth)headers.authorization=auth;
  const response=await fetch(base+path,{method,headers,redirect:'error',
   body:body===undefined?undefined:JSON.stringify(body)});
  const raw=await response.text();
  let result;try{result=JSON.parse(raw)}catch{result={html:raw}}
  return {status:response.status,body:result,headers:response.headers};
 }
 await t.test('real PG migration has exactly two UNVERIFIED Order placeholders and one UNVERIFIED Process',async()=>{
  const rows=await pool.query('SELECT field_role,field_id,state FROM bf2026_r129_order_fields ORDER BY field_role');
  assert.deepEqual(rows.rows.map(x=>x.field_role),['consent_nonce','offer_revision_sha256']);
  assert.equal(rows.rows.every(x=>x.field_id===null&&x.state==='UNVERIFIED'),true);
  const process=await pool.query('SELECT process_id,state FROM bf2026_r129_order_process');
  assert.equal(process.rows.length,1);assert.equal(process.rows[0].process_id,null);
  assert.equal(process.rows[0].state,'UNVERIFIED');
 });
 await t.test('private QA status is authenticated and publishes no fictitious numeric field ID',async()=>{
  const unauth=await call(SITE,'/api/checkout/_qa/order-fields/status');
  assert.equal(unauth.status,404);
  const info=await call(SITE,'/api/checkout/_qa/order-fields/status',{qaAuth:true});
  assert.equal(info.status,200,JSON.stringify(info.body));
  assert.equal(info.body.postgres_ready,true);
  assert.equal(info.body.signed_owner_config_configured,false);
  assert.equal(info.body.order_fields_native_verified,undefined);
  assert.equal(info.body.order_field_ids_verified,false);
  assert.equal(info.body.order_field_ids,null);
  assert.equal(info.body.public_release_allowed,false);
 });
 await t.test('actual customer site and preview status both HOLD, with exact 10 native route keys',async()=>{
  const site=await call(SITE,'/api/checkout/status');
  assert.equal(site.status,200);assert.equal(site.body.sales_ready,false);
  assert.equal(site.body.verified_sale_routes,0);
  for(const base of [SITE,PREVIEW]){
   const v=await call(base,'/api/checkout/consent/status');
   assert.equal(v.status,200);assert.equal(v.body.individual_route_count,10);
   assert.equal(v.body.challenge_issuance_enabled,false);
   assert.equal(v.body.order_field_ids_verified,false);
   assert.equal(v.body.provider_signature_verified,false);
   assert.equal(v.body.public_release_allowed,false);
  }
  const html=await call(PREVIEW,'/');
  assert.equal(html.status,200);
  assert.equal((html.body.html.match(/data-r128-lot="/g)||[]).length,10);
  assert.ok(html.body.html.includes('r128-cta-challenge-preview.js'));
  assert.ok(html.body.html.includes('data-r128-route-2="single:source:2"'));
 });
 await t.test('actual preview HTTP→R129 gate refuses challenge for each of 10 CTA routes; no provider API called',async()=>{
  const session=await call(PREVIEW,'/api/checkout/consent/session',{method:'POST'});
  assert.equal(session.status,201);
  assert.match(session.headers.get('set-cookie'),/HttpOnly/);
  const cookie=session.headers.get('set-cookie').split(';')[0];
  const cases=[1,2,3,4,5,6,7,9,9,12].map((lot,i)=>({
   kind:'single',lot,...(lot===9?{variant:i===7?'1':'2'}:{})
  }));
  for(const selection of cases){
   const resp=await call(PREVIEW,'/api/checkout/consent/challenge',{
    method:'POST',body:selection,cookie
   });
   assert.equal(resp.status,503,JSON.stringify({selection,response:resp.body}));
   assert.equal(resp.body.code,'R129_ORDER_LEVEL_NATIVE_FIELDS_NOT_ATTESTED');
   assert.equal(resp.body.public_release_allowed,false);
  }
 });
 await t.test('callback, missing Origin, forged fields and direct purchase fail closed',async()=>{
  const unknown=await call(SITE,'/api/checkout/_provider/getcourse/order-created',{
   method:'POST',origin:null,body:{deal_id:'99129001',consent_nonce:'a'.repeat(43)}
  });
  assert.equal(unknown.status,503);
  assert.equal(unknown.body.code,'R129_ORDER_LEVEL_NATIVE_FIELDS_NOT_ATTESTED');
  const noOrigin=await call(SITE,'/api/checkout/consent/challenge',{
   method:'POST',origin:null,body:{kind:'single',lot:1}
  });
  assert.equal(noOrigin.status,503);
  const invalid=await call(SITE,'/api/checkout/consent/challenge',{
   method:'POST',body:{kind:'single',lot:1,offer_id:8934973,
    provider_consent_verified:true}
  });
  assert.equal(invalid.status,503);
  const order=await call(SITE,'/api/checkout/start',{
   method:'POST',body:{kind:'set',items:['rejection_program','union']}
  });
  assert.equal(order.status,503);
  assert.equal(order.body.code,'R127_PROVIDER_NATIVE_CONSENT_HOLD');
  assert.equal(order.body.checkout_url,null);
  const form=await call(SITE,'/api/checkout/form?route=single:rejection');
  assert.equal(form.status,404);
 });
 await t.test('idempotent refused attempts did not create R127/R124 or provider-side effect rows',async()=>{
  for(const [table,expected] of [
   ['bf2026_r127_consent_challenges',0],
   ['bf2026_single_checkout_qa_intents',0],
   ['bf2026_getcourse_readback_once',0],
   ['bf2026_native_bundle_verification',0],
   ['bf2026_getcourse_callback_hints',0]
  ]){
   const q=await pool.query('SELECT count(*)::int n FROM '+table);
   assert.equal(q.rows[0].n,expected,table);
  }
 });
});
