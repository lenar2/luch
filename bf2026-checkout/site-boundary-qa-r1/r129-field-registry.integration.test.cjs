'use strict';
/* R129 isolated PostgreSQL16 + HTTP harness: ALL native provider IDs are
 * ephemeral TEST FIXTURES inside a DB transaction rolled back on exit.
 * No GetCourse calls, orders, payments, receipts, grants or public activation.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),http=require('node:http');
const STAGE='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&
 process.env.BF2026_R129_TEST_FIXTURE==='1'&&
 process.env.BF2026_STAGE_PG_POOL_MODULE===STAGE+'/stage-pool-module.cjs'&&
 process.env.BF2026_R115_DB_POOL_MODULE===STAGE+'/stage-pool-module.cjs';
test('R129 isolated PG + real HTTP: signed Order metadata, challenge, callback identity/replay and native HOLD',
 {skip:!enabled},async t=>{
 const {pool}=require(STAGE+'/stage-pool-module.cjs');
 const sql=fs.readFileSync(path.join(__dirname,'r129-order-fields.sql'),'utf8');
 await pool.query(sql); // idempotent isolated migration
 const initial=await pool.query(
  "SELECT field_role,field_id,state FROM bf2026_r129_order_fields ORDER BY field_role");
 const initialProcess=await pool.query(
  'SELECT process_id,state FROM bf2026_r129_order_process');
 assert.equal(initial.rows.length,2);
 assert.equal(initial.rows.every(x=>x.field_id===null&&x.state==='UNVERIFIED'),true);
 assert.equal(initialProcess.rows.length,1);
 assert.equal(initialProcess.rows[0].process_id,null);

 const {SCHEMA,signFixture,verifyOwnerSignedEnvelope,createFieldRegistry}=require('./r129-order-field-registry.cjs');
 const {VARIABLE_SPECS,CALLBACK_URL}=require('./r128-order-callback-contract.cjs');
 const now=Date.now(),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
 const envelope={
  schema:SCHEMA,issued_at:new Date(now-1000).toISOString(),
  expires_at:new Date(now+3600000).toISOString(),process_id:99129999,
  form_population_evidence_sha256:{
   consent_nonce:sha('R129_TEST_ONLY_FORM_NONCE'),
   offer_revision_sha256:sha('R129_TEST_ONLY_FORM_REVISION')
  },
  config:{
   schema:'bf2026.r128.getcourse-order-callback-config.v1',
   account_host:'study.shkola-dnv.com',owner_approved:true,
   order_fields:{
    consent_nonce:{scope:'order',title:'BF2026 Consent Nonce',field_id:99129101,type:'string',
     native_readback_verified:true,form_population_verified:true,
     readback_evidence_sha256:sha('R129_TEST_ONLY_NATIVE_NONCE')},
    offer_revision_sha256:{scope:'order',title:'BF2026 Offer Revision SHA256',field_id:99129102,type:'string',
     native_readback_verified:true,form_population_verified:true,
     readback_evidence_sha256:sha('R129_TEST_ONLY_NATIVE_REVISION')}
   },
   callback_process:{
    process_object:'orders',operation:'Вызвать URL',method:'POST',url:CALLBACK_URL,
    content_type:'application/json',authorization_header_configured:true,
    authorization_secret_file_only:true,provider_signature_supported:false,
    created_at_iso8601_timezone_verified:true,error_branch_configured:true,
    readback_evidence_sha256:sha('R129_TEST_ONLY_NATIVE_PROCESS'),
    body_variables:{...VARIABLE_SPECS}
   }
  }
 };
 const pair=crypto.generateKeyPairSync('ed25519');
 const signed=signFixture(envelope,pair.privateKey);
 const owner=verifyOwnerSignedEnvelope(signed,{publicKey:pair.publicKey,now});
 // Use a single transaction-scoped connection: no synthetic IDs persist.
 const client=await pool.connect();
 await client.query('BEGIN');
 let inTransaction=true,server=null;
 const createdNonces=[];
 t.after(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));
  if(createdNonces.length){
   const hashes=createdNonces.map(sha);
   await pool.query(
    'DELETE FROM bf2026_r127_consent_challenges WHERE nonce_sha256=ANY($1::char(64)[])',
    [hashes]);
  }
  if(inTransaction)await client.query('ROLLBACK');
  client.release();await pool.end();
 });
 const registry=createFieldRegistry({
  pool:{query:(q,p)=>client.query(q,p)},owner
 });
 const before=await registry.ready();
 assert.equal(before.ready,false);
 assert.match(before.code,/MISMATCH/);
 for(const [role,row] of Object.entries(owner.config.order_fields)){
  await client.query(
   "UPDATE bf2026_r129_order_fields SET state='OWNER_ATTESTED_QA_ONLY',"+
   "field_id=$2,native_readback_sha256=$3,native_form_population_sha256=$4,"+
   "owner_signed_payload_sha256=$5,native_verified_at=now(),updated_at=now() "+
   "WHERE field_role=$1 AND account_host='study.shkola-dnv.com'",
   [role,row.field_id,row.readback_evidence_sha256,
    owner.form_population_evidence_sha256[role],owner.signed_payload_sha256]);
 }
 await client.query(
  "UPDATE bf2026_r129_order_process SET state='OWNER_ATTESTED_QA_ONLY',"+
  "process_id=$1,native_process_readback_sha256=$2,"+
  "owner_signed_payload_sha256=$3,native_verified_at=now(),updated_at=now() "+
  "WHERE account_host='study.shkola-dnv.com'",
  [owner.process_id,owner.config.callback_process.readback_evidence_sha256,
   owner.signed_payload_sha256]);
 assert.equal((await registry.ready()).ready,true);
 // Negative: mismatched Process ID or a field ID cannot pass even with a
 // valid owner signature; restore within this uncommitted test transaction.
 await client.query(
  "UPDATE bf2026_r129_order_process SET process_id=99129998 WHERE account_host='study.shkola-dnv.com'");
 assert.equal((await registry.ready()).ready,false);
 await client.query(
  "UPDATE bf2026_r129_order_process SET process_id=$1 WHERE account_host='study.shkola-dnv.com'",
  [owner.process_id]);
 await client.query(
  "UPDATE bf2026_r129_order_fields SET field_id=99129103 WHERE field_role='consent_nonce'");
 assert.equal((await registry.ready()).ready,false);
 await client.query(
  "UPDATE bf2026_r129_order_fields SET field_id=$1 WHERE field_role='consent_nonce'",
  [owner.config.order_fields.consent_nonce.field_id]);
 assert.equal((await registry.ready()).ready,true);

 const site=require(STAGE+'/server.js');
 const stage=require('./r124-stage-training-overlay.cjs').stageMetadata({
  catalog:site.catalog,registry:site.registry});
 const {EXPECTED}=require('./r123-single-widget-adapter.cjs');
 const {createConsentBoundary}=require('./r127-consent-boundary.cjs');
 const {createConsentHttp,CALLBACK}=require('./r127-consent-http.cjs');
 const {createConsentBridge}=require('./r128-consent-bridge-http.cjs');
 const {createFieldGate}=require('./r129-order-field-gate-http.cjs');
 const revisions={};
 for(const [k,v] of Object.entries(EXPECTED)){
  revisions[k]={offer_id:v.offer_id,revision_sha256:sha('R129_TEST_REVISION_'+k),
   native_readback_verified:true};
 }
 const bearer='R129_TEST_ONLY_NOT_GETCOURSE_'+crypto.randomBytes(32).toString('hex');
 const boundary=createConsentBoundary({pool,stage,callbackSecret:bearer,
  revisionManifest:{schema:'bf2026.r127.offer-revisions.v1',source:'TEST_FIXTURE_ONLY',
   approved:true,offers:revisions},allowTestRevisionFixture:true,
  nativeConsentVerifier:null});
 const consentBridge=createConsentBridge({boundary,quoteFn:site.compute,
  checkoutKey:site.checkoutKey,stage,allowedOrigin:'https://wf.tati-lar.ru',
  orderCallbackReady:true});
 const providerHttp=createConsentHttp({boundary,qaAuthorized:()=>false});
 const gated=createFieldGate({registry,consentBridge,providerHttp,
  qaAuthorized:()=>false,consentBoundary:boundary});
 server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname.startsWith('/api/checkout/consent/')||pathname===CALLBACK)
   return gated(req,res,pathname);
  res.writeHead(404);res.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 async function request(path,body,{origin='https://wf.tati-lar.ru',cookie,bearerAuth}={}){
  const headers={};if(origin)headers.origin=origin;
  if(body!==undefined)headers['content-type']='application/json';
  if(cookie)headers.cookie=cookie;
  if(bearerAuth)headers.authorization='Bearer '+bearerAuth;
  const r=await fetch(base+path,{method:'POST',headers,
   body:body===undefined?undefined:JSON.stringify(body),redirect:'error'});
  return {status:r.status,json:await r.json(),headers:r.headers};
 }
 const s=await request('/api/checkout/consent/session');
 assert.equal(s.status,201);
 const cookie=s.headers.get('set-cookie').split(';')[0];
 const journeys=[{kind:'single',lot:1},{kind:'single',lot:9,variant:'2'}];
 for(const [i,selection] of journeys.entries()){
  const c=await request('/api/checkout/consent/challenge',selection,{cookie});
  assert.equal(c.status,201,JSON.stringify(c.json));
  const {nonce,offer_revision_sha256,issued_at,route_key,offer_id}=c.json;
  createdNonces.push(nonce);
  assert.equal(offer_id,EXPECTED[route_key].offer_id);
  assert.equal(c.json.public_release_allowed,false);
  const deal=String(991299100000+i);
  const payload={deal_id:deal,deal_number:deal,user_id:'990000001',
   offers:String(offer_id),cost_money_value:String(EXPECTED[route_key].price),
   status:'new',created_at:issued_at,
   consent_nonce:nonce,offer_revision_sha256};
  const denied=await request(CALLBACK,payload,{origin:null,bearerAuth:'not-the-test-secret'});
  assert.equal(denied.status,401);
  const wrong=await request(CALLBACK,{...payload,offers:'1'},
   {origin:null,bearerAuth:bearer});
  assert.equal(wrong.status,409,'wrong Offer must be rejected before PG state change');
  const injected=await request(CALLBACK,{...payload,
   consent_checked:true,formParams:{userCustomFields:{22204810:'1'}}},
   {origin:null,bearerAuth:bearer});
  assert.equal(injected.status,422);
  const ok=await request(CALLBACK,payload,{origin:null,bearerAuth:bearer});
  assert.equal(ok.status,202,JSON.stringify(ok.json));
  assert.equal(ok.json.state,'ORDER_CALLBACK_MATCHED_HOLD');
  assert.equal(ok.json.provider_consent_verified,false);
  assert.equal(ok.json.public_release_allowed,false);
  const same=await request(CALLBACK,payload,{origin:null,bearerAuth:bearer});
  assert.equal(same.status,200);assert.equal(same.json.duplicate,true);
  const changed=await request(CALLBACK,{...payload,deal_number:deal+'1'},
   {origin:null,bearerAuth:bearer});
  assert.equal(changed.status,409);
 }
 const tampered=await request('/api/checkout/consent/challenge',
  {kind:'single',lot:1,offer_id:8934973,consent_checked:true},{cookie});
 assert.equal(tampered.status,422);
 // A changed PG mapping closes BOTH challenge AND provider callback again.
 await client.query(
  "UPDATE bf2026_r129_order_fields SET field_id=99129103 WHERE field_role='consent_nonce'");
 const blocked=await request('/api/checkout/consent/challenge',{kind:'single',lot:1},{cookie});
 assert.equal(blocked.status,503);
 assert.equal(blocked.json.code,'R129_ORDER_LEVEL_NATIVE_FIELDS_NOT_ATTESTED');
 const fakeCallback=await request(CALLBACK,{deal_id:'111'},{origin:null,bearerAuth:bearer});
 assert.equal(fakeCallback.status,503);
 await client.query('ROLLBACK');inTransaction=false;
 const afterward=await pool.query(
  'SELECT field_role,field_id,state FROM bf2026_r129_order_fields ORDER BY field_role');
 assert.equal(afterward.rows.every(r=>r.field_id===null&&r.state==='UNVERIFIED'),true);
 const noOwner=createFieldRegistry({pool,owner:null});
 assert.equal((await noOwner.ready()).ready,false);
});
