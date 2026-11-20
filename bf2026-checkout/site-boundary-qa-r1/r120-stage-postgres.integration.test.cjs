'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&!!process.env.BF2026_STAGE_PG_POOL_MODULE;
test('R120 real PostgreSQL + HTTP integration (explicit isolated stage only)',{skip:!enabled},async t=>{
 const d=__dirname;
 const poolModule=require(process.env.BF2026_STAGE_PG_POOL_MODULE);
 const pool=poolModule.pool;
 assert.ok(pool&&typeof pool.query==='function'&&typeof pool.connect==='function');
 assert.equal(pool.options?.host,'127.0.0.1');
 assert.equal(Number(pool.options?.port),55439);
 assert.equal(pool.options?.database,'bfstage');
 await pool.query(fs.readFileSync(path.join(d,'r120-import-ledger.sql'),'utf8'));
 const db=await pool.query("SELECT current_database() db,inet_server_port() port,to_regclass('public.bf2026_native_event_inbox') relay_table,to_regclass('public.bf2026_getcourse_import_ledger') import_table");
 assert.equal(db.rows[0].db,'bfstage');
 assert.equal(Number(db.rows[0].port),5432);
 assert.equal(db.rows[0].relay_table,'bf2026_native_event_inbox');
 assert.equal(db.rows[0].import_table,'bf2026_getcourse_import_ledger');
 const {createRelayHttpHandler}=require('./r115-relay-http.cjs');
 const {createPostgresEventInbox,hmac,SCHEMA}=require('./provider-relay-webhook.cjs');
 const {createImportLedger,createImportIntent,verifyImportApiResponse,API_URL}=require('./r120-import-state-machine.cjs');
 const httpSecret=crypto.randomBytes(32);
 const relayStore=createPostgresEventInbox(pool);
 const handler=createRelayHttpHandler({secret:httpSecret,store:relayStore});
 const server=http.createServer((req,res)=>{
  if(req.url==='/api/checkout/_relay/payment-hint')return handler(req,res);
  res.writeHead(404).end();
 });
 let base,keys=[],eventIds=[];
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{base='http://127.0.0.1:'+server.address().port+'/api/checkout/_relay/payment-hint';resolve()})});
 t.after(async()=>{
  if(keys.length)await pool.query("DELETE FROM bf2026_getcourse_import_ledger WHERE checkout_idempotency_key=ANY($1::varchar[])",[keys]);
  if(eventIds.length)await pool.query("DELETE FROM bf2026_native_event_inbox WHERE event_id=ANY($1::text[])",[eventIds]);
  await new Promise(resolve=>server.close(resolve));
  await pool.end();
 });
 await t.test('real HTTP relay delivery, replay, forged signature, conflict and PII guard',async()=>{
  const stamp=String(Math.floor(Date.now()/1000)),id='r120_it_'+crypto.randomBytes(8).toString('hex'),order='stage_order_'+crypto.randomBytes(8).toString('hex');
  eventIds.push(id,id+'_bad',id+'_pii',id+'_source');
  const event={schema:SCHEMA,event_id:id,provider_order_id:order,status_hint:'PAID',occurred_at:new Date().toISOString()};
  const sign=raw=>hmac(httpSecret,stamp,raw);
  async function post(value,sig){const raw=Buffer.from(JSON.stringify(value));const r=await fetch(base,{method:'POST',headers:{'content-type':'application/json','x-bf2026-relay-timestamp':stamp,'x-bf2026-relay-signature':sig||sign(raw)},body:raw});return {status:r.status,body:await r.json()}}
  const first=await post(event),replay=await post(event),bad=await post({...event,event_id:id+'_bad'},'0'.repeat(64));
  const conflict=await post({...event,status_hint:'REFUND'});
  const pii=await post({...event,event_id:id+'_pii',email:'qa@example.invalid'});
  const spoof=await post({...event,event_id:id+'_source',source:'GetCourse'});
  assert.equal(first.status,202);assert.equal(first.body.status,'ACCEPTED_PENDING_READBACK');
  assert.equal(first.body.payment_verified,false);assert.equal(first.body.grant_writes,0);
  assert.equal(replay.status,202);assert.equal(replay.body.status,'DUPLICATE_PENDING_READBACK');
  assert.equal(bad.status,401);assert.equal(bad.body.code,'RELAY_SIGNATURE_INVALID');
  assert.equal(conflict.status,422);assert.equal(conflict.body.code,'RELAY_EVENT_ID_REPLAY_CONFLICT');
  assert.equal(pii.status,422);assert.equal(pii.body.code,'RELAY_HINT_FIELDS_INVALID');
  assert.equal(spoof.status,422);assert.equal(spoof.body.code,'RELAY_HINT_FIELDS_INVALID');
  const row=await pool.query("SELECT source,provider_order_id,state FROM bf2026_native_event_inbox WHERE event_id=$1",[id]);
  assert.equal(row.rowCount,1);assert.equal(row.rows[0].source,'BF2026_TRUSTED_RELAY');
  assert.equal(row.rows[0].provider_order_id,order);assert.equal(row.rows[0].state,'PENDING_PROVIDER_READBACK');
 });
 await t.test('actual site staging server has R115 route mounted and rejects unauthenticated request',async()=>{
  const r=await fetch('http://127.0.0.1:18765/api/checkout/_relay/payment-hint',{method:'POST',
   headers:{'content-type':'application/json'},body:'{}'});
  assert.equal(r.status,401);
  const body=await r.json();assert.equal(body.payment_verified,false);assert.equal(body.grant_writes,0);
 });
 await t.test('real PostgreSQL import idempotency ledger blocks retry after ambiguous provider result',async()=>{
  const {randomBytes}=crypto;
  const identitySecret=randomBytes(32),selection={kind:'set',items:['rejection_program','union']};
  const intent=createImportIntent({selection,email:'qa@example.invalid',checkoutIdempotencyKey:randomBytes(16).toString('hex'),identitySecret});
  keys.push(intent.checkout_idempotency_key);
  const owner=randomBytes(16).toString('hex'),ledger=createImportLedger(pool);
  assert.equal((await ledger.reserve({intent,ownerToken:owner})).status,'NEW');
  assert.equal((await ledger.reserve({intent,ownerToken:randomBytes(16).toString('hex')})).status,'IN_PROGRESS');
  await ledger.beginStep({intent,ownerToken:owner,step:0});
  await ledger.markOutcomeUnknown({intent,ownerToken:owner,step:0,errorCode:'STAGE_TEST_TIMEOUT_NO_NETWORK'});
  assert.equal((await ledger.reserve({intent,ownerToken:owner})).status,'OUTCOME_UNKNOWN');
  await assert.rejects(()=>ledger.beginStep({intent,ownerToken:owner,step:0}),{code:'IMPORT_STEP_NOT_RESERVED'});
 });
 await t.test('sequential provider identity fixture commits one order once, never payment',async()=>{
  const {randomBytes}=crypto,identitySecret=randomBytes(32),selection={kind:'set',items:['rejection_program','union']};
  const intent=createImportIntent({selection,email:'qa@example.invalid',checkoutIdempotencyKey:randomBytes(16).toString('hex'),identitySecret});
  keys.push(intent.checkout_idempotency_key);
  const owner=randomBytes(16).toString('hex'),ledger=createImportLedger(pool);
  await ledger.reserve({intent,ownerToken:owner});await ledger.beginStep({intent,ownerToken:owner,step:0});
  const data=(last=false)=>({success:'true',action:'add',result:{success:'true',error:false,
   deal_id:'99000001',deal_number:'99000002',user_id:'99000003',
   ...(last?{payment_link:'https://study.shkola-dnv.com/pl/sales/payment/99000002'}:{})}});
  const first=verifyImportApiResponse({body:data(),responseUrl:API_URL,tlsVerified:true,redirected:false,step:0});
  assert.equal(first.provider_response_signature,'NOT_DOCUMENTED_BY_GETCOURSE');
  await ledger.commitStep({intent,ownerToken:owner,step:0,verifiedResponse:first});
  await ledger.beginStep({intent,ownerToken:owner,step:1});
  const second=verifyImportApiResponse({body:data(true),responseUrl:API_URL,tlsVerified:true,redirected:false,step:1,previous:first});
  assert.equal((await ledger.commitStep({intent,ownerToken:owner,step:1,verifiedResponse:second})).status,'ORDER_CREATED');
  assert.equal((await ledger.commitStep({intent,ownerToken:owner,step:1,verifiedResponse:second})).status,'REPLAY');
  assert.equal((await ledger.reserve({intent,ownerToken:owner})).status,'COMMITTED');
  const row=await ledger.get(intent.checkout_idempotency_key);
  assert.equal(row.state,'ORDER_CREATED');assert.equal(row.provider_deal_number,'99000002');
  assert.equal(row.payment_link_sha256.length,64);
  assert.equal(row.payment_verified,undefined);
 });
});
