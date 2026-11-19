'use strict';
/* Explicit opt-in isolated PostgreSQL bfstage integration. No GetCourse writes. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createSetOrderWorker}=require('./r130-set-order-worker.cjs');
const {createR154PgAdapter}=require('./r154-lot12-coordinator.cjs');
const {quoteSetR154,buildLot12SetPlan}=require('./r154-lot12-set.cjs');
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&Boolean(process.env.BF2026_STAGE_PG_POOL_MODULE);
test('R154 real isolated PostgreSQL 2/3/5/6/7 persistent one-Deal line ledgers and replay',
 {skip:!enabled},async t=>{
 const pool=require(process.env.BF2026_STAGE_PG_POOL_MODULE).pool;
 assert.equal(pool.options.host,'127.0.0.1');
 assert.equal(Number(pool.options.port),55439);
 assert.equal(pool.options.database,'bfstage');
 await pool.query(fs.readFileSync(path.join(__dirname,'r154-lot12-orders.sql'),'utf8'));
 const adapter=createR154PgAdapter(pool);
 const saved=[];let calls=0;
 t.after(async()=>{
  if(saved.length){
   await pool.query('DELETE FROM bf2026_r154_lot12_order_steps WHERE intent_key=ANY($1::char(64)[])',[saved]);
   await pool.query('DELETE FROM bf2026_r154_lot12_order_intents WHERE intent_key=ANY($1::char(64)[])',[saved]);
  }
 });
 const worker=createSetOrderWorker({pool:adapter,quoteFn:quoteSetR154,
  planBuilder:buildLot12SetPlan,transport:{send:async()=>{calls++;throw Error('NETWORK_FORBIDDEN')}}});
 const selections=[
  {kind:'set',items:['rejection','devaluation']},
  {kind:'set',items:['union','dgs2','knopochka']},
  {kind:'set',items:['rejection_program','dnv','union','dgs2','knopochka']},
  {kind:'set',items:['rejection_program','dnv','union','trainer','dgs2','knopochka']},
  {kind:'set',items:['rejection_program','dnv','union','trainer','source','dgs2','knopochka'],source_variant:'2'}
 ];
 for(const selection of selections){
  const idempotencyKey=crypto.randomBytes(32).toString('hex');
  const nonce=crypto.randomBytes(32).toString('base64url');
  const params={selection,email:'qa-r154@example.org',nonce,
   offerRevisionSha256:'a'.repeat(64),idempotencyKey};
  saved.push(idempotencyKey);
  const one=await worker.prepare(params);
  const two=await worker.prepare(params);
  assert.equal(one.duplicate,false);assert.equal(two.duplicate,true);
  assert.equal(one.plan.plan_sha256,two.plan.plan_sha256);
  const rows=await pool.query(
   'SELECT step_index,offer_id,line_amount_rub,state FROM bf2026_r154_lot12_order_steps WHERE intent_key=$1 ORDER BY step_index',[idempotencyKey]);
  assert.equal(rows.rows.length,selection.items.length);
  assert.deepEqual(rows.rows.map(x=>Number(x.offer_id)),
   one.plan.lines.map(x=>x.offer_id));
  assert.equal(rows.rows.reduce((s,x)=>s+Number(x.line_amount_rub),0),
   one.plan.desired_order_total_rub);
  assert.ok(rows.rows.every(x=>x.state==='PREPARED'));
  const h=await worker.assembleOnce(params);
  assert.equal(h.state,'HOLD_GETCOURSE_IMPORT_DISABLED');
  assert.equal(h.provider_requests_sent,0);
  assert.equal(h.public_payment_link,null);
  await assert.rejects(worker.prepare({...params,selection:{kind:'set',items:['union','dnv']}}),
   /R130_IDEMPOTENCY_KEY_BODY_CHANGED/);
  await assert.rejects(worker.prepare({...params,idempotencyKey:crypto.randomBytes(32).toString('hex')}),
   /R131_ONE_TIME_CONSENT_NONCE_REUSED/);
 }
 assert.equal(calls,0);
});
