'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const STAGE='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&
 process.env.BF2026_R131_STAGE_ONLY==='1'&&
 process.env.BF2026_STAGE_PG_POOL_MODULE===STAGE+'/stage-pool-module.cjs';
const random=()=>crypto.randomBytes(32).toString('hex');
const nonce=()=>crypto.randomBytes(32).toString('base64url');
test('R131 real PG16 concurrent same-key request cannot create two distinct deals, and nonce is single-use',
 {skip:!enabled},async t=>{
 const pool=require(STAGE+'/stage-pool-module.cjs').pool;
 const {compute}=require(STAGE+'/server.js');
 const {createSetOrderWorker}=require('./r130-set-order-worker.cjs');
 const {createImportTransport}=require('./r130-getcourse-import.cjs');
 const worker=createSetOrderWorker({pool,quoteFn:compute,transport:
  createImportTransport({keyProvider:()=>{throw Error('NO_LIVE_API_KEY')},
   fetchImpl:()=>{throw Error('NO_PROVIDER_NETWORK')}})});
 const before=await pool.query('SELECT count(*)::int n FROM bf2026_r130_set_order_intents');
 const keys=[];
 t.after(async()=>{
  for(const k of keys)
   await pool.query('DELETE FROM bf2026_r130_set_order_steps WHERE intent_key=$1',[k]);
  for(const k of keys)
   await pool.query('DELETE FROM bf2026_r130_set_order_intents WHERE intent_key=$1',[k]);
  await pool.end();
 });
 const k=random();keys.push(k);
 const q={idempotencyKey:k,selection:{kind:'set',items:['rejection','union','dnv']},
  email:'r131-idempotency@example.invalid',nonce:nonce(),
  offerRevisionSha256:'f'.repeat(64)};
 const [a,b]=await Promise.all([worker.prepare(q),worker.prepare(q)]);
 assert.equal(a.status.state,'PREPARED');
 assert.equal(b.status.state,'PREPARED');
 assert.equal(a.duplicate!==b.duplicate,true,'one insert; one duplicate readback');
 assert.equal(a.plan.plan_sha256,b.plan.plan_sha256);
 assert.equal(a.status.desired_order_total_rub,b.status.desired_order_total_rub);
 const rows=await pool.query('SELECT deal_number,state,current_step FROM bf2026_r130_set_order_intents WHERE intent_key=$1',[k]);
 assert.equal(rows.rows.length,1);
 assert.equal(rows.rows[0].state,'PREPARED');
 const steps=await pool.query('SELECT step_index,state FROM bf2026_r130_set_order_steps WHERE intent_key=$1 ORDER BY step_index',[k]);
 assert.deepEqual(steps.rows.map(x=>x.step_index),[0,1,2]);
 assert.equal(steps.rows.every(x=>x.state==='PREPARED'),true);
 await assert.rejects(worker.prepare({...q,selection:{kind:'set',items:['rejection','union']}}),
  {code:'R130_IDEMPOTENCY_KEY_BODY_CHANGED'});
 const k2=random();keys.push(k2);
 await assert.rejects(worker.prepare({...q,idempotencyKey:k2}),
  {code:'R131_ONE_TIME_CONSENT_NONCE_REUSED'});
 const remains=await pool.query('SELECT count(*)::int n FROM bf2026_r130_set_order_intents WHERE nonce_sha256=$1',
  [crypto.createHash('sha256').update(q.nonce).digest('hex')]);
 assert.equal(remains.rows[0].n,1);
 const unique=await worker.prepare({...q,idempotencyKey:k2,nonce:nonce()});
 assert.equal(unique.duplicate,false);
 const uniqueRows=await pool.query('SELECT deal_number FROM bf2026_r130_set_order_intents WHERE intent_key=ANY($1::char(64)[])',[keys]);
 assert.equal(new Set(uniqueRows.rows.map(x=>x.deal_number)).size,2);
 const disabled=await worker.assembleOnce(q);
 assert.equal(disabled.state,'HOLD_GETCOURSE_IMPORT_DISABLED');
 assert.equal(disabled.provider_requests_sent,0);
 const after=await pool.query('SELECT count(*)::int n FROM bf2026_r130_set_order_intents');
 assert.equal(after.rows[0].n,before.rows[0].n+2);
 console.log('R131_REAL_PG_CONCURRENCY',JSON.stringify({
  same_request_concurrent_calls:2,created_orders_intents:1,
  same_consent_nonce_second_order_rejected:true,external_getcourse_requests:0,
  payment_link_returned:false}));
});
