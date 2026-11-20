'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {DEFAULTS,createGetCourseExportReader,normalizeDeal}=require('./getcourse-export-readback.cjs');
function fakeBudget(){let outstanding=null,count=0;return {
 async claimStart(){if(outstanding)throw Object.assign(Error(),{code:'GETCOURSE_EXPORT_ALREADY_IN_PROGRESS'});outstanding='CREATING';count++},
 async markExport(id){assert.equal(outstanding,'CREATING');outstanding=id},
 async claimPoll(id){if(outstanding!==id)throw Object.assign(Error(),{code:'GETCOURSE_EXPORT_LEASE_MISMATCH'});count++},
 async complete(id){assert.equal(outstanding,id);outstanding=null},
 async releaseCreating(){outstanding=null},
 snapshot(){return {outstanding,count}}
}}
function response(body){return {ok:true,status:200,async text(){return JSON.stringify(body)}}}
test('R122 GetCourse Export API is GET-only, scoped to QA buyer, no key disclosure',async()=>{
 const budget=fakeBudget(),calls=[];
 const deal={id:'924624456',deal_number:'71994',user_id:'524210421',offers:'8935004',
  cost_money_value:'11690',status:'new',payed_money:'0'};
 const fetchImpl=async(url,opts)=>{const u=new URL(url);calls.push({u,opts});
  if(u.pathname.endsWith('/deals'))return response({success:true,result:{export_id:'deal_exp_1'}});
  return response({success:true,result:{status:'completed',rows:[deal]}});
 };
 const reader=createGetCourseExportReader({apiKeyProvider:async()=>'A'.repeat(32),
  budget,fetchImpl,pollDelayMs:0});
 const out=await reader.readBundleOrderAndPayment();
 assert.equal(out.state,'VERIFIED_UNPAID_ORDER');
 assert.equal(out.deal_id,'924624456');assert.equal(out.offer_id,8935004);
 assert.equal(out.order_total_rub,11690);assert.equal(out.paid_total_rub,0);
 assert.equal(out.receipt_verified,false);assert.equal(out.grants_verified,false);
 assert.equal(calls.length,2);
 for(const c of calls){assert.equal(c.opts.method,'GET');assert.equal(c.opts.redirect,'error');
  assert.equal(c.u.hostname,'study.shkola-dnv.com');assert.equal(c.u.searchParams.get('key'),'A'.repeat(32));}
 assert.equal(calls[0].u.searchParams.get('user_id'),'524210421');
 assert.equal(budget.snapshot().outstanding,null);
});
test('R122 paid order requires matching accepted payment export; no receipt/grant inference',async()=>{
 const budget=fakeBudget(),calls=[];
 const deal={id:'924624456',deal_number:'71994',user_id:'524210421',offers:'8935004',
  cost_money_value:11690,status:'payed',payed_money:11690,payed_at:'2026-11-19 10:30:00'};
 const payment={id:'pay_1',deal_id:'924624456',status:'accepted',amount:11690};
 const fetchImpl=async(url,opts)=>{const u=new URL(url);calls.push(u);
  if(u.pathname.endsWith('/deals'))return response({result:{export_id:'deal_exp_2'}});
  if(u.pathname.endsWith('/payments'))return response({result:{export_id:'pay_exp_2'}});
  if(u.pathname.endsWith('/deal_exp_2'))return response({result:{rows:[deal]}});
  return response({result:{rows:[payment]}});
 };
 const reader=createGetCourseExportReader({apiKeyProvider:async()=>'B'.repeat(32),budget,fetchImpl,pollDelayMs:0});
 const out=await reader.readBundleOrderAndPayment();
 assert.equal(out.state,'PAYMENT_RECORD_MATCHED');
 assert.equal(out.payment_record_verified,true);assert.equal(out.payment_amount_rub,11690);
 assert.equal(out.receipt_verified,false);assert.equal(out.grants_verified,false);
 assert.equal(calls.length,4);
 assert.equal(calls[2].searchParams.get('created_at[from]'),'2026-11-19');
 assert.equal(calls[2].searchParams.get('created_at[to]'),'2026-11-19');
});
test('R122 fails closed for missing key, redirect, wrong host, wrong identity, amount or offer',async()=>{
 const b=fakeBudget();let calls=0;
 const noKey=createGetCourseExportReader({budget:b,fetchImpl:async()=>{calls++}});
 await assert.rejects(noKey.readBundleOrderAndPayment(),{code:'GETCOURSE_API_KEY_NOT_CONFIGURED'});
 assert.equal(calls,0);
 const reader=createGetCourseExportReader({apiKeyProvider:async()=>'C'.repeat(32),budget:fakeBudget(),
  fetchImpl:async()=>({ok:false,status:302,text:async()=>''})});
 await assert.rejects(reader.readBundleOrderAndPayment(),{code:'GETCOURSE_EXPORT_HTTP_302'});
 for(const mutate of [
  r=>r.id='wrong',r=>r.offers='8934207',r=>r.cost_money_value=12990,r=>r.user_id='999'
 ]){
  const row={id:'924624456',deal_number:'71994',user_id:'524210421',offers:'8935004',cost_money_value:11690,status:'new',payed_money:0};
  mutate(row);assert.throws(()=>normalizeDeal(row),{code:/GETCOURSE_DEAL_/});
 }
});
test('R122 refuses broad export filters and wrong payment amount',async()=>{
 const reader=createGetCourseExportReader({apiKeyProvider:async()=>'D'.repeat(32),budget:fakeBudget(),fetchImpl:async()=>response({result:{export_id:'x'}})});
 await assert.rejects(reader.readBundleOrderAndPayment(),{code:'GETCOURSE_EXPORT_RESPONSE_SHAPE_UNKNOWN'});
 await assert.rejects(reader.startExport('deals',{user_id:'1'}),{code:'GETCOURSE_EXPORT_DEAL_SCOPE_MUST_BE_QA_BUYER'});
});
