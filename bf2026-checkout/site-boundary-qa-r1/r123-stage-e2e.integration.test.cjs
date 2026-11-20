'use strict';
/*
 * R123 end-to-end on REAL isolated PostgreSQL16 and real loopback HTTP.
 * All GetCourse API responses are TEST_ONLY fakes. There are ZERO actual
 * GetCourse network requests, orders, payments, receipts or grants here.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {TRUSTED_DIR,createFileSecretProvider}=require('./r123-secret-provider.cjs');
const {createPostgresBudget,createGetCourseExportReader}=require('./getcourse-export-readback.cjs');
const {createReadbackOnce}=require('./r123-readback-once.cjs');
const {createQARouter}=require('./r121-bundle-qa-http.cjs');
const {createHttpHandler:callbackHandler,PATH:CALLBACK_PATH}=require('./getcourse-callback-hint-http.cjs');
const {createStore:callbackStore}=require('./getcourse-callback-hint.cjs');
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&Boolean(process.env.BF2026_STAGE_PG_POOL_MODULE);
const UUID=()=>crypto.randomBytes(16).toString('hex');
function reply(json){return {ok:true,status:200,async text(){return JSON.stringify(json)}}}
const productPairs=()=>[
 {product_id:4557988,training_id:936022301},
 {product_id:4550895,training_id:933861292}
];
test('R123 full isolated PostgreSQL+HTTP, secret provider, idempotency and callback identity; TEST_ONLY', {skip:!enabled},async t=>{
 const pool=require(process.env.BF2026_STAGE_PG_POOL_MODULE).pool;
 assert.equal(pool.options.host,'127.0.0.1');
 assert.equal(Number(pool.options.port),55439);
 assert.equal(pool.options.database,'bfstage');
 const env=process.env;
 assert.equal(env.BF2026_GETCOURSE_API_KEY,undefined,'never use plain env key in stage test');
 const migrations=['r123-readback-once.sql','getcourse-export-budget.sql','getcourse-callback-hints.sql'];
 for(const name of migrations)await pool.query(fs.readFileSync(path.join(__dirname,name),'utf8'));
 const initial=await pool.query("SELECT request_count,outstanding_export_id FROM bf2026_getcourse_export_budget WHERE account_host='study.shkola-dnv.com'");
 assert.equal(initial.rowCount,1);
 assert.equal(Number(initial.rows[0].request_count),0,'do not consume an unrelated export quota');
 assert.equal(initial.rows[0].outstanding_export_id,null,'do not take over another export');
 fs.mkdirSync(TRUSTED_DIR,{recursive:true,mode:0o700});
 const key='STAGING_FIXTURE_ONLY_'+UUID();
 const filePath=path.join(TRUSTED_DIR,'r123-test-'+UUID()+'.json');
 fs.writeFileSync(filePath,JSON.stringify({account_host:'study.shkola-dnv.com',
  api_account_name:'qa_test_account',key}),{mode:0o600,flag:'wx'});
 const secret=createFileSecretProvider({filePath});
 const ready=await secret.assertReady();
 assert.deepEqual(ready,{credential_configured:true,account_host:'study.shkola-dnv.com',api_account_name_bound:true});
 const qaKey=UUID()+UUID();
 const callbackSecret=crypto.randomBytes(32);
 const mode={type:'unpaid',getCalls:0,exportCounter:0,usedUrls:[]};
 const fakeFetch=async(u,opts)=>{
  const url=new URL(u);mode.getCalls++;mode.usedUrls.push(url.pathname);
  assert.equal(url.protocol,'https:');assert.equal(url.hostname,'study.shkola-dnv.com');
  assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');
  assert.equal(url.searchParams.get('key'),key,'only test fixture key in private mock');
  if(mode.type==='timeout')throw Object.assign(Error('TEST_ONLY_TIMEOUT'),{name:'TimeoutError'});
  if(url.pathname.endsWith('/deals'))return reply({success:true,result:{export_id:'d'+(++mode.exportCounter)}});
  if(url.pathname.endsWith('/payments'))return reply({success:true,result:{export_id:'p'+(++mode.exportCounter)}});
  if(/\/exports\/d\d+$/.test(url.pathname)){
   const deal={id:'924624456',deal_number:'71994',user_id:'524210421',
    account_host:'study.shkola-dnv.com',offers:['8935004'],
    products:productPairs(),cost_money_value:11690,status:'new',payed_money:0};
   switch(mode.type){
    case 'paid':deal.status='payed';deal.payed_money=11690;deal.payed_at='2026-11-19T04:32:00Z';break;
    case 'no_products':delete deal.products;break;
    case 'bad_product':deal.products[1].training_id=933861293;break;
    case 'bad_offer':deal.offers=['8933492'];break;
    case 'bad_amount':deal.cost_money_value=12990;break;
    case 'wrong_deal':deal.id='924624457';break;
    case 'wrong_user':deal.user_id='524210422';break;
    case 'missing_user':delete deal.user_id;break;
    case 'wrong_host':deal.account_host='other.example';break;
    case 'missing_host':delete deal.account_host;break;
   }
   return reply({success:true,result:{rows:[deal]}});
  }
  if(/\/exports\/p\d+$/.test(url.pathname))
   return reply({success:true,result:{rows:[{id:'test_payment_1',deal_id:'924624456',
    status:'accepted',amount:11690}]}});
  throw Error('TEST_FETCH_UNEXPECTED_PATH');
 };
 const budget=createPostgresBudget(pool);
 const reader=createGetCourseExportReader({apiKeyProvider:()=>secret.readKey(),budget,
  fetchImpl:fakeFetch,pollDelayMs:0,strictProductIdentity:true});
 const once=createReadbackOnce({pool,reader});
 const qa=createQARouter({qaAuthorized:req=>req.headers['x-bf2026-qa-key']===qaKey,
  pool,exportReader:reader,readbackOnce:once});
 const callback=callbackHandler({secret:callbackSecret,store:callbackStore(pool)});
 const server=http.createServer((req,res)=>{
  const route=new URL(req.url,'http://localhost').pathname;
  if(route===CALLBACK_PATH)return callback(req,res);
  return qa(req,res,route);
 });
 await new Promise((ok,err)=>{server.once('error',err);server.listen(0,'127.0.0.1',ok)});
 const base='http://127.0.0.1:'+server.address().port;
 const keys=[];
 const callbackHashes=[];
 t.after(async()=>{
  await new Promise(ok=>server.close(ok));
  if(keys.length)await pool.query('DELETE FROM bf2026_getcourse_readback_once WHERE request_key=ANY($1::text[])',[keys]);
  if(callbackHashes.length)await pool.query('DELETE FROM bf2026_getcourse_callback_hints WHERE event_id=ANY($1::text[])',[callbackHashes]);
  await pool.query("UPDATE bf2026_getcourse_export_budget SET request_count=0,window_started_at=now(),outstanding_export_id=NULL,outstanding_since=NULL,updated_at=now() WHERE account_host='study.shkola-dnv.com'");
  await pool.end();
  fs.unlinkSync(filePath);
 });
 async function postRead(id,auth=true,data={}){
  const r=await fetch(base+'/api/checkout/_qa/native-bundle-readback/export-readback',{method:'POST',
   headers:{'content-type':'application/json','x-bf2026-idempotency-key':id,
    ...(auth?{'x-bf2026-qa-key':qaKey}:{})},body:JSON.stringify(data)});
  return {status:r.status,body:await r.json()};
 }
 function nextKey(){const x=UUID();keys.push(x);return x}
 await t.test('real HTTP authentication and idempotency required BEFORE any export API call',async()=>{
  const id=nextKey();assert.equal((await postRead(id,false)).status,404);
  const bad=await postRead('bad');assert.equal(bad.status,422);
  const input=await postRead(nextKey(),true,{deal_id:'UNTRUSTED'});
  assert.equal(input.status,422);assert.equal(mode.getCalls,0);
 });
 await t.test('unpaid 11690 bundle: exact account/order/offer/2 products, 2 GETs, durable readback',async()=>{
  const id=nextKey(),result=await postRead(id);
  assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal(result.body.state,'VERIFIED_UNPAID_ORDER');
  assert.equal(result.body.product_identity_verified,true);
  assert.equal(result.body.order_total_rub,11690);assert.equal(result.body.paid_total_rub,0);
  assert.equal(result.body.order_number,'71994');assert.equal(result.body.offer_id,8935004);
  assert.equal(result.body.provider_signature_verified,false);
  assert.equal(result.body.fiscal_receipt_verified,false);
  assert.equal(result.body.actual_grants_verified,false);
  assert.equal(result.body.release_allowed,false);
  assert.equal(mode.getCalls,2);
  assert.equal(JSON.stringify(result.body).includes(key),false);
  assert.equal(JSON.stringify(result.body).includes('user_id'),false);
  const row=await pool.query('SELECT state,result FROM bf2026_getcourse_readback_once WHERE request_key=$1',[id]);
  assert.equal(row.rowCount,1);assert.equal(row.rows[0].state,'DONE');
  const replay=await postRead(id);
  assert.equal(replay.status,200);assert.equal(replay.body.duplicate,true);
  assert.equal(mode.getCalls,2,'duplicate key never repeats provider export calls');
 });
 await t.test('actual concurrent HTTP duplicate key cannot run two provider exports',async()=>{
  const id=nextKey(),start=mode.getCalls;
  const [a,b]=await Promise.all([postRead(id),postRead(id)]);
  assert.equal([a.status,b.status].every(x=>x===200||x===202),true);
  assert.equal(mode.getCalls-start,2);
  const n=await pool.query('SELECT COUNT(*)::int n FROM bf2026_getcourse_readback_once WHERE request_key=$1',[id]);
  assert.equal(n.rows[0].n,1);
 });
 await t.test('missing exported Product→Training evidence is PARTIAL, not structural PASS',async()=>{
  mode.type='no_products';const id=nextKey(),start=mode.getCalls;
  const r=await postRead(id);
  assert.equal(r.status,202);assert.equal(r.body.state,'PARTIAL_PRODUCT_MAPPING_UNAVAILABLE');
  assert.equal(r.body.product_identity_verified,false);
  assert.equal(r.body.release_allowed,false);assert.equal(mode.getCalls-start,2);
 });
 await t.test('paid Deal + accepted Payment fixture still cannot assert receipt/access',async()=>{
  mode.type='paid';const id=nextKey(),start=mode.getCalls;
  const r=await postRead(id);
  assert.equal(r.status,200,JSON.stringify(r.body));
  assert.equal(r.body.state,'PAYMENT_RECORD_MATCHED');
  assert.equal(r.body.payment_record_verified,true);
  assert.equal(r.body.product_identity_verified,true);
  assert.equal(r.body.payment_amount_rub,11690);
  assert.equal(r.body.fiscal_receipt_verified,false);
  assert.equal(r.body.actual_grants_verified,false);
  assert.equal(r.body.release_allowed,false);assert.equal(mode.getCalls-start,4);
  assert.equal((await postRead(id)).body.duplicate,true);
  assert.equal(mode.getCalls-start,4);
 });
 await t.test('mismatched account, order, Offer, Product/Training, price and buyer hold, replay cannot retry',async()=>{
  for(const bad of ['wrong_host','missing_host','wrong_deal','bad_offer','bad_product','bad_amount','wrong_user','missing_user']){
   mode.type=bad;const id=nextKey(),start=mode.getCalls;
   const r=await postRead(id);
   assert.equal(r.status,202,bad+' '+JSON.stringify(r.body));
   assert.equal(r.body.state,'HOLD_READBACK_UNKNOWN',bad);
   assert.equal(r.body.release_allowed,false);
   const again=await postRead(id);
   assert.equal(again.status,202);assert.equal(again.body.state,'HOLD_INFLIGHT_OR_UNKNOWN');
   assert.equal(mode.getCalls-start,2,bad+' must be two GETs exactly, with no retry');
  }
 });
 await t.test('callback shared-secret and exact identity: accept hint, dedupe, reject spoof, no grants',async()=>{
  const event={schema:'bf2026.getcourse.callback.hint.v1',account_host:'study.shkola-dnv.com',
   deal_id:'924624456',deal_number:'71994',offers:['8935004'],status:'payed',
   cost_money_value:11690,payed_money:11690,payed_at:new Date().toISOString(),
   created_at:new Date().toISOString()};
  async function postCallback(payload,token){
   const r=await fetch(base+CALLBACK_PATH,{method:'POST',
    headers:{'content-type':'application/json','x-getcourse-account':'study.shkola-dnv.com',
     authorization:'Bearer '+(token||callbackSecret.toString('hex'))},
    body:JSON.stringify(payload)});
   return {status:r.status,body:await r.json()};
  }
  const a=await postCallback(event);
  assert.equal(a.status,202,JSON.stringify(a.body));assert.equal(a.body.payment_verified,false);
  assert.equal(a.body.provider_signature_verified,false);assert.equal(a.body.grants_verified,false);
  assert.equal(a.body.grant_writes,0);
  // Reverse JSON property order to check stable semantic replay identity.
  const rev=Object.fromEntries(Object.entries(event).reverse());
  const b=await postCallback(rev);
  assert.equal(b.status,202);assert.equal(b.body.duplicate,true);
  const badSecret=await postCallback(event,'00'.repeat(32));assert.equal(badSecret.status,401);
  const badIdentity=await postCallback({...event,offers:['8934207']});assert.equal(badIdentity.status,422);
  const badSum=await postCallback({...event,cost_money_value:12990});assert.equal(badSum.status,422);
  const hintRows=await pool.query("SELECT event_id,provider_signature_verified FROM bf2026_getcourse_callback_hints WHERE provider_order_id='924624456'");
  assert.equal(hintRows.rowCount,1);assert.equal(hintRows.rows[0].provider_signature_verified,false);
  callbackHashes.push(hintRows.rows[0].event_id);
 });
 await t.test('timeout leaves durable UNKNOWN; same key is never automatically reissued',async()=>{
  mode.type='timeout';const id=nextKey(),start=mode.getCalls;
  const r=await postRead(id);
  assert.equal(r.status,202);assert.equal(r.body.state,'HOLD_READBACK_UNKNOWN');
  const again=await postRead(id);
  assert.equal(again.status,202);assert.equal(again.body.state,'HOLD_INFLIGHT_OR_UNKNOWN');
  assert.equal(mode.getCalls-start,1);
 });
 await t.test('live staging table zero payment/receipt/grant rows, no key in DB',async()=>{
  const query=await pool.query("SELECT count(*)::int n FROM bf2026_native_bundle_verification");
  assert.equal(query.rows[0].n,0);
  const lookup=await pool.query('SELECT result FROM bf2026_getcourse_readback_once WHERE request_key=ANY($1::text[])',[keys]);
  for(const row of lookup.rows)assert.equal(JSON.stringify(row).includes(key),false);
  const count=await pool.query('SELECT count(*)::int n FROM bf2026_getcourse_readback_once WHERE request_key=ANY($1::text[])',[keys]);
  assert.equal(count.rows[0].n>0,true);
 });
});
