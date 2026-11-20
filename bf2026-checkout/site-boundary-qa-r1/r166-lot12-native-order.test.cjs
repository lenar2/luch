'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createOrderProvider}=require('./r166-lot12-native-order.cjs');
for(const size of [2,3,5,6,7]){
 test('R167 GetCourse multi-offer '+size+' choices, quote totals, no auto-payment, idempotence',async()=>{
  const choices=['rejection_program','dnv','union','trainer','source','dgs2','knopochka'].slice(0,size);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bf167-qa-'));
  const sent=[];
  const fake=async (_url,opts)=>{
   const post=new URLSearchParams(opts.body);
   const v=JSON.parse(Buffer.from(post.get('params'),'base64').toString('utf8'));
   sent.push(v);
   const fin=v.system.return_payment_link===1;
   return {status:200,text:async()=>JSON.stringify({success:true,action:'add',
    result:{success:true,error:false,deal_number:v.deal.deal_number,deal_id:719911,
     ...(fin?{payment_link:'https://study.shkola-dnv.com/pl/sales/pay?id=719911'}:{})}})};
  };
  const provider=createOrderProvider({ledgerDir:dir,fetchImpl:fake,
   keyProvider:async()=>crypto.randomBytes(48).toString('hex')});
  const input={selection:{kind:'set',items:choices,source_variant:choices.includes('source')?'2':undefined},
   buyer:{email:'qa'+size+'@example.invalid',name:'Тестовый Пользователь',phone:'+79991234567'},
   nonce:crypto.randomBytes(40).toString('hex'),offer_agreement:true,privacy_agreement:true};
  if(!choices.includes('source'))delete input.selection.source_variant;
  const first=await provider(input);
  assert.equal(first.ok,true);assert.equal(sent.length,size);
  assert.equal(sent.filter(x=>x.system.multiple_offers===0).length,1);
  assert.equal(sent.at(-1).system.return_payment_link,1);
  assert.equal(sent.every(x=>x.deal.deal_is_paid===0),true);
  assert.equal(sent.reduce((a,x)=>a+x.deal.deal_cost,0),first.order_total_rub);
  const again=await provider(input);assert.equal(again.replayed,true);
  assert.equal(sent.length,size);
 });
}
test('R167 declines missing consent without contacting provider',async()=>{
 let calls=0;const provider=createOrderProvider({fetchImpl:async()=>{calls++}});
 await assert.rejects(()=>provider({offer_agreement:false}),/CONSENT_REQUIRED/);
 assert.equal(calls,0);
});
