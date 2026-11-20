'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createOrderProvider}=require('./r166-lot12-native-order.cjs');
const {stateFor}=require('./r182-lot12-order-status.cjs');
const {buildLot12SetPlan}=require('./r154-lot12-set.cjs');
const H=s=>crypto.createHash('sha256').update(s).digest('hex');
const EMAIL='buyer@example.com',PHONE='+79991234567';
const selection={kind:'set',items:['dgs2','knopochka']};
function setup({phoneBound=true,link=true}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'r187-resume-'));
 const plan=buildLot12SetPlan({selection}),nonce='a'.repeat(64);
 const p=path.join(dir,H(EMAIL+'\n'+plan.plan_sha256)+'.json');
 const positions=plan.lines.map((l,i)=>({
  offer_id:l.offer_id,position_id:i+100,quantity:1,currency:'RUB',price_rub:l.discounted_line_price_rub
 }));
 const rec={state:'price_verified',deal_number:'285070227416268',deal_id:925063710,
  plan_sha256:plan.plan_sha256,total_rub:plan.desired_order_total_rub,
  positions_done:plan.lines.length,native_total_readback_verified:true,native_status:'new',
  verified_positions:positions,price_verified_at:new Date().toISOString(),
  nonce_sha256:H(nonce),buyer_email_sha256:H(EMAIL),
  ...(phoneBound?{buyer_phone_sha256:H(PHONE.replace(/\D/g,''))}:{}),
  ...(link?{provider_checkout_url:'https://study.shkola-dnv.com/sales/shop/deal?id=925063710&hash='+'a'.repeat(32)}:{})
 };
 fs.writeFileSync(p,JSON.stringify(rec),{mode:0o600});
 let providerCalls=0;
 const submit=createOrderProvider({ledgerDir:dir,fetchImpl:()=>{providerCalls++;throw Error('PROVIDER_CALLED_ON_RESUME')},
   keyProvider:async()=>{providerCalls++;throw Error('KEY_READ_ON_RESUME')}});
 return {dir,p,rec,submit,nonce,get calls(){return providerCalls}};
}
const request=(nonce,phone=PHONE)=>({selection,buyer:{email:EMAIL,name:'Test',phone},
 nonce,offer_agreement:true,privacy_agreement:true});
test('existing verified order with matching phone is resumed without new provider order',async()=>{
 const x=setup();const nonce='b'.repeat(64);
 const a=await x.submit(request(nonce));
 assert.equal(a.ok,true);assert.equal(a.replayed,true);
 assert.equal(a.deal_number,'285070227416268');assert.equal(x.calls,0);
 assert.equal(fs.readdirSync(x.dir).length,1);
 const state=stateFor({deal_number:a.deal_number,nonce},{ledgerDir:x.dir});
 assert.equal(state.http,200);assert.equal(state.data.price_verified,true);
 assert.equal(state.data.payment_ready,true);
 assert.equal(state.data.order_total_rub,x.rec.total_rub);
});
test('incorrect phone refuses existing order and does not call provider',async()=>{
 const x=setup();
 await assert.rejects(()=>x.submit(request('b'.repeat(64),'+79990000000')),
  e=>e.http===409&&e.message==='ORDER_ALREADY_SUBMITTED_CHECK_GETCOURSE');
 assert.equal(x.calls,0);
});
test('legacy record without phone binding cannot be hijacked with fresh nonce',async()=>{
 const x=setup({phoneBound:false});
 await assert.rejects(()=>x.submit(request('b'.repeat(64))),e=>e.http===409);
 assert.equal(x.calls,0);
});
test('original nonce can continue even before legacy phone binding',async()=>{
 const x=setup({phoneBound:false,link:false});
 const a=await x.submit(request(x.nonce));
 assert.equal(a.ok,true);assert.equal(a.replayed,true);
 assert.equal(x.calls,0);
});
