'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const {buildSetImportPlan}=require('/srv/factory-scratch/bf2026-r118-relay-stage-20261119/site-boundary-qa-r1/r130-set-lines.cjs');
const quote={kind:'set',currency:'RUB',count:5,pricing_version:'BF2026_LOT10_CUSTOM_SET_R107',
 subtotal_rub:58190,discount_percent:35,total_rub:37820,savings_rub:20370,
 items:[
  {key:'rejection_program',site_lot:5,variant:null,base_price_rub:6990},
  {key:'dnv',site_lot:6,variant:null,base_price_rub:7200},
  {key:'union',site_lot:7,variant:null,base_price_rub:6000},
  {key:'trainer',site_lot:8,variant:null,base_price_rub:28000},
  {key:'source',site_lot:9,variant:'2',base_price_rub:10000}
 ]};
const {exactPaymentUrl,finalPaymentPayload,encodePostBody,normalizeStepResponse,
 createPaymentLinkTransport,releaseAfterNativeOrderReadback}=require('./r135-set-payment-link.cjs');
const KEY='TEST_ONLY_'+'a'.repeat(64);
const DEAL='812345678901234',ID='991301',BUYER='991302';
const selection={kind:'set',items:['rejection_program','union','trainer','source','dnv'],source_variant:'2'};
const plan=buildSetImportPlan({selection,quoteFn:()=>quote});
const base={dealNumber:DEAL,email:'buyer@example.org',nonce:'A'.repeat(43),offerRevisionSha256:'b'.repeat(64)};
const payment='https://study.shkola-dnv.com/pl/lite/pay/order?deal=991301';
const ack=(link)=>({success:true,action:'add',result:{
 success:true,deal_number:DEAL,deal_id:ID,user_id:BUYER,...(link?{payment_link:link}:{})
}});
const rb={source:'GETCOURSE_AUTHORIZED_NATIVE_READ_ONLY_ORDER',
 account_host:'study.shkola-dnv.com',deal_number:DEAL,deal_id:ID,user_id:BUYER,
 order_status:'new',positions:plan.lines.map(l=>({offer_id:l.offer_id,
 quantity:1,price_rub:l.discounted_line_price_rub})),
 order_total_rub:plan.desired_order_total_rub,native_order_receipt_count:0};
const consent={source:'GETCOURSE_NATIVE_ORDER_CONSENT_VERIFIED',
 deal_id:ID,deal_number:DEAL,consent_accepted:true};
