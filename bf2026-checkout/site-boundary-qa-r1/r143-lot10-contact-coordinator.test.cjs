'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createContactCoordinator,checkBuyer,validateNativeBuyerContact}=
 require('./r143-lot10-contact-coordinator.cjs');
const {buildSetImportPlan}=require('./r130-set-lines.cjs');
const {createImportStep}=require('./r130-getcourse-import.cjs');
const {REQUIRED}=require('./r136-lot10-order-coordinator.cjs');
const buyer={email:'anna@example.test',name:'Анна Иванова',
 first_name:'Анна',last_name:'Иванова',phone:'+79991234567'};
const selection={kind:'set',items:['dnv','union','trainer']};
const quoteFn=()=>({kind:'set',pricing_version:'BF2026_LOT10_CUSTOM_SET_R107',
 currency:'RUB',count:3,subtotal_rub:41200,total_rub:35020,
 discount_percent:15,items:[
 {key:'dnv',site_lot:6,base_price_rub:7200},
 {key:'union',site_lot:7,base_price_rub:6000},
 {key:'trainer',site_lot:8,base_price_rub:28000}
 ]});
const key='b'.repeat(64),nonce='C'.repeat(44),revision='d'.repeat(64);
const dealNumber='123456789012345',dealId='924000001';
const payment='https://study.shkola-dnv.com/sales/control/deal/pay/id/924000001';
const preflight=async()=>Object.fromEntries(REQUIRED.map(k=>[k,true]));
function mock({contactReadback,allowProviderWrites=true}={}){
 let sends=0;const outgoing=[];
 const quotePlan=buildSetImportPlan({selection,quoteFn});
 const provider={
  send:async ({payload,isFinal})=>{
   sends++;outgoing.push(payload);
   return {deal_number:dealNumber,deal_id:dealId,import_acknowledged:true,
     provisional_payment_link:isFinal?payment:null};
  }
 };
 const worker=bound=>({
  prepare:async()=>({plan:quotePlan,duplicate:false,status:{state:'PREPARED'}}),
  assembleOnce:async args=>{
   for(let i=0;i<quotePlan.lines.length;i++){
    const payload=createImportStep({line:quotePlan.lines[i],index:i,
     total:quotePlan.items_count,dealNumber,email:args.email,
     nonce:args.nonce,offerRevisionSha256:args.offerRevisionSha256});
    const ack=await bound.send({payload,dealNumber,previousDealId:i?dealId:null});
    assert.equal(ack.deal_id,dealId);
   }
   return {state:'ALL_IMPORT_ACKED_HOLD_NATIVE_READBACK',deal_number:dealNumber};
  }
 });
 const readback=async({plan,dealNumber:n,dealId:id})=>({
  buyerId:'524210421',
  order:{source:'GETCOURSE_AUTHORIZED_NATIVE_READ_ONLY_ORDER',
  account_host:'study.shkola-dnv.com',deal_number:n,deal_id:id,user_id:'524210421',
  order_status:'new',positions:plan.lines.map(x=>({
   offer_id:x.offer_id,quantity:1,price_rub:x.discounted_line_price_rub})),
  order_total_rub:35020,native_order_receipt_count:0}
 });
 const consent=async x=>({source:'GETCOURSE_NATIVE_ORDER_CONSENT_VERIFIED',
  deal_number:x.dealNumber,deal_id:x.dealId,consent_accepted:true});
 const nativeBuyerContactReadback=async args=>contactReadback
 ? contactReadback(args)
 :{source:'GETCOURSE_AUTHORIZED_NATIVE_BUYER_ORDER_CONTACT',
   account_host:'study.shkola-dnv.com',deal_number:args.dealNumber,
   deal_id:args.dealId,user_id:524210421,email:buyer.email,
   first_name:buyer.first_name,last_name:buyer.last_name,phone:buyer.phone,
   legal_consent_native_order_verified:true};
 const c=createContactCoordinator({quoteFn,makeWorker:worker,transport:provider,
  preflight,nativeOrderReadback:readback,nativeConsentReadback:consent,
  nativeBuyerContactReadback,allowProviderWrites});
 return {c,outgoing,get sends(){return sends}};
}
const input={selection,buyer,email:buyer.email,nonce,offerRevisionSha256:revision,
 idempotencyKey:key,legalConsent:true,privacyConsent:true};
test('actual R130 plan for 3 existing offers equals exact screenshot total 35020',()=>{
 const plan=buildSetImportPlan({selection,quoteFn});
 assert.equal(plan.desired_order_total_rub,35020);
 assert.deepEqual(plan.lines.map(x=>x.offer_id),[8934207,8919715,8934247]);
 assert.equal(plan.lines.length,3);
 assert.equal(plan.lines.reduce((a,x)=>a+x.discounted_line_price_rub,0),35020);
});
test('buyer name, phone, mail sent in EACH original one-deal provider step',async()=>{
 const m=mock(),r=await m.c.start(input);
 assert.equal(r.ok,true);assert.equal(r.buyer_contact_native_verified,true);
 assert.equal(r.order_total_rub,35020);assert.equal(r.checkout_url,payment);
 assert.equal(m.sends,3);
 for(const p of m.outgoing){
  assert.equal(p.user.first_name,'Анна');
  assert.equal(p.user.last_name,'Иванова');
  assert.equal(p.user.email,buyer.email);
  assert.equal(p.user.phone,buyer.phone);
  assert.equal(p.deal.deal_is_paid,0);
  assert.equal(p.deal.deal_number,dealNumber);
 }
 assert.equal(m.outgoing.at(-1).system.return_payment_link,1);
 assert(m.outgoing.slice(0,2).every(x=>x.system.return_payment_link===0));
});
test('native buyer contact mismatch prevents release of provider link',async()=>{
 const m=mock({contactReadback:async()=>({
  source:'GETCOURSE_AUTHORIZED_NATIVE_BUYER_ORDER_CONTACT',
  account_host:'study.shkola-dnv.com',deal_number:dealNumber,
  deal_id:dealId,user_id:524210421,email:buyer.email,
  first_name:'Чужая',last_name:'Иванова',phone:buyer.phone,
  legal_consent_native_order_verified:true
 })});
 const r=await m.c.start(input);
 assert.equal(r.ok,false);assert.equal(r.checkout_url,null);
 assert.equal(r.code,'R143_NATIVE_BUYER_CONTACT_UNVERIFIED');
});
test('missing native phone/contact does not throw and never allows release',()=>{
 assert.equal(validateNativeBuyerContact({source:'GETCOURSE_AUTHORIZED_NATIVE_BUYER_ORDER_CONTACT',
 account_host:'study.shkola-dnv.com',deal_number:dealNumber,deal_id:dealId,
 user_id:5,email:buyer.email,first_name:buyer.first_name,
 last_name:buyer.last_name,legal_consent_native_order_verified:true},
 {buyer,dealNumber,dealId}),false);
});
test('invalid legal consent and buyer identity cannot be sent to provider',async()=>{
 const m=mock();
 for(const p of [
 {...input,legalConsent:false},
 {...input,privacyConsent:false},
 {...input,buyer:{...buyer,first_name:'Чужая'}},
 {...input,buyer:{...buyer,phone:'bad'}},
 {...input,email:'other@example.test'}
 ]){
  const r=await m.c.start(p);
  assert.equal(r.ok,false);assert.equal(r.checkout_url,null);
 }
 assert.equal(m.sends,0);
});
test('strict default OFF does not perform ANY external send',async()=>{
 const m=mock({allowProviderWrites:false});
 const r=await m.c.start(input);
 assert.equal(r.ok,false);assert.equal(m.sends,0);
});
