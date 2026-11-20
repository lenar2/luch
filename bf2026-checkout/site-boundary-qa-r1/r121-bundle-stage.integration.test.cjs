'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {SOURCE}=require('./provider-relay-webhook.cjs');
const {signable,createVerifier}=require('./r121-bundle-verify.cjs');
const {createQARouter}=require('./r121-bundle-qa-http.cjs');
const prior=require('./native-bundle-real-order-evidence.json');
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&Boolean(process.env.BF2026_STAGE_PG_POOL_MODULE);
function paidFixture(){
 const pid='TEST_ONLY_PAID_'+crypto.randomBytes(5).toString('hex');
 return {source:'GETCOURSE_NATIVE_ADMIN_READBACK',captured_at:new Date().toISOString(),
  widget_id:1686790,line_id:'942536770',
  unpaid:{...prior,native_line_id:'942536770'},
  paid:{schema:'bf2026.gc.native-bundle.paid-readback.v1',provider:'GetCourse',
    native_deal_id:'924624456',native_order_number:'71994',offer_id:8935004,
    status:'PAID',currency:'RUB',amount_captured_rub:11690,
    captured_payment_events:[{paid_event_id:pid,amount_rub:11690,status:'CAPTURED'}],
    grants:[
     {product_id:4557988,training_id:936022301,duration_days:365,start:'AFTER_PAY',provider_deal_id:'924624456',paid_event_id:pid},
     {product_id:4550895,training_id:933861292,duration_days:365,start:'AFTER_PAY',provider_deal_id:'924624456',paid_event_id:pid}],
    receipt:{tax_readback:true,receipt_id:'TEST_ONLY_RECEIPT'},
    consent:{offer_terms_accepted:true},duplicate_guard:{negative_test_passed:true}}};
}
test('R121 real isolated PostgreSQL + HTTP, never real provider proof',{skip:!enabled},async t=>{
 const pool=require(process.env.BF2026_STAGE_PG_POOL_MODULE).pool;
 assert.equal(pool.options.host,'127.0.0.1');
 assert.equal(Number(pool.options.port),55439);
 assert.equal(pool.options.database,'bfstage');
 await pool.query(fs.readFileSync(path.join(__dirname,'r121-bundle-ledger.sql'),'utf8'));
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
 const keys={test_only_reviewer:{publicKey,mode:'TEST_ONLY'}};
 const stamp='r121_case_'+crypto.randomBytes(7).toString('hex');
 const digest=crypto.randomBytes(32).toString('hex');
 const ids=[stamp,stamp+'_second',stamp+'_wrong',stamp+'_unpaid'];
 await pool.query("INSERT INTO bf2026_native_event_inbox(source,event_id,provider_order_id,status_hint,occurred_at,raw_sha256) VALUES($1,$2,$3,'PAID',now(),$4)",[SOURCE,stamp,'924624456',digest]);
 function attest(s){const bytes=signable(s);return {domain:'BF2026_R121_INDEPENDENT_NATIVE_READBACK_V1',
  key_id:'test_only_reviewer',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
  signature:crypto.sign(null,bytes,privateKey).toString('base64url')}}
 const snapshot=paidFixture();
 let proof={snapshot,attestation:attest(snapshot)};
 const reader={kind:'AUTHENTICATED_GETCOURSE_NATIVE_READBACK',async readNativeOrder(){return proof}};
 const gate=createVerifier({pool,reader,keys,allowLive:true});
 const qaKey=crypto.randomBytes(16).toString('hex');
 const route=createQARouter({pool,reader,keys,allowLive:true,qaAuthorized:req=>req.headers['x-test-qa']===qaKey});
 const server=http.createServer((req,res)=>route(req,res,new URL(req.url,'http://localhost').pathname));
 await new Promise((ok,err)=>{server.once('error',err);server.listen(0,'127.0.0.1',ok)});
 const url='http://127.0.0.1:'+server.address().port+'/api/checkout/_qa/native-bundle-readback/';
 t.after(async()=>{
  await pool.query('DELETE FROM bf2026_native_bundle_verification WHERE event_id=ANY($1::text[])',[ids]);
  await pool.query('DELETE FROM bf2026_native_event_inbox WHERE event_id=ANY($1::text[])',[ids]);
  await new Promise(ok=>server.close(ok));
  await pool.end();
 });
 async function post(eventId=stamp,key=qaKey){const r=await fetch(url+'reconcile',{method:'POST',
  headers:{'content-type':'application/json','x-test-qa':key},body:JSON.stringify({event_id:eventId})});
  return {code:r.status,body:await r.json()}}
 await t.test('native bundle signed TEST_ONLY shape, real PG write, no payment claim',async()=>{
  const r=await gate(stamp);
  assert.equal(r.status,'TEST_ONLY_SHAPE_PASS');
  assert.equal(r.payment_verified,false);
  assert.equal(r.release_allowed,false);
  assert.equal(r.product_grants_checked,2);
  const rows=await pool.query('SELECT * FROM bf2026_native_bundle_verification WHERE event_id=$1',[stamp]);
  assert.equal(rows.rowCount,1);
  assert.equal(rows.rows[0].state,'TEST_ONLY');
 });
 await t.test('idempotent replay, no duplicate ledger, protected HTTP',async()=>{
  const a=await gate(stamp);assert.equal(a.duplicate,true);
  assert.equal((await post(stamp,'bad')).code,404);
  const b=await post();assert.equal(b.code,200);assert.equal(b.body.duplicate,true);
  assert.equal(b.body.payment_verified,false);
 });
 await t.test('reject wrong 12990, order identity, grants, tax, consent, payment event',async()=>{
  const mutations=[
   s=>{s.paid.amount_captured_rub=12990},
   s=>{s.unpaid.native_deal_id='924624457'},
   s=>{s.unpaid.native_line_id='942536771'},
   s=>{s.paid.grants.pop()},
   s=>{s.paid.receipt.tax_readback=false},
   s=>{s.paid.consent.offer_terms_accepted=false},
   s=>{s.paid.captured_payment_events[0].status='PENDING'},
   s=>{s.paid.grants[1].training_id=0}
  ];
  for(const mutate of mutations){
   const bad=structuredClone(snapshot);mutate(bad);proof={snapshot:bad,attestation:attest(bad)};
   await assert.rejects(gate(stamp));
  }
  proof={snapshot,attestation:attest(snapshot)};
 });
 await t.test('bad signature and unknown timeout fail closed',async()=>{
  proof={snapshot,attestation:{...attest(snapshot),sha256:'0'.repeat(64)}};
  await assert.rejects(gate(stamp),{code:'READBACK_SHA_MISMATCH'});
  reader.readNativeOrder=async()=>{throw Error('TEST_ONLY timeout')};
  assert.equal((await gate(stamp)).status,'HOLD_READBACK_TIMEOUT_OR_UNAVAILABLE');
  reader.readNativeOrder=async()=>proof;
  proof={snapshot,attestation:attest(snapshot)};
 });
 await t.test('a conflicting replay and duplicate paid event cannot create a second verification',async()=>{
  const changed=paidFixture();proof={snapshot:changed,attestation:attest(changed)};
  await assert.rejects(gate(stamp),{code:'EVENT_REPLAY_PAYLOAD_CONFLICT'});
  proof={snapshot,attestation:attest(snapshot)};
  await pool.query("INSERT INTO bf2026_native_event_inbox(source,event_id,provider_order_id,status_hint,occurred_at,raw_sha256) VALUES($1,$2,'924624456','PAID',now(),$3)",[SOURCE,ids[1],crypto.randomBytes(32).toString('hex')]);
  await assert.rejects(gate(ids[1]),{code:'PAID_EVENT_DEDUP_CONFLICT'});
 });
 await t.test('wrong deal event and UNPAID hint never cause paid proof',async()=>{
  await pool.query("INSERT INTO bf2026_native_event_inbox(source,event_id,provider_order_id,status_hint,occurred_at,raw_sha256) VALUES($1,$2,'999999999','PAID',now(),$3)",[SOURCE,ids[2],crypto.randomBytes(32).toString('hex')]);
  await assert.rejects(gate(ids[2]),{code:'EVENT_ORDER_ID_MISMATCH'});
  await pool.query("INSERT INTO bf2026_native_event_inbox(source,event_id,provider_order_id,status_hint,occurred_at,raw_sha256) VALUES($1,$2,'924624456','UNPAID',now(),$3)",[SOURCE,ids[3],crypto.randomBytes(32).toString('hex')]);
  assert.equal((await gate(ids[3])).status,'HOLD_NON_PAYMENT_HINT');
 });
});
