'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ROOT='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
const SITE='http://127.0.0.1:18774';
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&
 process.env.BF2026_R130_STAGE_PORT==='18774'&&
 process.env.BF2026_STAGE_PG_POOL_MODULE===ROOT+'/stage-pool-module.cjs';
test('R130 actual patched R129 stage persists anti-rollback schema and stays HOLD without genuine owner manifests',
 {skip:!enabled},async t=>{
 const {pool}=require(ROOT+'/stage-pool-module.cjs');
 const qa=fs.readFileSync(ROOT+'/private-widget-qa.secret','utf8').trim();
 t.after(()=>pool.end());
 async function get(path,auth=false){
  const r=await fetch(SITE+path,{headers:auth?{'x-bf2026-qa-key':qa}:{},redirect:'error'});
  return {status:r.status,data:await r.json()};
 }
 async function post(path,body,{origin='https://wf.tati-lar.ru',auth=false}={}){
  const headers={};if(origin)headers.origin=origin;
  if(auth)headers['x-bf2026-qa-key']=qa;
  if(body!==undefined)headers['content-type']='application/json';
  const r=await fetch(SITE+path,{method:'POST',headers,
   body:body===undefined?undefined:JSON.stringify(body),redirect:'error'});
  return {status:r.status,data:await r.json()};
 }
 const status=await get('/api/checkout/_qa/manifest/status',{});
 assert.equal(status.status,404);
 const privateStatus=await get('/api/checkout/_qa/manifest/status',true);
 assert.equal(privateStatus.status,200,JSON.stringify(privateStatus.data));
 assert.equal(privateStatus.data.postgres_ready,true);
 assert.equal(privateStatus.data.registry_scope,'BF2026_SITE');
 assert.equal(privateStatus.data.trust_root_configured,false);
 assert.equal(privateStatus.data.r127_route_manifest_verified,false);
 assert.equal(privateStatus.data.manifest_active,false);
 assert.equal(privateStatus.data.manifest_version,null);
 assert.equal(privateStatus.data.site_entry_count,12);
 assert.equal(privateStatus.data.individual_route_count,10);
 assert.equal(privateStatus.data.qa_only_entry_count,2);
 assert.equal(privateStatus.data.public_release_allowed,false);
 const rows=await pool.query(
  "SELECT count(*)::int n FROM bf2026_r130_manifest_head WHERE registry_scope='BF2026_SITE'");
 assert.equal(rows.rows[0].n,0);
 const challenge=await post('/api/checkout/consent/challenge',{kind:'single',lot:1});
 assert.equal(challenge.status,503);
 assert.equal(challenge.data.code,'R130_VERSIONED_MANIFEST_NOT_ACTIVE');
 assert.equal(challenge.data.public_release_allowed,false);
 const direct=await post('/api/checkout/_provider/getcourse/order-created',{}, {origin:null});
 assert.equal(direct.status,503);
 assert.equal(direct.data.code,'R130_VERSIONED_MANIFEST_NOT_ACTIVE');
 const qaUnauth=await post('/api/checkout/_qa/consent-boundary/challenge',{route_key:'single:rejection'});
 assert.equal(qaUnauth.status,404);
 const qaAuth=await post('/api/checkout/_qa/consent-boundary/challenge',
  {route_key:'single:rejection'},{origin:null,auth:true});
 assert.equal(qaAuth.status,503);
 assert.equal(qaAuth.data.code,'R130_VERSIONED_MANIFEST_NOT_ACTIVE');
 const siteStatus=await get('/api/checkout/status');
 assert.equal(siteStatus.status,200);
 assert.equal(siteStatus.data.sales_ready,false);
 assert.equal(siteStatus.data.verified_sale_routes,0);
 const r127=await pool.query(
  "SELECT count(*)::int n FROM bf2026_r127_consent_challenges WHERE r130_registry_scope='BF2026_SITE'");
 assert.equal(r127.rows[0].n,0);
});
