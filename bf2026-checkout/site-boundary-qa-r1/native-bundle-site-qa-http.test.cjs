'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),
 path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const src='/srv/factory-scratch/bf2026-checkout-r2-20261119';
const modulePath=path.resolve(__dirname,'native-bundle-site-qa-http.cjs');
const qaKey=crypto.randomBytes(32).toString('hex');
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'bf2026-bundle-stage-'));
const digest=x=>crypto.createHash('sha256').update(fs.readFileSync(x)).digest('hex');
const liveHash=digest(path.join(src,'server.js'));
for(const file of ['server.js','pricing-r107.json','catalog-r110.json','offer-registry.json']){
 fs.copyFileSync(path.join(src,file),path.join(stage,file));
}
for(const folder of ['site-boundary-qa-r1','dynamic-adapter-r1']){
 fs.cpSync(path.join(src,folder),path.join(stage,folder),{recursive:true});
}
fs.writeFileSync(path.join(stage,'private-widget-qa.secret'),qaKey,{mode:0o600});
let code=fs.readFileSync(path.join(stage,'server.js'),'utf8');
const insert="const BF2026_R117_NATIVE_BUNDLE_QA=require("+JSON.stringify(modulePath)+").createNativeBundleQARouter({"+
 "quoteFn:compute,manifest,qaAuthorized,secretHex:crypto.createHmac('sha256',Buffer.from(qaSecret)).update('r117:bundle:secret').digest('hex')});\n";
const anchor='const server=http.createServer(async(req,res)=>{';
const route=" if(path.startsWith('/api/checkout/_qa/native-bundle/'))return BF2026_R117_NATIVE_BUNDLE_QA(req,res,path);\n";
const probe=" if(req.method==='GET'&&path==='/api/checkout/catalog'){";
assert.equal(code.split(anchor).length,2);assert.equal(code.split(probe).length,2);
code=code.replace(anchor,insert+anchor).replace(probe,route+probe);
fs.writeFileSync(path.join(stage,'server.js'),code);
const {server}=require(path.join(stage,'server.js'));
let base;
test.before(async()=>{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{base='http://127.0.0.1:'+server.address().port;resolve()})})});
test.after(async()=>{
 await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 fs.rmSync(stage,{recursive:true,force:true});
 assert.equal(digest(path.join(src,'server.js')),liveHash);
});
async function request(endpoint,body,authorized=true){
 const u=base+'/api/checkout/_qa/native-bundle/'+endpoint;
 const res=await fetch(u,{method:body===undefined?'GET':'POST',
  headers:{...(authorized?{'x-bf2026-qa-key':qaKey}:{}),
   ...(body!==undefined?{'Content-Type':'application/json'}:{})},
  ...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const bodyText=await res.text(),type=res.headers.get('content-type')||'';
 return {http:res.status,type,body:type.includes('application/json')?JSON.parse(bodyText):bodyText};
}
const selection={kind:'set',items:['rejection_program','union']};
test('closed QA site renders native GetCourse bundle widget 1686790 without public checkout',async()=>{
 const r=await request('preview');
 assert.equal(r.http,200);
 assert.match(r.body,/widget\/script\?id=1686790/);
 assert.match(r.body,/11 690/);
 assert.match(r.body,/неактивно/);
 assert.match(r.body,/noindex/);
});
test('uncredentialed visitor cannot open native bundle or generate signed token',async()=>{
 for(const endpoint of ['preview','prepare','verify']){
  const r=await request(endpoint,endpoint==='preview'?undefined:{},false);
  assert.equal(r.http,404);
 }
});
test('signed bundle Prepare → Verify gives exactly ONE Offer and TWO different paid-only Product access grants',async()=>{
 const p=await request('prepare',{...selection,checkout_idempotency_key:'a'.repeat(32)});
 assert.equal(p.http,200);
 assert.equal(p.body.mode,'ONE_OFFER_TWO_PRODUCTS');
 assert.equal(p.body.offer_id,8935004);
 assert.equal(p.body.total_rub,11690);
 assert.deepEqual(p.body.expected_products.map(x=>[x.product_id,x.training_id,x.internal_net_rub]),
  [[4557988,936022301,6290],[4550895,933861292,5400]]);
 assert.equal(p.body.provider_order_status,'NOT_CREATED_BY_SITE');
 assert.equal(p.body.customer_sale_ready,false);
 assert.equal(p.body.checkout_url,null);
 const v=await request('verify',{signed_bundle_intent:p.body.signed_bundle_intent});
 assert.equal(v.http,200);
 assert.equal(v.body.total_rub,11690);
 assert.equal(v.body.product_rights.length,2);
 assert.equal(v.body.provider_offer_active,false);
 const start=await request('start',{signed_bundle_intent:p.body.signed_bundle_intent});
 assert.equal(start.http,503);
 assert.equal(start.body.code,'NATIVE_BUNDLE_QA_INACTIVE');
 assert.equal(start.body.checkout_url,null);
});
test('bundle site route rejects wrong price injection, offers injection, token tamper and invalid selection',async()=>{
 for(const extra of [{total_rub:1},{offer_id:8933492},{discount_percent:90},{promo:'FREE'}]){
  const r=await request('prepare',{...selection,checkout_idempotency_key:'b'.repeat(32),...extra});
  assert.equal(r.http,422);
 }
 const broken=await request('verify',{signed_bundle_intent:'v1.abc.def'});
 assert.equal(broken.http,422);
 const odd=await request('prepare',{kind:'set',items:['union','union'],checkout_idempotency_key:'c'.repeat(32)});
 assert.equal(odd.http,422);
});
test('unrelated public checkout remains blocked and source server is unchanged',async()=>{
 const r=await fetch(base+'/api/checkout/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(selection)});
 const b=await r.json();
 assert.equal(r.status,503);
 assert.equal(b.quote.total_rub,11690);
 assert.equal(b.checkout_url,undefined);
 assert.equal(digest(path.join(src,'server.js')),liveHash);
});
