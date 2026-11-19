'use strict';
/* BF2026 R132: real isolated HTTP/PostgreSQL test, browser-equivalent VM.
 * NO GetCourse credentials or writes; tests the bridge and the current server.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ROOT=__dirname;
const STAGE='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
const BASE='http://127.0.0.1:18776';
const enabled=process.env.BF2026_STAGE_ONLY==='1' &&
 process.env.BF2026_R130_LOT10_STAGE_PORT==='18776' &&
 process.env.BF2026_STAGE_PG_POOL_MODULE===STAGE+'/stage-pool-module.cjs';
const script=fs.readFileSync(path.join(ROOT,'vf110-checkout-bridge-r132.js'),'utf8');
const origin='https://wf.tati-lar.ru';
async function http(endpoint,body){
 const r=await fetch(BASE+endpoint,{method:body?'POST':'GET',
  headers:{origin,...(body?{'Content-Type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined,redirect:'error'});
 return {status:r.status,data:await r.json()};
}
async function waitFor(predicate,description){
 for(let i=0;i<75;i++){
  if(predicate())return;
  await new Promise(resolve=>setTimeout(resolve,15));
 }
 throw Error('TIMEOUT '+description);
}
function runCart(selection,intercept){
 const events={},logs=[],nodes=new Map(),opens=[],calls=[];
 const node=sel=>{
  if(!nodes.has(sel))nodes.set(sel,{
    textContent:sel==='#cart-layer .cart-checkout'?'Оформление заказа пока недоступно':'',
    disabled:true,addEventListener(type,fn){events['submit:'+type]=fn},
    setAttribute(k,v){this[k]=v}
  });
  return nodes.get(sel);
 };
 const submit=node('#cart-layer .cart-checkout');
 const lines=selection.lines;
 const context={
  location:{hostname:'wf.tati-lar.ru',origin,assign:u=>opens.push(u)},
  document:{querySelector:node},
  window:{BF2026Cart:{getSnapshot:()=>({lines,currency:'RUB'})},
   addEventListener:(type,fn)=>{events[type]=fn}},
  URL,Promise,Intl,Set,JSON,Number,Array,String,Error,
  fetch:async(endpoint,opt={})=>{
    logs.push(endpoint);
    if(intercept){
      const result=await intercept(endpoint,opt);
      if(result)return {ok:result.status>=200&&result.status<300,
       status:result.status,json:async()=>result.data};
    }
    const resp=await fetch(BASE+endpoint,{...opt,headers:{...opt.headers,origin}});
    return resp;
  }
 };
 vm.runInNewContext(script,context,{timeout:1000,filename:'vf110-checkout-bridge-r132.js'});
 return {submit,events,logs,opens,calls,node};
}
const set2={kind:'set',items:['rejection','union']};
const snap2={lines:[{lot:10,request:set2,subtotal_rub:9333,display_price_rub:8400}]};

test('R132 source: set never uses generic checkout start; exact release checks and JS syntax',()=>{
 assert.match(script,/post\(isSet\?'set\/start':'start',req\)/);
 assert.match(script,/s\.live_provider_import_enabled===true/);
 assert.match(script,/p\.public_release_allowed===true/);
 assert.match(script,/order\.expected_single_order!==true/);
 assert.match(script,/lines\.reduce\(\(sum,x\)=>sum\+x\.line_price_rub,0\)!==q.total_rub/);
});
test('R132 actual Lot10 stage HTTP + PostgreSQL: R110 cart route and unchanged empty ledgers',{skip:!enabled},async t=>{
 const {pool}=require(STAGE+'/stage-pool-module.cjs');
 t.after(()=>pool.end());
 for(const [selection,count,total,offers] of [
  [set2,2,8400,[8934973,8919715]],
  [{kind:'set',items:['rejection_program','union','trainer','source','dnv'],source_variant:'2'},5,37820,
   [8933492,8934207,8919715,8934247,8934987]]
 ]){
  await t.test(count+' selections: R110 quote equals R130 one-native-order plan',async()=>{
   const q=await http('/api/checkout/quote',selection);
   const p=await http('/api/checkout/set/plan',selection);
   assert.equal(q.status,200);assert.equal(p.status,200);
   assert.equal(q.data.quote.total_rub,total);
   assert.equal(p.data.quote.total_rub,total);
   assert.equal(p.data.quote.count,count);
   assert.equal(p.data.order.expected_single_order,true);
   assert.equal(p.data.order.create_new_offer_count,0);
   assert.deepEqual(p.data.order.expected_line_items.map(x=>x.offer_id),offers);
   assert.equal(p.data.order.expected_line_items.reduce((s,x)=>s+x.line_price_rub,0),total);
   assert.equal(p.data.public_release_allowed,false);
   assert.equal(p.data.checkout_url,null);
   for(const line of p.data.order.expected_line_items){
    assert.ok(line.product_training_pairs.every(x=>x.after_pay_days===365));
   }
   if(count===5){
    assert.deepEqual(p.data.order.expected_line_items.find(x=>x.offer_id===8934247)
      .product_training_pairs.map(x=>x.training_id),[935051957]);
    assert.deepEqual(p.data.order.expected_line_items.find(x=>x.offer_id===8934987)
      .product_training_pairs.map(x=>x.training_id),[934905122,934905123]);
   }
  });
 }
 await t.test('Set-specific start denies public checkout',async()=>{
  const r=await http('/api/checkout/set/start',set2);
  assert.equal(r.status,503);
  assert.equal(r.data.checkout_url,null);
  assert.equal(r.data.public_release_allowed,false);
 });
 await t.test('No live native order/intents/readbacks minted by HTTP E2E',async()=>{
  for(const table of [
   'bf2026_r130_set_order_intents','bf2026_r130_set_order_steps',
   'bf2026_r127_consent_challenges','bf2026_getcourse_readback_once'
  ]){
   const r=await pool.query('SELECT COUNT(*)::int AS n FROM '+table);
   assert.equal(r.rows[0].n,0,table);
  }
 });
});
test('R132 actual R110 JS + real stage server: HOLD remains disabled despite valid plan',{skip:!enabled},async()=>{
 const ui=runCart(snap2);
 await waitFor(()=>ui.logs.includes('/api/checkout/set/plan'),'set plan queried');
 await waitFor(()=>ui.node('#cart-message').textContent.includes('Сет рассчитан сервером'),'HOLD visible');
 assert.equal(ui.submit.disabled,true);
 assert.ok(ui.logs.includes('/api/checkout/set/status'));
 assert.ok(!ui.logs.includes('/api/checkout/start'));
 assert.ok(!ui.logs.includes('/api/checkout/set/start'));
 assert.deepEqual(ui.opens,[]);
});
test('R132 single-lot global ready cannot accidentally unlock multi-offer set',{skip:!enabled},async()=>{
 const ui=runCart(snap2,(endpoint)=>{
  if(endpoint==='/api/checkout/status')return {status:200,data:{
   pricing_version:'BF2026_LOT10_CUSTOM_SET_R107',sales_ready:true,
   native_direct_available_count:10}};
  if(endpoint==='/api/checkout/quote')return null;
 });
 await waitFor(()=>ui.node('#cart-message').textContent.includes('Сет рассчитан сервером'),'read only HOLD');
 assert.equal(ui.submit.disabled,true);
 assert.deepEqual(ui.opens,[]);
});
test('R132 mismatched native line amount is blocked before checkout',{skip:!enabled},async()=>{
 const p=await http('/api/checkout/set/plan',set2);
 const altered=structuredClone(p.data);altered.order.expected_line_items[0].line_price_rub+=1;
 const ui=runCart(snap2,endpoint=>
  endpoint==='/api/checkout/set/plan'?{status:200,data:altered}:null);
 await waitFor(()=>ui.node('#cart-message').textContent.includes('Не удалось подтвердить'),'tamper blocked');
 assert.equal(ui.submit.disabled,true);assert.deepEqual(ui.opens,[]);
});
test('R132 hypothetical released fixture can only call set/start, never generic start',{skip:!enabled},async()=>{
 const p=await http('/api/checkout/set/plan',set2);
 const hypothetical=structuredClone(p.data);hypothetical.public_release_allowed=true;
 const urls=[];
 const ui=runCart(snap2,endpoint=>{
  if(endpoint==='/api/checkout/status')return {status:200,data:{pricing_version:'BF2026_LOT10_CUSTOM_SET_R107',sales_ready:true}};
  if(endpoint==='/api/checkout/set/plan')return {status:200,data:hypothetical};
  if(endpoint==='/api/checkout/set/status')return {status:200,data:{
   ok:true,sale_ready:true,public_release_allowed:true,live_provider_import_enabled:true,
   native_payment_link_verified:true,native_receipt_verified:true,grants_verified:true}};
  if(endpoint==='/api/checkout/set/start'){urls.push(endpoint);return {status:503,data:{ok:false,checkout_url:null}};}
  if(endpoint==='/api/checkout/start')throw Error('Wrong generic route');
  return null;
 });
 await waitFor(()=>ui.submit.disabled===false,'hypothetical release (test fixture only)');
 await ui.events['submit:click']();
 await waitFor(()=>urls.length===1,'set-specific start attempted and blocked');
 assert.deepEqual(urls,['/api/checkout/set/start']);
 assert.deepEqual(ui.opens,[]);
});
