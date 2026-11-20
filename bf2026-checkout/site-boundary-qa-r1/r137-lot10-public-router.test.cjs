'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const http=require('node:http');
const {createLot10PublicRouter}=require('./r137-lot10-public-router.cjs');
const selection={kind:'set',items:['rejection_program','union','trainer','source','dnv'],source_variant:'2'};
const quote=()=>({kind:'set',count:5,currency:'RUB',discount_percent:35,
 subtotal_rub:58190,savings_rub:20370,total_rub:37820,
 pricing_version:'BF2026_LOT10_CUSTOM_SET_R107',
 items:[
 {key:'rejection_program',site_lot:5,variant:null,base_price_rub:6990},
 {key:'dnv',site_lot:6,variant:null,base_price_rub:7200},
 {key:'union',site_lot:7,variant:null,base_price_rub:6000},
 {key:'trainer',site_lot:8,variant:null,base_price_rub:28000},
 {key:'source',site_lot:9,variant:'2',base_price_rub:10000}
]});
async function serve(coordinator,cb){
 const handler=createLot10PublicRouter({quoteFn:quote,qaAuthorized:()=>false,coordinator});
 const server=http.createServer((req,res)=>{handler(req,res,new URL(req.url,'http://x').pathname).catch(e=>{
  res.writeHead(500);res.end(String(e.code||'error'));
 })});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 const post=async(path,data,headers={})=>{
  const res=await fetch(url+path,{method:'POST',headers:{
   'Content-Type':'application/json',Origin:'https://wf.tati-lar.ru',...headers
  },body:JSON.stringify(data)});
  return {status:res.status,body:await res.json()};
 };
 const get=async(path)=>{const res=await fetch(url+path);return {status:res.status,body:await res.json()}};
 try{await cb({url,post,get})}finally{await new Promise(resolve=>server.close(resolve))}
}
const order=()=>({selection,email:'customer@example.org',nonce:'N'.repeat(43),
 offerRevisionSha256:'a'.repeat(64),idempotencyKey:'b'.repeat(64)});
test('R137 default real-site state: quote and native positions visible, payments OFF',async()=>{
 await serve(null,async({get,post})=>{
  const s=await get('/api/checkout/set/status');
  a.equal(s.status,200);a.equal(s.body.sale_ready,false);
  a.equal(s.body.public_release_allowed,false);a.equal(s.body.native_receipt_verified,false);
  const p=await post('/api/checkout/set/plan',selection);
  a.equal(p.status,200);a.equal(p.body.quote.total_rub,37820);
  a.equal(p.body.order.expected_single_order,true);
  a.equal(p.body.order.expected_line_items.length,5);
  a.deepEqual(p.body.order.expected_line_items.map(x=>x.offer_id),
   [8933492,8934207,8919715,8934247,8934987]);
  a.equal(p.body.order.expected_line_items.reduce((s,x)=>s+x.line_price_rub,0),37820);
  const start=await post('/api/checkout/set/start',order());
  a.equal(start.status,503);a.equal(start.body.checkout_url,null);
 });
});
test('R137 injected readiness: native unpaid order is sufficient for payment URL, no paid receipt',async()=>{
 let called=0;
 const coordinator={
  readiness:async()=>({ok:true,ready:true,public_release_allowed:true}),
  start:async()=>{called++;return {ok:true,native_order_positions_verified:true,
   public_release_allowed:true,consent_verified:true,deal_number:'812345678901234',
   order_total_rub:37820,checkout_url:'https://study.shkola-dnv.com/pl/lite/pay/order?id=42',
   payment_verified:false,receipt_verified:false}}
 };
 await serve(coordinator,async({get,post})=>{
  const s=await get('/api/checkout/set/status');
  a.equal(s.body.sale_ready,true);a.equal(s.body.native_receipt_verified,false);
  a.equal(s.body.grants_verified,false);
  const p=await post('/api/checkout/set/plan',selection);
  a.equal(p.body.public_release_allowed,true);
  const result=await post('/api/checkout/set/start',order());
  a.equal(result.status,200);a.equal(result.body.quote.total_rub,37820);
  a.equal(result.body.payment_verified,false);a.equal(result.body.receipt_verified,false);
  a.equal(called,1);
 });
});
test('R137 tampered amount, missing native consent, and non-native URLs deny sale',async()=>{
 for(const patch of [{order_total_rub:1},{consent_verified:false},
 {checkout_url:'https://evil.example/pl/lite/pay/order?id=42'}]){
  const coordinator={
   readiness:async()=>({ok:true,ready:true,public_release_allowed:true}),
   start:async()=>({ok:true,native_order_positions_verified:true,
    public_release_allowed:true,consent_verified:true,deal_number:'812345678901234',
    order_total_rub:37820,checkout_url:'https://study.shkola-dnv.com/pl/lite/pay/order?id=42',...patch})
  };
  await serve(coordinator,async({post})=>{
   const r=await post('/api/checkout/set/start',order());
   a.equal(r.status,503);a.equal(r.body.checkout_url,null);
  });
 }
});
test('R137 invalid selection, wrong origin and anonymous QA endpoint blocked',async()=>{
 await serve(null,async({post,get})=>{
  a.equal((await post('/api/checkout/set/plan',{kind:'set',items:['unknown']})).status,422);
  a.equal((await post('/api/checkout/set/start',order(),{Origin:'https://other.example'})).status,403);
  a.equal((await get('/api/checkout/_qa/set-order/status')).status,404);
  a.equal((await get('/api/checkout/set/no')).status,404);
 });
});
