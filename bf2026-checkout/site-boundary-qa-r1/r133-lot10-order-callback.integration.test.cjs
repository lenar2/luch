'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const STAGE='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
const enabled=process.env.BF2026_STAGE_ONLY==='1' &&
 process.env.BF2026_R133_STAGE_POOL_MODULE===STAGE+'/stage-pool-module.cjs';
const {CALLBACK_PATH,createLot10OrderCallbackRouter,normalizeCallback}=
 require('./r133-lot10-order-callback.cjs');
const SECRET='r133-test-only-bearer-secret-not-a-provider-key';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function token(){return crypto.randomBytes(32).toString('base64url')}
function dealNumber(){return String(100000000000000n+BigInt('0x'+crypto.randomBytes(7).toString('hex'))%900000000000000n)}
function baseBody(f){
 return {deal_id:f.dealId,deal_number:f.dealNumber,user_id:'987654321',
  offers:f.offers.map(String),cost_money_value:String(f.total),
  status:'new',created_at:new Date().toISOString(),
  consent_nonce:f.nonce,offer_revision_sha256:f.revision};
}
test('R133 parser: exact callback variables, timezone, integer RUB and offer allowlist',()=>{
 const f={dealId:'123456',dealNumber:'123456789012345',offers:['8934973','8919715'],
  total:8400,nonce:token(),revision:'a'.repeat(64)};
 assert.equal(normalizeCallback(baseBody(f)).total_rub,8400);
 for(const bad of [
  {...baseBody(f),extra:'x'},
  {...baseBody(f),created_at:'2026-11-19 17:00:00'},
  {...baseBody(f),cost_money_value:'8400.50'},
  {...baseBody(f),offers:['8934973','8934973']},
  {...baseBody(f),status:'payed'}
 ])assert.throws(()=>normalizeCallback(bad));
});
test('R133 actual stage PostgreSQL + HTTP: durable idempotency and no order/payment side effects',
 {skip:!enabled},async t=>{
 const {pool}=require(STAGE+'/stage-pool-module.cjs');
 await pool.query(fs.readFileSync(path.join(__dirname,'r133-lot10-order-callback.sql'),'utf8'));
 const router=createLot10OrderCallbackRouter({pool,secretProvider:()=>SECRET});
 const server=http.createServer(async(req,res)=>{
  const pathName=new URL(req.url,'http://127.0.0.1').pathname;
  const handled=await router(req,res,pathName);
  if(!handled){res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const fixtures=[];
 t.after(async()=>{
  for(const f of fixtures){
   await pool.query('DELETE FROM bf2026_r133_getcourse_lot10_callback_inbox WHERE deal_number=$1',[f.dealNumber]);
   await pool.query('DELETE FROM bf2026_r130_set_order_steps WHERE intent_key=$1',[f.intentKey]);
   await pool.query('DELETE FROM bf2026_r130_set_order_intents WHERE intent_key=$1',[f.intentKey]);
  }
  await new Promise(resolve=>server.close(resolve));
  await pool.end();
 });
 async function fixture(){
  const nonce=token(),revision=crypto.randomBytes(32).toString('hex');
  const intentKey=sha('r133:'+nonce),number=dealNumber();
  const f={nonce,revision,intentKey,dealNumber:number,dealId:String(crypto.randomInt(100000000,999999999)),
   offers:['8934973','8919715'],amounts:[3000,5400],total:8400};
  fixtures.push(f);
  await pool.query(
   "INSERT INTO bf2026_r130_set_order_intents "+
   "(intent_key,request_sha256,buyer_sha256,nonce_sha256,offer_revision_sha256,plan_sha256,"+
   "pricing_version,deal_number,count_items,total_rub,state) "+
   "VALUES($1,$2,$3,$4,$5,$6,'BF2026_LOT10_CUSTOM_SET_R107',$7,2,8400,'PREPARED')",
   [f.intentKey,sha('request:'+nonce),sha('buyer:'+nonce),sha(nonce),revision,
    sha('plan:'+nonce),number]);
  for(let i=0;i<2;i++)await pool.query(
   'INSERT INTO bf2026_r130_set_order_steps(intent_key,step_index,offer_id,line_amount_rub) VALUES($1,$2,$3,$4)',
   [f.intentKey,i,f.offers[i],f.amounts[i]]);
  return f;
 }
 async function post(body,{secret=SECRET,contentType='application/json'}={}){
  const headers={};
  if(secret!==null)headers.authorization='Bearer '+secret;
  if(contentType)headers['content-type']=contentType;
  const r=await fetch(base+CALLBACK_PATH,{method:'POST',headers,
   body:JSON.stringify(body),redirect:'error'});
  return {status:r.status,body:await r.json()};
 }
 await t.test('valid callback is persisted once; duplicate is acknowledged without side effects',async()=>{
  const f=await fixture(),body=baseBody(f);
  const a=await post(body),b=await post(body);
  assert.equal(a.status,202);assert.equal(a.body.state,'CALLBACK_RECORDED_HOLD_NATIVE_READBACK');
  assert.equal(b.status,200);assert.equal(b.body.duplicate,true);
  for(const key of ['provider_signature_verified','native_order_readback_verified',
   'payment_verified','receipt_verified','grants_verified','public_release_allowed']){
   assert.equal(a.body[key],false,key);
  }
  const rows=await pool.query('SELECT * FROM bf2026_r133_getcourse_lot10_callback_inbox WHERE deal_number=$1',[f.dealNumber]);
  assert.equal(rows.rows.length,1);
  assert.deepEqual(rows.rows[0].offer_ids.map(String),f.offers);
  const intent=await pool.query('SELECT state,current_step FROM bf2026_r130_set_order_intents WHERE intent_key=$1',[f.intentKey]);
  assert.equal(intent.rows[0].state,'PREPARED');
  assert.equal(Number(intent.rows[0].current_step),0);
 });
 await t.test('same deal identity with changed payload is a 409 idempotency conflict',async()=>{
  const f=await fixture(),body=baseBody(f);
  assert.equal((await post(body)).status,202);
  const changed={...body,created_at:new Date(Date.now()+1000).toISOString()};
  const r=await post(changed);
  assert.equal(r.status,409);assert.equal(r.body.code,'R133_CALLBACK_IDEMPOTENCY_CONFLICT');
 });
 await t.test('concurrent exact callbacks create one inbox row',async()=>{
  const f=await fixture(),body=baseBody(f);
  const results=await Promise.all([post(body),post(body)]);
  assert.deepEqual(results.map(x=>x.status).sort(),[200,202]);
  const rows=await pool.query('SELECT count(*)::int n FROM bf2026_r133_getcourse_lot10_callback_inbox WHERE deal_number=$1',[f.dealNumber]);
  assert.equal(rows.rows[0].n,1);
 });
 await t.test('wrong bearer, missing secret and non-JSON content type fail closed',async()=>{
  const f=await fixture(),body=baseBody(f);
  assert.equal((await post(body,{secret:'wrong-secret'})).status,401);
  assert.equal((await post(body,{secret:null})).status,401);
  const missing=createLot10OrderCallbackRouter({pool,secretProvider:()=>null});
  const alt=http.createServer(async(req,res)=>missing(req,res,new URL(req.url,'http://x').pathname));
  await new Promise(resolve=>alt.listen(0,'127.0.0.1',resolve));
  try{
   const r=await fetch('http://127.0.0.1:'+alt.address().port+CALLBACK_PATH,{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify(body)});
   assert.equal(r.status,503);
  }finally{await new Promise(resolve=>alt.close(resolve));}
  assert.equal((await post(body,{contentType:'text/plain'})).status,415);
 });
 for(const [name,mutate] of [
  ['nonce mismatch',b=>({...b,consent_nonce:token()})],
  ['revision mismatch',b=>({...b,offer_revision_sha256:'b'.repeat(64)})],
  ['offer mapping mismatch',b=>({...b,offers:['8934973','8934207']})],
  ['total mismatch',b=>({...b,cost_money_value:'8401'})],
  ['status is not new',b=>({...b,status:'payed'})],
  ['created_at without timezone',b=>({...b,created_at:'2026-11-19T12:00:00'})],
  ['extra client field',b=>({...b,public_release_allowed:true})]
 ]){
  await t.test(name+' rejected without inbox write',async()=>{
   const f=await fixture(),r=await post(mutate(baseBody(f)));
   assert.ok([409,422].includes(r.status),JSON.stringify(r.body));
   const q=await pool.query('SELECT count(*)::int n FROM bf2026_r133_getcourse_lot10_callback_inbox WHERE deal_number=$1',[f.dealNumber]);
   assert.equal(q.rows[0].n,0);
  });
 }
 await t.test('unknown order number cannot be attached to an intent',async()=>{
  const f=await fixture(),body=baseBody(f);
  body.deal_number=dealNumber();
  const r=await post(body);
  assert.equal(r.status,404);
 });
 await t.test('browser-origin callback is rejected',async()=>{
  const f=await fixture(),body=baseBody(f);
  const r=await fetch(base+CALLBACK_PATH,{method:'POST',
   headers:{authorization:'Bearer '+SECRET,'content-type':'application/json',
    origin:'https://attacker.invalid'},body:JSON.stringify(body)});
  assert.equal(r.status,403);
 });
});
