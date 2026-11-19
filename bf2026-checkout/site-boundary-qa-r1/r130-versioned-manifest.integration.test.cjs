'use strict';
/* R130 real PostgreSQL16 + loopback HTTP integration.
 * Only ephemeral TEST_SCOPE keys and signed fixture data. No GetCourse
 * transport, real provider signature, order/payment/receipt/grant or release.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const http=require('node:http');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const STAGE='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&
 process.env.BF2026_R130_TEST_FIXTURE==='1'&&
 process.env.BF2026_STAGE_PG_POOL_MODULE===STAGE+'/stage-pool-module.cjs';
test('R130 PG16+HTTP: 12-entry manifest version chain, nonce linkage, stale/duplicate callback and restart readback',
 {skip:!enabled},async t=>{
 const {pool}=require(STAGE+'/stage-pool-module.cjs');
 const sql=fs.readFileSync(require('node:path').join(__dirname,'r130-versioned-manifest.sql'),'utf8');
 await pool.query(sql);
 const site=require(STAGE+'/server.js');
 const stage=require('./r124-stage-training-overlay.cjs').stageMetadata({
  catalog:site.catalog,registry:site.registry
 });
 const {EXPECTED}=require('./r123-single-widget-adapter.cjs');
 const {createConsentBoundary}=require('./r127-consent-boundary.cjs');
 const {signRevisionManifest,verifySignedRevisionManifest,
  SCHEMA:R127_SCHEMA,ISSUER:R127_ISSUER}=require('./r127-signed-revision-manifest.cjs');
 const {createConsentHttp,CALLBACK}=require('./r127-consent-http.cjs');
 const {createConsentBridge}=require('./r128-consent-bridge-http.cjs');
 const {createFieldGate}=require('./r129-order-field-gate-http.cjs');
 const {createVersionedManifestRegistry,createManifestBoundBoundary,
  createManifestGate,TEST_SCOPE,signFixture,ENTRY_KEYS,ROUTE_SET,NATIVE_MAP_SHA256
 }=require('./r130-versioned-manifest.cjs');
 const nowRef={value:Date.now()},clock=()=>nowRef.value;
 const pair=crypto.generateKeyPairSync('ed25519');
 const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
 const readbackAt=new Date(nowRef.value-2000).toISOString();
 const r127Offers={};
 for(const key of ROUTE_SET){
  const e=EXPECTED[key];
  r127Offers[key]={offer_id:e.offer_id,
   revision_sha256:sha('R130_PG_HTTP_TEST_REVISION:'+key),
   native_readback_verified:true,readback_at:readbackAt,
   readback_evidence_sha256:sha('R130_PG_HTTP_TEST_READBACK:'+key)};
 }
 const r127Payload={schema:R127_SCHEMA,source:R127_ISSUER,
  issued_at:new Date(nowRef.value-1000).toISOString(),
  expires_at:new Date(nowRef.value+86400000).toISOString(),offers:r127Offers};
 const r127Envelope=signRevisionManifest(r127Payload,pair.privateKey);
 const routeManifest=verifySignedRevisionManifest(r127Envelope,{
  publicKey:pair.publicKey,now:nowRef.value
 });
 function manifest(version,previous){
  const entries={};
  const {ENTRIES}=require('./r128-native-cta-map.cjs');
  for(const key of ENTRY_KEYS){
   const e=ENTRIES[key],r=r127Offers[key];
   entries[key]={
    site_entry_key:key,route_key:e.route_key??null,site_lot:e.site_lot??null,
    variant:e.variant??null,widget_id:e.widget_id,offer_id:e.offer_id,
    amount_rub:e.amount_rub,
    product_training_pairs:e.product_training_pairs.map(p=>({
     product_id:p.product_id,training_id:p.training_id??null
    })),
    fulfillment:e.fulfillment??null,customer_title:e.customer_title??null,
    route_status:e.route_status,
    revision_sha256:r?.revision_sha256||sha('R130_PG_HTTP_TEST_REVISION:'+key),
    native_readback_verified:true,readback_at:readbackAt,
    readback_evidence_sha256:r?.readback_evidence_sha256||sha('R130_PG_HTTP_TEST_READBACK:'+key)
   };
  }
  return signFixture({
   schema:'bf2026.r130.versioned-site-offer-manifest.v1',
   source:'BF2026_OWNER_APPROVED_NATIVE_SITE_OFFER_READBACK',
   registry_scope:TEST_SCOPE,version,previous_manifest_sha256:previous,
   native_map_sha256:NATIVE_MAP_SHA256,route_keys:ROUTE_SET,
   issued_at:new Date(nowRef.value+version).toISOString(),
   expires_at:new Date(nowRef.value+86400000+version).toISOString(),entries
  },pair.privateKey);
 }
 const registry=createVersionedManifestRegistry({
  pool,publicKey:pair.publicKey,routeRevisionManifest:routeManifest,
  scope:TEST_SCOPE,allowTestScope:true,clock
 });
 const before=await pool.query(
  'SELECT count(*)::int n FROM bf2026_r127_consent_challenges WHERE r130_registry_scope=$1',
  [TEST_SCOPE]);
 assert.equal(before.rows[0].n,0);
 let v1=manifest(1,null),v1Result=await registry.register(v1);
 assert.equal(v1Result.changed,true);
 const first=await registry.current();
 assert.equal(first.version,1);
 assert.equal(first.site_entry_count,12);
 assert.equal(first.individual_route_count,10);
 assert.equal(first.qa_only_entry_count,2);
 const duplicate=await registry.register(v1);
 assert.equal(duplicate.duplicate,true);
 assert.equal(duplicate.changed,false);
 const alteredSameVersionPayload=structuredClone(v1.payload);
 alteredSameVersionPayload.issued_at=new Date(nowRef.value+20).toISOString();
 const changedSameVersion=signFixture(alteredSameVersionPayload,pair.privateKey);
 await assert.rejects(registry.register(changedSameVersion),/R130_MANIFEST_ROLLBACK_OR_REPLAY/);
 const wrongChain=manifest(2,'f'.repeat(64));
 await assert.rejects(registry.register(wrongChain),/R130_MANIFEST_HASH_CHAIN_MISMATCH/);

 const secret='R130_TEST_ONLY_NOT_GETCOURSE_'+crypto.randomBytes(32).toString('hex');
 const boundary=createConsentBoundary({
  pool,stage,revisionManifest:routeManifest,callbackSecret:secret,
  nativeConsentVerifier:null,callbackGuard:registry.assertCallback,clock
 });
 const bound=createManifestBoundBoundary({boundary,registry});
 const bridge=createConsentBridge({boundary:bound,quoteFn:site.compute,
  checkoutKey:site.checkoutKey,stage,allowedOrigin:'https://wf.tati-lar.ru',
  orderCallbackReady:true,clock});
 const providerHttp=createConsentHttp({boundary:bound,qaAuthorized:()=>true});
 const fieldRegistry={
  ready:async()=>({ready:true,code:'TEST_ONLY_R129_ORDER_FIELDS'}),
  status:async()=>({postgres_ready:true,order_field_ids_verified:true,
   public_release_allowed:false})
 };
 const fieldGate=createFieldGate({
  registry:fieldRegistry,consentBridge:bridge,providerHttp,
  consentBoundary:bound,qaAuthorized:()=>true
 });
 const gate=createManifestGate({registry,fieldGate,qaConsentHttp:providerHttp,
  qaAuthorized:()=>true});
 server=http.createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api/checkout/consent/')||
   path===CALLBACK||path.startsWith('/api/checkout/_qa/consent-boundary/')||
   path.startsWith('/api/checkout/_qa/manifest/'))return gate(req,res,path);
  res.writeHead(404);res.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const nonces=[];
 let server=null;
 t.after(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));
  if(nonces.length){
   const hashes=nonces.map(n=>sha(n));
   await pool.query('DELETE FROM bf2026_r127_consent_challenges WHERE nonce_sha256=ANY($1::char(64)[])',[hashes]);
  }
  await pool.query('DELETE FROM bf2026_r130_manifest_head WHERE registry_scope=$1',[TEST_SCOPE]);
  await pool.query('DELETE FROM bf2026_r130_manifest_history WHERE registry_scope=$1',[TEST_SCOPE]);
  const residue=await pool.query(
   'SELECT count(*)::int n FROM bf2026_r127_consent_challenges WHERE r130_registry_scope=$1',[TEST_SCOPE]);
  assert.equal(residue.rows[0].n,0);
  await pool.end();
 });
 async function post(path,body,{cookie,origin='https://wf.tati-lar.ru',authorization}={}){
  const headers={};if(origin)headers.origin=origin;
  if(body!==undefined)headers['content-type']='application/json';
  if(cookie)headers.cookie=cookie;
  if(authorization)headers.authorization=authorization;
  const r=await fetch(base+path,{method:'POST',headers,
   body:body===undefined?undefined:JSON.stringify(body),redirect:'error'});
  return {status:r.status,headers:r.headers,data:await r.json()};
 }
 const session=await post('/api/checkout/consent/session');
 assert.equal(session.status,201,JSON.stringify(session.data));
 const cookie=session.headers.get('set-cookie').split(';')[0];
 async function challenge(){
  const r=await post('/api/checkout/consent/challenge',{kind:'single',lot:1},{cookie});
  assert.equal(r.status,201,JSON.stringify(r.data));
  nonces.push(r.data.nonce);return r.data;
 }
 function callbackFor(c,id){
  return {deal_id:String(id),deal_number:String(id),user_id:'990000001',
   offers:'8934973',cost_money_value:'3333',status:'new',
   created_at:c.issued_at,consent_nonce:c.nonce,
   offer_revision_sha256:c.offer_revision_sha256};
 }
 const firstChallenge=await challenge();
 assert.equal(firstChallenge.manifest_version,1);
 assert.equal(firstChallenge.manifest_sha256,first.manifest_sha256);
 const linkage=await pool.query(
  'SELECT route_key,offer_id,widget_id,amount_rub,offer_revision_sha256,'+
  'r130_registry_scope,r130_manifest_version,r130_manifest_sha256,r130_site_entry_key '+
  'FROM bf2026_r127_consent_challenges WHERE nonce_sha256=$1',[sha(firstChallenge.nonce)]);
 assert.equal(linkage.rows.length,1);
 assert.equal(linkage.rows[0].r130_registry_scope,TEST_SCOPE);
 assert.equal(Number(linkage.rows[0].r130_manifest_version),1);
 assert.equal(String(linkage.rows[0].r130_manifest_sha256).trim(),first.manifest_sha256);
 assert.equal(linkage.rows[0].r130_site_entry_key,'single:rejection');

 const wrongRevision=await post(CALLBACK,{
  ...callbackFor(firstChallenge,99130101),offer_revision_sha256:'f'.repeat(64)
 },{origin:null,authorization:'Bearer '+secret});
 assert.equal(wrongRevision.status,409);
 const missingConsent={...callbackFor(firstChallenge,99130101)};
 delete missingConsent.consent_nonce;delete missingConsent.offer_revision_sha256;
 const missing=await post(CALLBACK,missingConsent,{origin:null,authorization:'Bearer '+secret});
 assert.equal(missing.status,422);
 const accepted=await post(CALLBACK,callbackFor(firstChallenge,99130101),{
  origin:null,authorization:'Bearer '+secret
 });
 assert.equal(accepted.status,202,JSON.stringify(accepted.data));
 assert.equal(accepted.data.state,'ORDER_CALLBACK_MATCHED_HOLD');
 assert.equal(accepted.data.provider_consent_verified,false);
 assert.equal(accepted.data.public_release_allowed,false);
 const replay=await post(CALLBACK,callbackFor(firstChallenge,99130101),{
  origin:null,authorization:'Bearer '+secret
 });
 assert.equal(replay.status,200);assert.equal(replay.data.duplicate,true);
 const changedReplay=await post(CALLBACK,{
  ...callbackFor(firstChallenge,99130101),deal_number:'99130102'
 },{origin:null,authorization:'Bearer '+secret});
 assert.equal(changedReplay.status,409);

 const staleTimeChallenge=await challenge();
 nowRef.value+=16*60*1000;
 const staleTime=await post(CALLBACK,callbackFor(staleTimeChallenge,99130103),{
  origin:null,authorization:'Bearer '+secret
 });
 assert.equal(staleTime.status,409);

 const rollbackChallenge=await challenge();
 const oldHead=await registry.current();
 const v2=manifest(2,oldHead.manifest_sha256);
 const activated=await registry.register(v2);
 assert.equal(activated.changed,true);
 assert.equal(activated.version,2);
 const staleManifest=await post(CALLBACK,callbackFor(rollbackChallenge,99130104),{
  origin:null,authorization:'Bearer '+secret
 });
 assert.equal(staleManifest.status,409);
 assert.equal(staleManifest.data.code,'R127_VERSIONED_MANIFEST_CHALLENGE_STALE');

 const newChallenge=await challenge();
 assert.equal(newChallenge.manifest_version,2);
 const acceptedV2=await post(CALLBACK,callbackFor(newChallenge,99130105),{
  origin:null,authorization:'Bearer '+secret
 });
 assert.equal(acceptedV2.status,202);
 assert.equal(acceptedV2.data.state,'ORDER_CALLBACK_MATCHED_HOLD');

 // New process + new PG pool reconstructs the active signed manifest from DB.
 const childCode=[
  "const crypto=require('node:crypto');",
  "const pool=require(process.env.R130_POOL).pool;",
  "const {createVersionedManifestRegistry}=require(process.env.R130_MODULE);",
  "const {verifySignedRevisionManifest}=require(process.env.R127_MODULE);",
  "const key=crypto.createPublicKey(process.env.R130_PUBLIC_KEY);",
  "const route=verifySignedRevisionManifest(JSON.parse(process.env.R127_ENVELOPE),{publicKey:key});",
  "const reg=createVersionedManifestRegistry({pool,publicKey:key,routeRevisionManifest:route,scope:'BF2026_R130_TEST',allowTestScope:true});",
  "reg.current().then(async m=>{console.log(JSON.stringify({version:m?.version,hash:m?.manifest_sha256,entries:m?.site_entry_count}));await pool.end()}).catch(async e=>{console.error(e.code||e.message);await pool.end();process.exitCode=1});"
 ].join('\\n');
 const child=spawnSync(process.execPath,['-e',childCode],{
  encoding:'utf8',timeout:15000,env:{...process.env,
   R130_POOL:STAGE+'/stage-pool-module.cjs',
   R130_MODULE:require.resolve('./r130-versioned-manifest.cjs'),
   R127_MODULE:require.resolve('./r127-signed-revision-manifest.cjs'),
   R130_PUBLIC_KEY:pair.publicKey.export({type:'spki',format:'pem'}),
   R127_ENVELOPE:JSON.stringify(r127Envelope)}
 });
 assert.equal(child.status,0,child.stderr);
 const restored=JSON.parse(child.stdout.trim());
 assert.equal(restored.version,2);
 assert.equal(restored.entries,12);
 assert.equal(restored.hash,(await registry.current()).manifest_sha256);
});
