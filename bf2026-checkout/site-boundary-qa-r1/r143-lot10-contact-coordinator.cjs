'use strict';
/* R143: 2–5 Offer native GetCourse checkout buyer-contact bridge.
 * The R130 ledger owns idempotency; the R136 coordinator owns final link
 * and native unpaid-order readback. R143 adds full buyer first/last/phone
 * to the ACTUAL provider create-order payload and independently verifies
 * native GetCourse order-to-buyer contact before forwarding a payment URL.
 *
 * Does not itself call GetCourse and defaults network writes OFF.
 */
const {AsyncLocalStorage}=require('node:async_hooks');
const {createLot10Coordinator}=require('./r136-lot10-order-coordinator.cjs');
const ACCOUNT='study.shkola-dnv.com';
const EMAIL=/^[^\s@<>"']+@[^\s@<>"']+\.[a-zA-Z]{2,}$/;
const NAME=/^[\p{L}' -]{1,90}$/u;
const PHONE=/^\+?[0-9 ()-]{9,28}$/;
function fail(code){const e=Error(code);e.code=code;throw e}
function checkBuyer(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
  !['email','name','phone','first_name','last_name'].every(k=>typeof input[k]==='string'))
  fail('R143_BUYER_CONTACT_MISSING');
 const {email,name,phone,first_name,last_name}=input;
 if(!EMAIL.test(email)||email!==email.toLowerCase().trim()||
    !NAME.test(first_name)||!NAME.test(last_name)||
    !NAME.test(name)||name!==name.trim()||!NAME.test(first_name+' '+last_name)||
    name!==first_name+' '+last_name||
    !PHONE.test(phone)||phone.replace(/\D/g,'').length<10||
    phone.replace(/\D/g,'').length>15)
  fail('R143_BUYER_CONTACT_INVALID');
 return Object.freeze({email,name,phone,first_name,last_name});
}
function validateNativeBuyerContact(readback,{buyer,dealNumber,dealId}){
 return !!readback&&readback.source==='GETCOURSE_AUTHORIZED_NATIVE_BUYER_ORDER_CONTACT'&&
  readback.account_host===ACCOUNT&&
  String(readback.deal_number)===String(dealNumber)&&
  String(readback.deal_id)===String(dealId)&&
  Number.isSafeInteger(Number(readback.user_id))&&Number(readback.user_id)>0&&
  readback.email===buyer.email&&readback.first_name===buyer.first_name&&
  readback.last_name===buyer.last_name&&
  typeof readback.phone==='string'&&
  readback.phone.replace(/\D/g,'')===buyer.phone.replace(/\D/g,'')&&
  readback.legal_consent_native_order_verified===true;
}
function createContactCoordinator({quoteFn,makeWorker,transport,preflight,
 nativeOrderReadback,nativeConsentReadback,nativeBuyerContactReadback,
 allowProviderWrites=false}={}){
 if(typeof transport?.send!=='function'||typeof nativeBuyerContactReadback!=='function')
  fail('R143_NATIVE_CONTACT_READBACK_AND_TRANSPORT_REQUIRED');
 const context=new AsyncLocalStorage();
 const annotated={
  async send(args){
   const state=context.getStore(),payload=args?.payload;
   if(!state||!payload||!payload.user||payload.deal?.deal_is_paid!==0)
    fail('R143_PROVIDER_WRITE_OUTSIDE_VALIDATED_BUYER_CONTEXT');
   const buyer=state.buyer;
   if(payload.user.email!==buyer.email)
    fail('R143_PROVIDER_EMAIL_MISMATCH');
   const nativeUser={...payload.user,first_name:buyer.first_name,
    last_name:buyer.last_name,phone:buyer.phone};
   return transport.send({...args,payload:{...payload,user:nativeUser}});
  }
 };
 const underlying=createLot10Coordinator({quoteFn,makeWorker,
  transport:annotated,preflight,nativeOrderReadback,
  nativeConsentReadback,allowProviderWrites});
 return Object.freeze({
  supportsBuyerContact:true,
  readiness:underlying.readiness,
  async start(input={}){
   let buyer;
   try{buyer=checkBuyer(input.buyer)}
   catch{return Object.freeze({ok:false,code:'R143_BUYER_INVALID',checkout_url:null})}
   if(input.legalConsent!==true||input.privacyConsent!==true||
     input.email!==buyer.email)
    return Object.freeze({ok:false,code:'R143_CONSENT_OR_EMAIL_INVALID',checkout_url:null});
   return context.run({buyer},async()=>{
    let r;
    try{r=await underlying.start(input)}
    catch{return Object.freeze({ok:false,code:'R143_NATIVE_ORDER_UNKNOWN',checkout_url:null})}
    if(r?.ok!==true)return r;
    let native;
    try{native=await nativeBuyerContactReadback({
      dealNumber:r.deal_number,dealId:r.deal_id,
      buyer:buyer.email,accountHost:ACCOUNT
    })}catch{
      return Object.freeze({ok:false,code:'R143_NATIVE_CONTACT_READBACK_UNAVAILABLE',
       checkout_url:null});
    }
    if(!validateNativeBuyerContact(native,{buyer,dealNumber:r.deal_number,dealId:r.deal_id}))
      return Object.freeze({ok:false,code:'R143_NATIVE_BUYER_CONTACT_UNVERIFIED',
       checkout_url:null});
    return Object.freeze({...r,buyer_contact_native_verified:true});
   });
  }
 });
}
module.exports={checkBuyer,validateNativeBuyerContact,createContactCoordinator};
