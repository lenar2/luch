'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http');
const {createLot10ContactGateway,validateSubmission,challenge,PATH}=require('./r142-lot10-contact-gateway.cjs');
const selection={kind:'set',items:['dnv','union','trainer']};
const quote=q=>({kind:'set',pricing_version:'BF2026_LOT10_CUSTOM_SET_R107',
 currency:'RUB',count:3,subtotal_rub:41200,total_rub:35020,discount_percent:15,
 items:[
  {key:'dnv',site_lot:6,base_price_rub:7200},
  {key:'union',site_lot:7,base_price_rub:6000},
  {key:'trainer',site_lot:8,base_price_rub:28000}
 ]});
const buyer={email:'anna@example.test',name:'Анна Иванова',phone:'+79991234567'};
const payload={selection,buyer,offer_agreement:true,privacy_agreement:true,
 submission_id:'a1234567-89ab-4cde-8fab-a123456789ab'};
const url='https://study.shkola-dnv.com/sales/control/deal/pay/id/924000001';
const secret='R142_OWNER_PRIVATE_TEST_ONLY_SECRET_'.repeat(2);
const right={ok:true,native_order_positions_verified:true,consent_verified:true,
 buyer_contact_native_verified:true,public_release_allowed:true,
 order_total_rub:35020,deal_number:'123456789012345',checkout_url:url};
const ready={ok:true,ready:true,public_release_allowed:true};
const coordinator=(overrides={})=>({supportsBuyerContact:true,readiness:async()=>ready,
 start:async()=>right,...overrides});
test('default server without verified coordinator rejects before reading PII',async()=>{
 let called=0;const g=createLot10ContactGateway({quoteFn:quote});
 assert.equal(await g.readiness(),false);
 const [code,resp]=await g.start(payload);assert.equal(code,503);
 assert.equal(resp.checkout_url,null);
});
test('exact R141 UI payload is parsed for native single order 35020, 3 offers',async()=>{
 let seen=null;
 const g=createLot10ContactGateway({quoteFn:quote,coordinator:coordinator({
  start:async p=>{seen=p;return right}}),consentKeyProvider:async()=>secret});
 const [code,a]=await g.start(payload);
 assert.equal(code,200);assert.equal(a.order_total_rub,35020);assert.equal(a.checkout_url,url);
 assert.deepEqual(seen.selection,selection);
 assert.equal(seen.buyer.name,buyer.name);
 assert.equal(seen.buyer.phone,buyer.phone);
 assert.equal(seen.email,buyer.email);
 assert.equal(seen.nonce.length,43);assert.equal(seen.offerRevisionSha256.length,64);
 assert.equal(seen.idempotencyKey.length,64);
 assert.equal(seen.legalConsent,true);
 assert.equal(a.payment_verified,false);assert.equal(a.access_grants_verified,false);
});
test('consent or PII cannot be bypassed before provider coordinator',async()=>{
 const g=createLot10ContactGateway({quoteFn:quote,coordinator:coordinator(),
  consentKeyProvider:async()=>secret});
 for(const bad of [
  {...payload,offer_agreement:false},{...payload,privacy_agreement:false},
  {...payload,buyer:{...buyer,phone:'xx'}},
  {...payload,buyer:{...buyer,name:undefined}},
  {...payload,buyer:{...buyer,email:'invalid'}},
  {...payload,submission_id:'bad'},
  {...payload,selection:{kind:'single',lot:5}},
  {...payload,extra:'evil'}
 ])assert.equal((await g.start(bad))[0],422);
});
test('native evidence amount, contact, consent or payment domain mismatches block',async()=>{
 for(const delta of [
  {order_total_rub:35021},{native_order_positions_verified:false},
  {buyer_contact_native_verified:false},{consent_verified:false},
  {checkout_url:'https://evil.example/pay'},
  {deal_number:'0'},{public_release_allowed:false}
 ]){
  const g=createLot10ContactGateway({quoteFn:quote,
   coordinator:coordinator({start:async()=>({...right,...delta})}),
   consentKeyProvider:async()=>secret});
  const [code,a]=await g.start(payload);assert.equal(code,503);
  assert.equal(a.checkout_url,null);
 }
});
test('same submission id yields same server-only nonce and idempotency across retries',async()=>{
 const p=validateSubmission(payload);
 const canonical={plan_sha256:'a'.repeat(64)};
 const a=challenge(secret,p,canonical),b=challenge(secret,p,canonical);
 assert.deepEqual(a,b);
 const changed={...p,buyer:{...p.buyer,email:'other@example.test'}};
 const c=challenge(secret,changed,canonical);
 assert.equal(a.idempotencyKey,c.idempotencyKey);
 assert.notEqual(a.nonce,c.nonce);
});
test('native contact support mandatory: R136 coordinator without it cannot activate',async()=>{
 const c=coordinator();delete c.supportsBuyerContact;
 const g=createLot10ContactGateway({quoteFn:quote,coordinator:c,
  consentKeyProvider:async()=>secret});
 assert.equal((await g.start(payload))[0],503);
});
test('real local HTTP route returns 503 safely and does not consume PII when hold',async t=>{
 const g=createLot10ContactGateway({quoteFn:quote});
 let got=0;const server=http.createServer(async(req,res)=>{
  got++;const done=await g.handle(req,res,new URL(req.url,'http://localhost').pathname);
  if(!done){res.writeHead(404);res.end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port;
 const res=await fetch(base+PATH,{method:'POST',
  headers:{'content-type':'application/json','origin':'https://wf.tati-lar.ru'},
  body:JSON.stringify(payload)});
 assert.equal(res.status,503);
 assert.equal((await res.json()).checkout_url,null);
 assert.equal(got,1);
 const origin=await fetch(base+PATH,{method:'POST',
  headers:{'origin':'https://bad.example','content-type':'application/json'},body:'{}'});
 assert.equal(origin.status,403);
});
