'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {CATALOG,EXTRA,VERSION,quoteSetR154,buildLot12SetPlan}=require('./r154-lot12-set.cjs');
const {createLot12Coordinator}=require('./r154-lot12-coordinator.cjs');
const {createLot12Http,PREFIX}=require('./r154-lot12-http.cjs');
const pick=(...items)=>({kind:'set',items});
const max7={kind:'set',items:['rejection_program','dnv','union','trainer','source','dgs2','knopochka'],source_variant:'2'};
test('R154 immutable 11-choice R153 server catalog and two native verified offers',()=>{
 assert.equal(VERSION,'BF2026_LOT12_CUSTOM_SET_R153');
 assert.equal(CATALOG.length,11);
 assert.equal(new Set(CATALOG.map(x=>x.key)).size,11);
 assert.deepEqual([EXTRA.dgs2.offer_id,EXTRA.knopochka.offer_id],[8937776,8937784]);
 assert.deepEqual(EXTRA.dgs2.pairs,[[4550902,549791334]]);
 assert.deepEqual(EXTRA.knopochka.pairs,[[4550899,316213861]]);
});
test('R154 final ticket rounds ONCE at nearest 10; 2/3/5/6/7 exact cases',()=>{
 const data=[
  [pick('rejection','devaluation'),2,6666,10,6000],
  [pick('rejection_program','union','dgs2'),3,19990,15,16990],
  [pick('rejection_program','dnv','union','dgs2','knopochka'),5,33180,35,21570],
  [pick('rejection_program','dnv','union','trainer','dgs2','knopochka'),6,61180,40,36710],
  [max7,7,71180,45,39150],
  [{...max7,source_variant:'1'},7,67180,45,36950]
 ];
 for(const [sel,count,subtotal,pct,total] of data){
  const q=quoteSetR154(sel),p=buildLot12SetPlan({selection:sel});
  assert.deepEqual([q.count,q.subtotal_rub,q.discount_percent,q.total_rub],
   [count,subtotal,pct,total]);
  assert.equal(p.desired_order_total_rub,total);
  assert.equal(p.lines.length,count);
  assert.equal(p.lines.reduce((sum,x)=>sum+x.discounted_line_price_rub,0),total);
  assert.equal(new Set(p.lines.map(x=>x.offer_id)).size,count);
  assert.ok(p.lines.every(x=>x.quantity===1&&x.discounted_line_price_rub>=1&&
   x.access.every(a=>a.access_days_after_pay===365)));
  assert.equal(p.provider_order_verified,false);
  assert.equal(p.payment_link_released,false);
 }
});
test('R154 seven-line maximum-savings example has precise offers and source two training grants',()=>{
 const p=buildLot12SetPlan({selection:max7});
 assert.deepEqual(p.lines.map(x=>x.offer_id),
  [8933492,8934207,8919715,8934247,8934987,8937776,8937784]);
 assert.deepEqual(p.lines.find(x=>x.key==='source').access.map(a=>a.training_id),
  [934905122,934905123]);
 assert.deepEqual(p.lines.find(x=>x.key==='trainer').access.map(a=>a.training_id),
  [935051957]);
 assert.equal(p.all_product_training_pairs.length,8);
 assert.equal(p.desired_order_total_rub,39150);
 assert.equal(71180-p.desired_order_total_rub,32030);
 const reverse={...max7,items:[...max7.items].reverse()};
 assert.equal(buildLot12SetPlan({selection:reverse}).plan_sha256,p.plan_sha256);
});
test('R154 rejects client tampering, overlaps, third audio, duplicates and 8 items',()=>{
 const invalid=[
  pick('rejection'),
  pick('rejection','rejection'),
  pick('rejection','devaluation','guilt'),
  pick('rejection_program','self'),
  pick('rejection','not_a_product'),
  {kind:'set',items:['source','trainer'],source_variant:'3'},
  {kind:'set',items:['union','dnv'],source_variant:'2'},
  {kind:'set',items:max7.items,source_variant:'2',total_rub:1},
  {kind:'set',items:[...max7.items,'rejection'],source_variant:'2'},
  {kind:'single',items:['source','trainer']},
  {kind:'set',items:['union','source'],source_variant:2}
 ];
 for(const x of invalid)assert.throws(()=>buildLot12SetPlan({selection:x}));
});
async function serve(handle,body,method='POST',path=PREFIX+'plan',headers={}){
 const server=http.createServer((req,res)=>handle(req,res,new URL(req.url,'http://localhost').pathname));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const u='http://127.0.0.1:'+server.address().port+path;
  const res=await fetch(u,{method,headers:{'content-type':'application/json',...headers},
   ...(method==='POST'?{body:JSON.stringify(body)}:{})});
  return {status:res.status,data:await res.json()};
 }finally{await new Promise(resolve=>server.close(resolve))}
}
test('R154 actual local HTTP 2,3,5,6,7 line quote + hard HOLD start',async()=>{
 const handle=createLot12Http();
 for(const selection of [
  pick('rejection','devaluation'),
  pick('rejection_program','dnv','dgs2'),
  pick('rejection_program','dnv','union','dgs2','knopochka'),
  pick('rejection_program','dnv','union','trainer','dgs2','knopochka'),
  max7
 ]){
  const {status,data}=await serve(handle,selection);
  assert.equal(status,200);assert.equal(data.quote.count,selection.items.length);
  assert.equal(data.native_plan.lines.length,selection.items.length);
  assert.equal(data.native_plan.lines.reduce((s,x)=>s+x.discounted_line_price_rub,0),
   data.quote.total_rub);
  assert.equal(data.checkout_url,null);assert.equal(data.public_release_allowed,false);
 }
 const payload={selection:max7,email:'buyer@example.org',nonce:'a'.repeat(43),
  offerRevisionSha256:'a'.repeat(64),idempotencyKey:'b'.repeat(64)};
 const held=await serve(handle,payload,'POST',PREFIX+'start');
 assert.equal(held.status,503);assert.equal(held.data.checkout_url,null);
 const invalid=await serve(handle,{...max7,items:[...max7.items,'guilt']});
 assert.equal(invalid.status,422);
 const origin=await serve(handle,max7,'POST',PREFIX+'plan',{origin:'https://evil.example'});
 assert.equal(origin.status,403);
 const status=await serve(handle,null,'GET',PREFIX+'status');
 assert.equal(status.status,200);assert.equal(status.data.public_release_allowed,false);
});
test('R154 mock coordinator cannot release amount mismatch or arbitrary payment domain',async()=>{
 const payload={selection:max7,email:'buyer@example.org',nonce:'a'.repeat(43),
  offerRevisionSha256:'a'.repeat(64),idempotencyKey:'b'.repeat(64)};
 let called=0;
 const coordinator={readiness:async()=>({ok:true,ready:true,public_release_allowed:true}),
  start:async()=>{called++;return {
   ok:true,public_release_allowed:true,native_order_positions_verified:true,
   consent_verified:true,order_total_rub:39150,deal_number:'812345678901234',
   checkout_url:'https://evil.example/pay'
  }}};
 const h=createLot12Http({coordinator,allowStart:true});
 const fail=await serve(h,payload,'POST',PREFIX+'start');
 assert.equal(fail.status,503);assert.equal(fail.data.checkout_url,null);
 assert.equal(called,1);
 coordinator.start=async()=>({...await Promise.resolve({
  ok:true,public_release_allowed:true,native_order_positions_verified:true,
  consent_verified:true,order_total_rub:39160,deal_number:'812345678901234',
  checkout_url:'https://study.shkola-dnv.com/pl/pay'
 })});
 const mismatch=await serve(h,payload,'POST',PREFIX+'start');
 assert.equal(mismatch.status,503);assert.equal(mismatch.data.checkout_url,null);
});
test('R154 coordinator rejects native real-time approval absence without writing',async()=>{
 let writes=0;const pool={query:async()=>({rows:[]}),connect:async()=>{writes++;throw Error('DB_NOT_ENABLED')}};
 const coord=createLot12Coordinator({pool,transport:{send:async()=>{writes++;throw Error('NO_WRITE')}},
  preflight:async()=>({owner_enabled:true}),nativeOrderReadback:async()=>{},
  nativeConsentReadback:async()=>{},allowProviderWrites:true});
 const status=await coord.readiness();
 assert.equal(status.ok,false);assert.equal(status.public_release_allowed,false);
 assert.equal(writes,0);
});


