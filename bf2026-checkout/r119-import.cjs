'use strict';
// R119 experimental /pl/api/deals import plan. NOT live commerce (official GetCourse import-only warning).
const path=require('node:path');
const MAP={rejection:8934973,devaluation:8934925,self:8934974,guilt:8934979,rejection_program:8933492,dnv:8934207,union:8919715,trainer:8934247,source:{'1':8934262,'2':8934987}};
const fail=s=>{const e=new Error(s);e.code=s;throw e};
function trustedServer(){
 const target=process.env.BF_R109_SERVER;
 if(typeof target!=='string'||!path.isAbsolute(target))fail('TRUSTED_R109_SERVER_PATH_REQUIRED');
 const server=require(target);
 if(typeof server.compute!=='function'||typeof server.checkoutKey!=='function')fail('TRUSTED_R109_SERVER_INTERFACE_REQUIRED');
 return server;
}
function plan(selection,email,key){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email||'')||!/^[0-9a-f]{32,64}$/.test(key||''))fail('INVALID_IDENTITY');
 const {compute,checkoutKey}=trustedServer();
 const q=compute(selection);
 if(q.kind!=='set')fail('ONLY_SET_ALLOWED');
 let sum=0;
 const lines=q.items.map((i,n)=>{
  const id=i.key==='source'?MAP.source[i.variant]:MAP[i.key];
  if(!Number.isSafeInteger(id))fail('MISSING_NATIVE_OFFER');
  const amount=n===q.items.length-1?q.total_rub-sum:Math.floor(i.base_price_rub*q.total_rub/q.subtotal_rub/10)*10;
  if(amount<=0||amount>i.base_price_rub)fail('INVALID_ALLOCATION');
  sum+=amount;return {offer_id:id,amount_rub:amount};
 });
 if(sum!==q.total_rub||new Set(lines.map(x=>x.offer_id)).size!==lines.length)fail('INVALID_TOTAL');
 return {schema:'bf2026.r119.import-candidate',selection_key:checkoutKey(q),total_rub:q.total_rub,subtotal_rub:q.subtotal_rub,email,key,lines,live_enabled:false};
}
function request(p,index,secret,providerNumber){
 if(p?.schema!=='bf2026.r119.import-candidate'||p.live_enabled!==false)fail('UNTRUSTED');
 if(!Number.isInteger(index)||index<0||index>=p.lines.length||!secret||secret.length<16)fail('BAD_REQUEST');
 if(index>0&&!/^\d{1,20}$/.test(providerNumber||''))fail('PROVIDER_ORDER_NUMBER_REQUIRED');
 if(index===0&&providerNumber!==undefined)fail('FIRST_REQUEST_NEW_ORDER_ONLY');
 const line=p.lines[index];
 const payload={user:{email:p.email},system:{refresh_if_exists:0,multiple_offers:index?1:0,return_payment_link:index===p.lines.length-1?1:0,return_deal_number:1},deal:{offer_id:line.offer_id,deal_cost:line.amount_rub,quantity:1,deal_status:'new',deal_is_paid:0,deal_currency:'RUB',...(index?{deal_number:providerNumber}:{})}};
 return {url:'https://study.shkola-dnv.com/pl/api/deals',method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action:'add',key:secret,params:Buffer.from(JSON.stringify(payload)).toString('base64')}).toString(),network_invoked:false};
}
module.exports={MAP,plan,request};
