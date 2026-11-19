'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const {REQUIRED,createLot10Coordinator}=require('./r136-lot10-order-coordinator.cjs');
const {normalizeStepResponse}=require('./r135-set-payment-link.cjs');
const {createImportStep}=require('./r130-getcourse-import.cjs');
const {buildSetImportPlan}=require('./r130-set-lines.cjs');
const selection={kind:'set',items:['rejection_program','union','trainer','source','dnv'],source_variant:'2'};
const quote=()=>({kind:'set',count:5,currency:'RUB',discount_percent:35,subtotal_rub:58190,
 savings_rub:20370,total_rub:37820,pricing_version:'BF2026_LOT10_CUSTOM_SET_R107',
 items:[
 {key:'rejection_program',site_lot:5,variant:null,base_price_rub:6990},
 {key:'dnv',site_lot:6,variant:null,base_price_rub:7200},
 {key:'union',site_lot:7,variant:null,base_price_rub:6000},
 {key:'trainer',site_lot:8,variant:null,base_price_rub:28000},
 {key:'source',site_lot:9,variant:'2',base_price_rub:10000}
]});
const plan=buildSetImportPlan({selection,quoteFn:quote});
const valid=Object.fromEntries(REQUIRED.map(k=>[k,true]));
const body=id=>({selection,email:'buyer'+id+'@example.org',nonce:'A'.repeat(43),
 offerRevisionSha256:'b'.repeat(64),idempotencyKey:id.repeat(64)});
const detail=(number,dealId)=>({
 source:'GETCOURSE_AUTHORIZED_NATIVE_READ_ONLY_ORDER',
 account_host:'study.shkola-dnv.com',deal_number:number,deal_id:dealId,user_id:'1234511',
 order_status:'new',positions:plan.lines.map(x=>({
 offer_id:x.offer_id,quantity:1,price_rub:x.discounted_line_price_rub
 })),order_total_rub:37820,native_order_receipt_count:0
});
function deps({enabled=true,preflight=async()=>valid,orderMutate=x=>x,
 consentMutate=x=>x}={}){
 let apiCalls=0;
 const transport={send:async ({payload,dealNumber,previousDealId,isFinal})=>{
   apiCalls++;
   await Promise.resolve();
   const id=dealNumber.slice(-6);
   return normalizeStepResponse({success:true,action:'add',result:{
    success:true,deal_number:dealNumber,deal_id:id,
    ...(isFinal?{payment_link:'https://study.shkola-dnv.com/pl/lite/pay/order?deal='+id}:{})
   }},{dealNumber,previousDealId,isFinal});
 }};
 const makeWorker=internal=>({
  async prepare({idempotencyKey}){
   return {plan,status:{state:'PREPARED'},intent_key:idempotencyKey,duplicate:false};
  },
  async assembleOnce({idempotencyKey,selection,email,nonce,offerRevisionSha256}){
   const number='81234567890'+String(parseInt(idempotencyKey.slice(0,2),16)).padStart(4,'0');
   for(let i=0;i<plan.lines.length;i++){
    const payload=createImportStep({
     line:plan.lines[i],index:i,total:plan.lines.length,
     dealNumber:number,email,nonce,offerRevisionSha256
    });
    await internal.send({payload,dealNumber:number,
      previousDealId:i?number.slice(-6):null});
   }
   return {state:'ALL_IMPORT_ACKED_HOLD_NATIVE_READBACK',deal_number:number};
  }
 });
 const obj=createLot10Coordinator({quoteFn:quote,makeWorker,transport,preflight,
  allowProviderWrites:enabled,
  nativeOrderReadback:async ({dealNumber,dealId})=>({
   buyerId:'1234511',order:orderMutate(detail(dealNumber,dealId))
  }),
  nativeConsentReadback:async ({dealNumber,dealId})=>
   consentMutate({source:'GETCOURSE_NATIVE_ORDER_CONSENT_VERIFIED',
    deal_id:dealId,deal_number:dealNumber,consent_accepted:true})
 });
 return {obj,calls:()=>apiCalls};
}
test('R136 write transport is OFF by default, never calls provider, keeps public link NULL',async()=>{
 const x=deps({enabled:false});
 const r=await x.obj.start(body('a'));
 a.equal(r.ok,false);a.equal(r.code,'R136_PROVIDER_WRITE_DISABLED');
 a.equal(r.checkout_url,null);a.equal(x.calls(),0);
});
test('R136 detects any missing owner write key/order IDs/callback or unpaid QA proof',async()=>{
 for(const missing of REQUIRED){
  const x=deps({preflight:async()=>({...valid,[missing]:false})});
  const status=await x.obj.readiness();
  a.equal(status.ok,false);a.equal(x.calls(),0);
  const r=await x.obj.start(body('a'));
  a.equal(r.ok,false);a.equal(x.calls(),0);
 }
});
test('R136 five-position one unpaid order gives native payment URL without paid receipt',async()=>{
 const x=deps();const r=await x.obj.start(body('a'));
 a.equal(r.ok,true);a.equal(x.calls(),5);
 a.equal(r.order_total_rub,37820);a.equal(r.consent_verified,true);
 a.equal(r.public_release_allowed,true);a.equal(r.payment_verified,false);
 a.equal(r.receipt_verified,false);a.match(r.checkout_url,/^https:\/\/study\.shkola-dnv\.com\//);
});
test('R136 wrong positions, order total or native consent NEVER allow link',async()=>{
 for(const alter of [
 {orderMutate:o=>({...o,order_total_rub:1})},
 {orderMutate:o=>({...o,positions:o.positions.slice(0,4)})},
 {consentMutate:c=>({...c,consent_accepted:false})},
 {consentMutate:c=>({...c,deal_id:'wrong'})}
 ]){
  const x=deps(alter);const r=await x.obj.start(body('a'));
  a.equal(r.ok,false);a.equal(r.checkout_url,null);
 }
});
test('R136 bad buyer email, nonce, revision or idempotency never calls provider',async()=>{
 for(const changed of [
 {email:'bad @example.org'},{email:'bad@example.org\n'},
 {nonce:'abc'},{offerRevisionSha256:'x'},{idempotencyKey:'bad'}
 ]){
  const x=deps();const r=await x.obj.start({...body('a'),...changed});
  a.equal(r.ok,false);a.equal(x.calls(),0);
 }
});
test('R136 concurrent buyers maintain distinct native deal link capture',async()=>{
 const x=deps();
 const [one,two]=await Promise.all([x.obj.start(body('a')),x.obj.start(body('b'))]);
 a.equal(one.ok,true);a.equal(two.ok,true);
 a.equal(x.calls(),10);
 a.notEqual(one.deal_id,two.deal_id);
 a.notEqual(one.checkout_url,two.checkout_url);
});
