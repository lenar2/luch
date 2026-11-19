'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path'),os=require('node:os'),
 crypto=require('node:crypto'),cp=require('node:child_process');
const {SCHEMA,hmac}=require('./provider-relay-webhook.cjs');
const ORIGIN='/srv/factory-scratch/bf2026-checkout-r2-20261119';
const mod=path.resolve(__dirname,'r115-relay-http.cjs'),patch=path.resolve(__dirname,'patch-r115-event-http.py');
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'bf2026-r115-event-'));
const secret=crypto.randomBytes(40),secretHex=secret.toString('hex');
const qaKey=crypto.randomBytes(32).toString('hex');
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before=digest(ORIGIN+'/server.js');
for(const n of ['server.js','catalog-r110.json','pricing-r107.json','offer-registry.json'])
 fs.copyFileSync(ORIGIN+'/'+n,stage+'/'+n);
for(const dir of ['site-boundary-qa-r1','dynamic-adapter-r1'])
 fs.cpSync(ORIGIN+'/'+dir,stage+'/'+dir,{recursive:true});
fs.writeFileSync(stage+'/private-widget-qa.secret',qaKey,{mode:0o600});
const source=[
 "'use strict';",
 "const map=new Map();",
 "exports.createInboxStore=()=>({async accept(event){",
 " const k=event.source+':'+event.event_id,existing=map.get(k);",
 " if(existing&&existing!==event.raw_sha256){const e=Error('RELAY_EVENT_ID_REPLAY_CONFLICT');e.code=e.message;throw e}",
 " if(existing)return {status:'DUPLICATE_PENDING_READBACK'};",
 " map.set(k,event.raw_sha256);return {status:'ACCEPTED_PENDING_READBACK'};",
 "}});"
].join('\n');
fs.writeFileSync(stage+'/store.cjs',source);
cp.execFileSync('python3',[patch,stage+'/server.js',mod,stage+'/store.cjs']);
process.env.BF2026_R115_RELAY_ENABLED='1';
process.env.BF2026_R115_RELAY_KEY_HEX=secretHex;
process.env.BF_PRICING_PATH=stage+'/pricing-r107.json';
process.env.BF_REGISTRY_PATH=stage+'/offer-registry.json';
const {server}=require(stage+'/server.js');
let base;
test.before(async()=>{await new Promise((ok,fail)=>{
 server.once('error',fail);server.listen(0,'127.0.0.1',()=>{base='http://127.0.0.1:'+server.address().port;ok()});
})});
test.after(async()=>{await new Promise((ok,fail)=>server.close(e=>e?fail(e):ok()));
 fs.rmSync(stage,{recursive:true,force:true});
 assert.equal(digest(ORIGIN+'/server.js'),before);
});
const nowMs=Date.now(),stamp=String(Math.floor(nowMs/1000));
const event={schema:SCHEMA,event_id:'event-H0001',provider_order_id:'ORDER-5000',status_hint:'PAID',
 occurred_at:new Date(nowMs).toISOString()};
async function send({body=event,signature,stampOverride=stamp,method='POST',headers={}}={}){
 const raw=JSON.stringify(body);
 const signed=signature===undefined?hmac(secret,stampOverride,Buffer.from(raw)):signature;
 const r=await fetch(base+'/api/checkout/_relay/payment-hint',{method,
  headers:{'content-type':'application/json','x-bf2026-relay-timestamp':stampOverride,
   'x-bf2026-relay-signature':signed,...headers},body:method==='POST'?raw:undefined});
 return {status:r.status,data:await r.json()};
}
test('isolated REAL R112 HTTP route accepts verified relay hint but not payment proof',async()=>{
 const r=await send();
 assert.equal(r.status,202);assert.equal(r.data.status,'ACCEPTED_PENDING_READBACK');
 assert.equal(r.data.payment_verified,false);assert.equal(r.data.grant_writes,0);
 assert.equal(r.data.release_allowed,false);
});
test('event replay is idempotent; contradictory same event ID is rejected',async()=>{
 const r=await send();assert.equal(r.status,202);assert.equal(r.data.status,'DUPLICATE_PENDING_READBACK');
 const changed=await send({body:{...event,status_hint:'REFUND'}});
 assert.equal(changed.status,422);assert.equal(changed.data.code,'RELAY_EVENT_ID_REPLAY_CONFLICT');
});
test('untrusted and replayed signatures, client-supplied PII are rejected',async()=>{
 const fake=await send({signature:'0'.repeat(64)});
 assert.equal(fake.status,401);assert.equal(fake.data.code,'RELAY_SIGNATURE_INVALID');
 const stale=await send({stampOverride:String(Number(stamp)-400)});
 assert.equal(stale.status,401);assert.equal(stale.data.code,'RELAY_TIMESTAMP_EXPIRED');
 const pii=await send({body:{...event,email:'buyer@example.org',event_id:'event-H0002'}});
 assert.equal(pii.status,422);assert.equal(pii.data.code,'RELAY_HINT_FIELDS_INVALID');
});
test('public checkout stays blocked and signed relay callback cannot create a native order',async()=>{
 const q=await fetch(base+'/api/checkout/status').then(r=>r.json());
 assert.equal(q.sales_ready,false);assert.equal(q.verified_sale_routes,0);
 const r=await fetch(base+'/api/checkout/start',{method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({kind:'set',items:['rejection_program','union']})});
 assert.equal(r.status,503);
 const x=await r.json();assert.equal(x.code,'GETCOURSE_OFFER_NOT_READY');
 assert.equal(x.quote.total_rub,11690);
});
