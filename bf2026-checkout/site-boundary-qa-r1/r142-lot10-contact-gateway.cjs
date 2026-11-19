'use strict';
/* R142: Server endpoint matching the already published R141 first-party form.
 * Zero provider network writes unless an authenticated, owner-approved
 * coordinator with native order readback and FULL buyer-contact support exists.
 * Import acknowledgements alone are NEVER payment-link proof.
 */
const crypto=require('node:crypto');
const {buildSetImportPlan}=require('./r130-set-lines.cjs');
const {exactPaymentUrl}=require('./r135-set-payment-link.cjs');
const PATH='/api/checkout/set/contact/start';
const MAX=4096;
function reply(res,code,payload){
 res.writeHead(code,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store, private','Pragma':'no-cache',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
 res.end(JSON.stringify(payload));
}
function deny(status,code){return [status,{ok:false,code,checkout_url:null,
 public_release_allowed:false}]}
function sha(x){return crypto.createHash('sha256').update(x).digest('hex')}
function validBuyer(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||
    Object.keys(x).sort().join(',')!=='email,name,phone')return null;
 if(['name','email','phone'].some(k=>typeof x[k]!=='string'))return null;
 const name=x.name,email=x.email.trim().toLowerCase(),phone=x.phone;
 const m=/^([\p{L}][\p{L}' -]{0,99})$/u;
 if(!m.test(name)||name.trim()!==name||!name.trim()||
  !/^[^@\s<>"']+@[^@\s<>"']+\.[a-zA-Z]{2,}$/.test(email)||email.length>190||
  !/^\+?[0-9 ()-]{9,25}$/.test(phone)||
  phone.replace(/\D/g,'').length<10||phone.replace(/\D/g,'').length>15)return null;
 const words=name.split(/\s+/);
 return Object.freeze({email,name,phone,
  first_name:words[0],last_name:words.slice(1).join(' ')});
}
function validateSubmission(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||
    Object.keys(x).sort().join('|')!==
     ['selection','buyer','offer_agreement','privacy_agreement','submission_id'].sort().join('|'))
  return null;
 if(x.offer_agreement!==true||x.privacy_agreement!==true||
    typeof x.submission_id!=='string'||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x.submission_id))return null;
 const buyer=validBuyer(x.buyer);if(!buyer)return null;
 return Object.freeze({buyer,selection:x.selection,submission_id:x.submission_id});
}
async function jsonBody(req){
 if(String(req.headers['content-type']||'').split(';')[0].trim()!=='application/json')
  throw Object.assign(Error('R142_JSON_REQUIRED'),{status:415});
 let chunks=[],size=0;
 for await(const x of req){size+=x.length;if(size>MAX)throw Object.assign(
   Error('R142_BODY_TOO_LARGE'),{status:413});chunks.push(x)}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function challenge(secret,input,plan){
 if(typeof secret!=='string'||secret.length<32)throw Error('R142_SERVER_CONSENT_SECRET_REQUIRED');
 const reqkey=sha('R142_SUBMISSION_ID_V1\0'+input.submission_id);
 const tag=crypto.createHmac('sha256',secret).update(
  JSON.stringify({submission_id:input.submission_id,email:input.buyer.email,
   plan_sha256:plan.plan_sha256,agreement:true,privacy:true})).digest('base64url');
 const revision=sha('R142_NATIVE_OFFER_REVISION_V1\0'+plan.plan_sha256);
 return {idempotencyKey:reqkey,nonce:tag,offerRevisionSha256:revision};
}
function createLot10ContactGateway({quoteFn,coordinator=null,consentKeyProvider=null,
 origin='https://wf.tati-lar.ru',clock=()=>Date.now()}={}){
 if(typeof quoteFn!=='function')throw Error('R142_QUOTE_DEPENDENCY_REQUIRED');
 async function readiness(){
  if(!coordinator||coordinator.supportsBuyerContact!==true||
     typeof coordinator.start!=='function'||typeof coordinator.readiness!=='function'||
     typeof consentKeyProvider!=='function')return false;
  let check,secret;
  try{[check,secret]=await Promise.all([coordinator.readiness(),consentKeyProvider()])}
  catch{return false}
  return check?.ok===true&&check.ready===true&&
   check.public_release_allowed===true&&typeof secret==='string'&&secret.length>=32;
 }
 async function start(x){
  // Entire PII processing is disabled before native provider capability proof.
  if(!await readiness())return deny(503,'R142_NATIVE_LOT10_BUYER_ORDER_BRIDGE_NOT_READY');
  const input=validateSubmission(x);
  if(!input)return deny(422,'R142_BUYER_AGREEMENT_OR_CONTACT_INVALID');
  let plan;
  try{plan=buildSetImportPlan({selection:input.selection,quoteFn})}
  catch{return deny(422,'R142_SET_SELECTION_INVALID')}
  if(plan.items_count<2||plan.items_count>5)
    return deny(422,'R142_ITEM_COUNT_INVALID');
  let derived;
  try{derived=challenge(await consentKeyProvider(),input,plan)}
  catch{return deny(503,'R142_CONSENT_CHALLENGE_UNAVAILABLE')}
  let result;
  try{result=await coordinator.start({
   selection:input.selection,buyer:input.buyer,email:input.buyer.email,
   ...derived,legalConsent:true,privacyConsent:true
  })}catch{return deny(503,'R142_PROVIDER_RESULT_UNKNOWN_RECONCILIATION')}
  if(result?.ok!==true||result.native_order_positions_verified!==true||
     result.consent_verified!==true||result.buyer_contact_native_verified!==true||
     result.public_release_allowed!==true||
     result.order_total_rub!==plan.desired_order_total_rub||
     !/^[0-9]{10,18}$/.test(String(result.deal_number||'')))
   return deny(503,'R142_UNPAID_NATIVE_ORDER_OR_CONSENT_NOT_VERIFIED');
  let url;
  try{url=exactPaymentUrl(result.checkout_url)}
  catch{return deny(503,'R142_GETCOURSE_PAYMENT_LINK_NOT_VERIFIED')}
  return [200,{ok:true,order_total_rub:plan.desired_order_total_rub,
   checkout_url:url,unpaid_order_native_verified:true,payment_verified:false,
   receipt_verified:false,access_grants_verified:false}];
 }
 async function handle(req,res,path){
  if(path!==PATH)return false;
  if(req.method!=='POST'){reply(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'});return true}
  if(req.headers.origin!==undefined&&req.headers.origin!==origin){
   reply(res,403,{ok:false,code:'ORIGIN_DENIED'});return true}
  if(!await readiness()){const [code,payload]=deny(503,'R142_NATIVE_LOT10_BUYER_ORDER_BRIDGE_NOT_READY');
    reply(res,code,payload);return true}
  let json;
  try{json=await jsonBody(req)}
  catch(e){reply(res,e.status||422,{ok:false,code:e.message==='R142_BODY_TOO_LARGE'?'R142_BODY_TOO_LARGE':'R142_INVALID_JSON'});return true}
  const [code,payload]=await start(json);reply(res,code,payload);return true;
 }
 return Object.freeze({handle,start,readiness});
}
module.exports={PATH,createLot10ContactGateway,validateSubmission,challenge};
