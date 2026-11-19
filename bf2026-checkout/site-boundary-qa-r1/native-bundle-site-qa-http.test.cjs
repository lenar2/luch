'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path'),os=require('node:os'),
 cp=require('node:child_process'),crypto=require('node:crypto');
const PROD='/srv/factory-scratch/bf2026-checkout-r2-20261119';
const MODULE=path.resolve(__dirname,'native-bundle-site-qa-http.cjs');
const PATCH=path.resolve(__dirname,'patch-r112-native-bundle-qa.py');
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'bf2026-r112-native-bundle-'));
const key=crypto.randomBytes(32).toString('hex');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const originalHash=hash(path.join(PROD,'server.js'));
for(const name of ['server.js','pricing-r107.json','catalog-r110.json','offer-registry.json'])
 fs.copyFileSync(path.join(PROD,name),path.join(stage,name));
for(const dirname of ['site-boundary-qa-r1','dynamic-adapter-r1'])
 fs.cpSync(path.join(PROD,dirname),path.join(stage,dirname),{recursive:true});
fs.writeFileSync(path.join(stage,'private-widget-qa.secret'),key,{mode:0o600});
if(!fs.readFileSync(path.join(stage,'server.js'),'utf8').includes('BF2026_R112_NATIVE_BUNDLE_QA_ROUTE'))
 cp.execFileSync('python3',[PATCH,path.join(stage,'server.js'),MODULE]);
process.env.BF_PRICING_PATH=path.join(stage,'pricing-r107.json');
process.env.BF_REGISTRY_PATH=path.join(stage,'offer-registry.json');
const {server}=require(path.join(stage,'server.js'));
let base;
test.before(async()=>{await new Promise((resolve,reject)=>{
 server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>{base='http://127.0.0.1:'+server.address().port;resolve()})
})});
test.after(async()=>{
 await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 fs.rmSync(stage,{recursive:true,force:true});
 assert.equal(hash(path.join(PROD,'server.js')),originalHash);
});
async function call(action,body,{auth=true,origin=null,method}={}){
 const url=base+'/api/checkout/'+action;
 const opts={method:method||(body===undefined?'GET':'POST'),headers:{
  ...(auth?{'x-bf2026-qa-key':key}:{}),
  ...(body===undefined?{}:{'Content-Type':'application/json'}),
  ...(origin?{Origin:origin}:{})}};
 if(body!==undefined)opts.body=JSON.stringify(body);
 const res=await fetch(url,opts);
 const text=await res.text();
 let json;try{json=JSON.parse(text)}catch{json=null}
 return {http:res.status,headers:res.headers,body:text,json};
}
const selection={kind:'set',items:['rejection_program','union']};
test('real isolated R112 server public quote remains 11690, sales-ready stays false',async()=>{
 const s=await call('status');
 assert.equal(s.http,200);assert.equal(s.json.sales_ready,false);
 assert.equal(s.json.verified_sale_routes,0);
 const q=await call('quote',selection);
 assert.equal(q.http,200);assert.equal(q.json.quote.total_rub,11690);
});
test('new bundle prepare creates ONE signed Offer 8935004 intent, two Product/Training grants',async()=>{
 const r=await call('_qa/native-bundle/prepare',{...selection,checkout_idempotency_key:'a'.repeat(32)});
 assert.equal(r.http,200);assert.equal(r.json.ok,true);
 assert.equal(r.json.mode,'ONE_OFFER_TWO_PRODUCTS');
 assert.equal(r.json.offer_id,8935004);assert.equal(r.json.widget_id,1686790);
 assert.equal(r.json.total_rub,11690);assert.equal(r.json.provider_order_status,'NOT_CREATED_BY_SITE');
 assert.equal(r.json.customer_sale_ready,false);assert.equal(r.json.checkout_url,null);
 const v=await call('_qa/native-bundle/verify',{signed_bundle_intent:r.json.signed_bundle_intent});
 assert.equal(v.http,200);assert.equal(v.json.offer_id,8935004);
 assert.equal(v.json.product_rights.length,2);
 assert.deepEqual(v.json.product_rights.map(p=>[p.product_id,p.training_id,p.internal_net_rub,p.access_days]),[
  [4557988,936022301,6290,365],[4550895,933861292,5400,365]]);
 assert.equal(v.json.provider_offer_active,false);
 const h=await call('_qa/native-bundle/start',{signed_bundle_intent:r.json.signed_bundle_intent});
 assert.equal(h.http,503);
 assert.equal(h.json.code,'NATIVE_BUNDLE_QA_INACTIVE');
 assert.equal(h.json.order_created,false);assert.equal(h.json.checkout_url,null);
});
test('private GET preview embeds correct existing native Widget1686790, not public checkout',async()=>{
 const r=await call('_qa/native-bundle/preview');
 assert.equal(r.http,200);
 assert.match(r.body,/1686790/);
 assert.match(r.body,/11 690/);
 assert.match(r.body,/неактивно/);
 assert.equal(r.headers.get('x-robots-tag'),'noindex,nofollow');
});
test('non-authorized public clients cannot see any native bundle QA URL',async()=>{
 for(const action of ['_qa/native-bundle/preview','_qa/native-bundle/prepare','_qa/native-bundle/start']){
  const r=await call(action,action.endsWith('preview')?undefined:{...selection,checkout_idempotency_key:'a'.repeat(32)},{auth:false});
  assert.equal(r.http,404);assert.equal(r.json.code,'NOT_FOUND');
 }
});
test('client price/offer/coupon overrides, wrong selection, forged token are rejected',async()=>{
 for(const x of [
  {...selection,checkout_idempotency_key:'b'.repeat(32),total_rub:1},
  {...selection,checkout_idempotency_key:'b'.repeat(32),offer_id:8933492},
  {...selection,checkout_idempotency_key:'b'.repeat(32),coupon:'FREE'},
  {kind:'set',items:['union'],checkout_idempotency_key:'b'.repeat(32)}
 ]){
  const r=await call('_qa/native-bundle/prepare',x);
  assert.equal(r.http,422);
 }
 const fake=await call('_qa/native-bundle/verify',{signed_bundle_intent:'v1.xxx.xxx'});
 assert.equal(fake.http,422);assert.equal(fake.json.checkout_url,null);
});
test('foreign Origin denied and public sale route stays unavailable',async()=>{
 const wrong=await call('_qa/native-bundle/prepare',{...selection,checkout_idempotency_key:'c'.repeat(32)},
  {origin:'https://evil.invalid'});
 assert.equal(wrong.http,403);
 const publicStart=await call('start',selection);
 assert.equal(publicStart.http,503);assert.equal(publicStart.json.code,'GETCOURSE_OFFER_NOT_READY');
 assert.equal(publicStart.json.quote.total_rub,11690);
 assert.equal(publicStart.json.checkout_url,undefined);
});
