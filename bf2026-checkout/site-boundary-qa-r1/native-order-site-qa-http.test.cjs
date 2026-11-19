'use strict';
/**
 * Real HTTP requests through an isolated copy of the currently deployed R112 server.
 * NO production writes; NO GetCourse order; NO PostgreSQL migration.
 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),
 path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),
 cp=require('node:child_process');
const ORIGIN='/srv/factory-scratch/bf2026-checkout-r2-20261119';
const MOD=path.resolve(__dirname,'native-order-site-qa-http.cjs');
const PATCH=path.resolve(__dirname,'patch-r112-qa-order-server.py');
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'bf2026-r112-http-'));
const qaKey=crypto.randomBytes(32).toString('hex');
const hmac=crypto.randomBytes(48).toString('hex');
const digest=x=>crypto.createHash('sha256').update(fs.readFileSync(x)).digest('hex');
const productionHash=digest(path.join(ORIGIN,'server.js'));
for(const name of ['server.js','pricing-r107.json','catalog-r110.json','offer-registry.json'])
 fs.copyFileSync(path.join(ORIGIN,name),path.join(stage,name));
fs.writeFileSync(path.join(stage,'private-widget-qa.secret'),qaKey,{mode:0o600});
cp.execFileSync('python3',[PATCH,path.join(stage,'server.js'),MOD]);
process.env.BF2026_ORDER_QA_ENABLED='1';
process.env.BF2026_QA_ORDER_HMAC_HEX=hmac;
process.env.BF_PRICING_PATH=path.join(stage,'pricing-r107.json');
process.env.BF_REGISTRY_PATH=path.join(stage,'offer-registry.json');
const {server}=require(path.join(stage,'server.js'));
let base;
test.before(async()=>{
 await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>{base='http://127.0.0.1:'+server.address().port;resolve()});
 });
});
test.after(async()=>{
 await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 fs.rmSync(stage,{recursive:true,force:true});
 assert.equal(digest(path.join(ORIGIN,'server.js')),productionHash);
});
async function send(endpoint,body,opts={}){
 const response=await fetch(base+'/api/checkout/'+endpoint,{
  method:body===undefined?'GET':'POST',
  headers:{...(body!==undefined?{'content-type':'application/json'}:{}),
   ...(opts.qa===false?{}:{'x-bf2026-qa-key':qaKey}),
   ...(opts.origin?{origin:opts.origin}:{})},
  body:body===undefined?undefined:JSON.stringify(body),
  redirect:'manual'
 });
 return {http:response.status,json:await response.json()};
}
const selection={kind:'set',items:['rejection_program','union']};
test('stage R112 still returns correct native 11690 quote, production routes remain zero',async()=>{
 const status=await send('status');
 assert.equal(status.http,200);
 assert.equal(status.json.sales_ready,false);
 assert.equal(status.json.verified_sale_routes,0);
 const r=await send('quote',selection);
 assert.equal(r.http,200);
 assert.equal(r.json.quote.subtotal_rub,12990);
 assert.equal(r.json.quote.total_rub,11690);
 assert.equal(r.json.availability.ready,false);
});
test('native QA endpoint is private, never exposed to a public browser',async()=>{
 const r=await send('_qa/native-order/prepare',{...selection,checkout_idempotency_key:'a'.repeat(32)},{qa:false});
 assert.equal(r.http,404);
 assert.equal(r.json.code,'NOT_FOUND');
 const s=await send('_qa/native-order/verify',{signed_order_payload:'x'},{qa:false});
 assert.equal(s.http,404);
});
test('native QA signed prepare emits two exact provider lines, grants and discount',async()=>{
 const r=await send('_qa/native-order/prepare',{...selection,checkout_idempotency_key:'a'.repeat(32)});
 assert.equal(r.http,200);
 const x=r.json;
 assert.equal(x.ok,true);
 assert.equal(x.quote.subtotal_rub,12990);
 assert.equal(x.quote.discount_rub,1300);
 assert.equal(x.quote.total_rub,11690);
 assert.equal(x.checkout_idempotency_key,'a'.repeat(32));
 assert.equal(x.provider_order_status,'NOT_CREATED');
 assert.equal(x.checkout_url,null);
 assert.equal(x.route_enabled,false);
 assert.equal(typeof x.signed_order_payload,'string');
 const v=await send('_qa/native-order/verify',{signed_order_payload:x.signed_order_payload});
 assert.equal(v.http,200);
 assert.deepEqual(v.json.lines.map(z=>[z.offer_id,z.product_id,z.training_id,z.unit_price_rub]),[
 [8933492,4557988,936022301,6990],[8919715,4550895,933861292,6000]]);
 assert.deepEqual(v.json.grants.map(z=>[z.training_id,z.start,z.duration_days]),[
 [936022301,'AFTER_PAY',365],[933861292,'AFTER_PAY',365]]);
 assert.equal(v.json.consent_requirements.offer_terms_required,true);
 assert.equal(v.json.provider_order_status,'NOT_CREATED');
 const hold=await send('_qa/native-order/start',{signed_order_payload:x.signed_order_payload});
 assert.equal(hold.http,503);
 assert.equal(hold.json.code,'NATIVE_PROVIDER_CAPABILITY_HOLD');
 assert.equal(hold.json.order_created,false);
 assert.equal(hold.json.checkout_url,null);
});
test('HTTP bridge rejects injected Offer IDs, prices, coupons and missing stable key',async()=>{
 for(const extra of [{total_rub:1},{offer_id:8933492},{discount_percent:99},{coupon:'FREE'}]){
  const r=await send('_qa/native-order/prepare',{...selection,checkout_idempotency_key:'b'.repeat(32),...extra});
  assert.equal(r.http,422);
 }
 const r=await send('_qa/native-order/prepare',selection);assert.equal(r.http,422);
 const bad=await send('_qa/native-order/start',{signed_order_payload:'v1.abc.abc'});
 assert.equal(bad.http,422);assert.equal(bad.json.checkout_url,null);
});
test('HTTP bridge denies cross-origin requests and unknown native endpoints',async()=>{
 const a=await send('_qa/native-order/prepare',{...selection,checkout_idempotency_key:'c'.repeat(32)},{origin:'https://evil.invalid'});
 assert.equal(a.http,403);
 const b=await send('_qa/native-order/delete',{});
 assert.equal(b.http,404);
});
test('public payment route stays 503 for the pair and no public payment URL is emitted',async()=>{
 const r=await send('start',selection);
 assert.equal(r.http,503);
 assert.equal(r.json.code,'GETCOURSE_OFFER_NOT_READY');
 assert.equal(r.json.checkout_url,undefined);
 assert.equal(r.json.quote.total_rub,11690);
});
