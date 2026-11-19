'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {createStore}=require('./getcourse-callback-hint.cjs');
const {PATH,createHttpHandler}=require('./getcourse-callback-hint-http.cjs');
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&Boolean(process.env.BF2026_STAGE_PG_POOL_MODULE);
test('R122 GetCourse shared-secret callback hint: real staging PostgreSQL + HTTP; no provider signature claim',{skip:!enabled},async t=>{
 const pool=require(process.env.BF2026_STAGE_PG_POOL_MODULE).pool;
 assert.equal(pool.options.host,'127.0.0.1');assert.equal(Number(pool.options.port),55439);
 await pool.query(fs.readFileSync(path.join(__dirname,'getcourse-callback-hints.sql'),'utf8'));
 const secret=crypto.randomBytes(32),eventId=crypto.createHash('sha256').update(JSON.stringify({
  schema:'bf2026.getcourse.callback.hint.v1',account_host:'study.shkola-dnv.com',
  deal_id:'924624456',deal_number:'71994',offers:['8935004'],status:'new',
  cost_money_value:'11690',payed_money:'0',payed_at:'',created_at:'2026-11-19T10:00:00.000Z'
 })).digest('hex');
 const body={schema:'bf2026.getcourse.callback.hint.v1',account_host:'study.shkola-dnv.com',
  deal_id:'924624456',deal_number:'71994',offers:['8935004'],status:'new',
  cost_money_value:'11690',payed_money:'0',payed_at:'',created_at:new Date().toISOString()};
 const raw=Buffer.from(JSON.stringify(body)),id=crypto.createHash('sha256').update(raw).digest('hex');
 const server=http.createServer(createHttpHandler({secret,store:createStore(pool)}));
 await new Promise((ok,err)=>{server.once('error',err);server.listen(0,'127.0.0.1',ok)});
 const url='http://127.0.0.1:'+server.address().port+PATH;
 t.after(async()=>{
  await pool.query('DELETE FROM bf2026_getcourse_callback_hints WHERE event_id=$1',[id]);
  await new Promise(ok=>server.close(ok));await pool.end();
 });
 async function post(token=secret.toString('hex')){
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json',
   'x-getcourse-account':'study.shkola-dnv.com','authorization':'Bearer '+token},body:raw});
  return {status:r.status,body:await r.json()};
 }
 const a=await post();assert.equal(a.status,202);
 assert.equal(a.body.status,'ACCEPTED_HINT_ONLY');assert.equal(a.body.payment_verified,false);
 assert.equal(a.body.provider_signature_verified,false);assert.equal(a.body.grant_writes,0);
 const b=await post();assert.equal(b.status,202);assert.equal(b.body.duplicate,true);
 const c=await post('00'.repeat(32));assert.equal(c.status,401);
 const row=await pool.query('SELECT provider_order_id,status_hint,provider_signature_verified FROM bf2026_getcourse_callback_hints WHERE event_id=$1',[id]);
 assert.equal(row.rowCount,1);assert.equal(row.rows[0].provider_order_id,'924624456');
 assert.equal(row.rows[0].status_hint,'UNPAID');assert.equal(row.rows[0].provider_signature_verified,false);
});