test('R135 official 5-step GetCourse Import plan requests final link ONLY on the fifth append',()=>{
 a.equal(plan.desired_order_total_rub,37820);
 for(let i=0;i<5;i++){
  const payload=finalPaymentPayload({...base,line:plan.lines[i],index:i,total:5});
  a.equal(payload.system.multiple_offers,i===0?0:1);
  a.equal(payload.system.return_payment_link,i===4?1:0);
  a.equal(payload.deal.deal_number,DEAL);
  a.equal(payload.deal.deal_cost,plan.lines[i].discounted_line_price_rub);
  a.equal(payload.deal.deal_is_paid,0);
  a.equal(payload.deal.deal_status,'new');
  const encoded=encodePostBody(payload,KEY);
  const actual=JSON.parse(Buffer.from(new URLSearchParams(encoded).get('params'),'base64'));
  a.deepEqual(actual,payload);
 }
 const trainer=plan.lines.find(l=>l.offer_id===8934247);
 a.deepEqual(trainer.access.map(x=>x.training_id),[935051957]);
 const source=plan.lines.find(l=>l.offer_id===8934987);
 a.deepEqual(source.access.map(x=>x.training_id),[934905122,934905123]);
});
test('R135 final provider ACK link verified, no claim that buyer paid',()=>{
 const first=normalizeStepResponse(ack(),{dealNumber:DEAL});
 a.equal(first.provisional_payment_link,null);
 const last=normalizeStepResponse(ack(payment),{dealNumber:DEAL,previousDealId:ID,isFinal:true});
 a.equal(last.provisional_payment_link,payment);
 a.equal(last.payment_verified,false);
 a.equal(last.native_order_total_verified,false);
 a.throws(()=>normalizeStepResponse(ack(payment),{dealNumber:DEAL}),{code:'R135_PRE_FINAL_LINK_EXPOSURE_NOT_ALLOWED'});
 for(const wrong of [
 'http://study.shkola-dnv.com/pl/lite/pay','https://study.shkola-dnv.com.evil.tld/pl/lite/pay',
 'https://evil.example/pl/lite/pay','https://study.shkola-dnv.com/#x',
 'https://user:pass@study.shkola-dnv.com/pl/lite/pay',
 'https://study.shkola-dnv.com/other','javascript:alert(1)'
 ])a.throws(()=>exactPaymentUrl(wrong));
 a.throws(()=>normalizeStepResponse(ack(),{dealNumber:DEAL,isFinal:true}),{code:'R135_PAYMENT_URL_MISSING'});
});
test('R135 release requires correct unpaid native GetCourse order positions and consent, not actual PAYMENT',()=>{
 const last=normalizeStepResponse(ack(payment),{dealNumber:DEAL,previousDealId:ID,isFinal:true});
 const opts={plan,dealNumber:DEAL,dealId:ID,buyerId:BUYER,readback:rb,
  finalAck:last,consentAttestation:consent};
 const good=releaseAfterNativeOrderReadback(opts);
 a.equal(good.ok,true);
 a.equal(good.checkout_url,payment);
 a.equal(good.native_order_positions_verified,true);
 a.equal(good.order_total_rub,37820);
 a.equal(good.payment_verified,false);
 a.equal(good.receipt_verified,false);
 a.equal(good.access_after_pay_days,365);
 for(const altered of [
 {readback:{...rb,order_total_rub:37821}},
 {readback:{...rb,positions:rb.positions.slice(0,4)}},
 {readback:{...rb,positions:rb.positions.map((x,i)=>i===0?{...x,price_rub:x.price_rub-1}:x)}},
 {readback:{...rb,user_id:'invalid'}},
 {readback:{...rb,source:'UNVERIFIED_BROWSER_CLAIM'}},
 {consentAttestation:{...consent,consent_accepted:false}},
 {consentAttestation:{...consent,deal_id:'wrong'}},
 {finalAck:{...last,deal_id:'wrong'}}
 ]) {
  const bad=releaseAfterNativeOrderReadback({...opts,...altered});
  a.equal(bad.ok,false);a.equal(bad.checkout_url,null);
 }
});
test('R135 network transport disabled without confirmed owner opt-in',async()=>{
 let requests=0;
 const tr=createPaymentLinkTransport({keyProvider:()=>KEY,fetchImpl:async()=>{requests++;return {status:200}}});
 await a.rejects(tr.send({}),{code:'R135_PROVIDER_NETWORK_DISABLED'});
 a.equal(requests,0);
});
test('R135 isolated loopback HTTP fixture validates final link; NOT GetCourse live order',async()=>{
 const http=require('node:http');
 let calls=0;const received=[];
 const server=http.createServer(async(req,res)=>{
  let body='';for await (const part of req)body+=part;
  const data=new URLSearchParams(body);
  const payload=JSON.parse(Buffer.from(data.get('params'),'base64').toString());
  received.push(payload);
  calls++;res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify(ack(payload.system.return_payment_link===1?payment:null)));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const addr=server.address();
 const tr=createPaymentLinkTransport({keyProvider:()=>KEY,allowProviderNetwork:true,
  fetchImpl:async(url,options)=>fetch('http://127.0.0.1:'+addr.port+'/',options)});
 try{
  for(let i=0;i<plan.lines.length;i++){
   const payload=finalPaymentPayload({...base,line:plan.lines[i],index:i,total:5});
   const response=await tr.send({payload,dealNumber:DEAL,previousDealId:i?ID:null,isFinal:i===4});
   a.equal(response.deal_id,ID);
   a.equal(response.provisional_payment_link,i===4?payment:null);
  }
  a.equal(calls,5);a.deepEqual(received.map(p=>p.system.multiple_offers),[0,1,1,1,1]);
  a.deepEqual(received.map(p=>p.system.return_payment_link),[0,0,0,0,1]);
  a.equal(received.reduce((t,p)=>t+p.deal.deal_cost,0),37820);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