test('R154 7-offer Import API serializes single same-Deal unpaid steps with opt-in cap only',()=>{
 const {createImportStep}=require('./r130-getcourse-import.cjs');
 const p=buildLot12SetPlan({selection:max7});
 p.lines.forEach((line,index)=>{
  const args={line,index,total:p.lines.length,dealNumber:'812345678901234',
   email:'buyer@example.org',nonce:'n'.repeat(43),
   offerRevisionSha256:'f'.repeat(64)};
  assert.throws(()=>createImportStep(args),/R130_IMPORT_STEP_INVALID/);
  const x=createImportStep({...args,maxItems:7});
  assert.equal(x.deal.offer_id,line.offer_id);
  assert.equal(x.deal.deal_cost,line.discounted_line_price_rub);
  assert.equal(x.deal.deal_number,'812345678901234');
  assert.equal(x.deal.deal_is_paid,0);
  assert.equal(x.system.multiple_offers,index?1:0);
  assert.equal(x.system.return_payment_link,0);
 });
});
test('R154 7-offer native GetCourse unpaid readback checks every line, never claims payment',()=>{
 const {validateAssembledOrder}=require('./r130-native-order-readback.cjs');
 const plan=buildLot12SetPlan({selection:max7});
 const readback={source:'GETCOURSE_AUTHORIZED_NATIVE_READ_ONLY_ORDER',
  account_host:'study.shkola-dnv.com',deal_number:'812345678901234',
  deal_id:'121212',user_id:'123',order_status:'new',
  positions:plan.lines.map(x=>({offer_id:x.offer_id,quantity:1,
   price_rub:x.discounted_line_price_rub})),
  order_total_rub:plan.desired_order_total_rub,native_order_receipt_count:0};
 const args={plan,dealNumber:'812345678901234',dealId:'121212',buyerId:'123',readback};
 const proof=validateAssembledOrder(args);
 assert.equal(proof.native_order_positions_verified,true);
 assert.equal(proof.payment_link_release_allowed,false);
 assert.equal(proof.payment_verified,false);
 assert.equal(proof.actual_grants_verified,false);
 const tampered={...readback,positions:readback.positions.map((x,i)=>
  i===6?{...x,price_rub:x.price_rub+1}:x)};
 assert.equal(validateAssembledOrder({...args,readback:tampered}).native_order_positions_verified,false);
 const duplicate={...readback,positions:readback.positions.map((x,i)=>
  i===6?{...x,offer_id:readback.positions[5].offer_id}:x)};
 assert.equal(validateAssembledOrder({...args,readback:duplicate}).native_order_positions_verified,false);
});
