'use strict';
/* BF2026 Lot12 R166: owner-authorized buyer-initiated GetCourse Import API
 * multi-offer creation. One native order, 2..7 sequential positions, no paid flag.
 * No surprise "preflight" veto; explicit provider errors reported to buyer.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {buildLot12SetPlan}=require('./r154-lot12-set.cjs');
const {normalizeImportAck,generateDealNumber}=require('./r130-getcourse-import.cjs');
const {exactPaymentUrl}=require('./r135-set-payment-link.cjs');
const {secureRead}=require('./r141-server-key.cjs');
const ACCOUNT='study.shkola-dnv.com';
const ENDPOINT='https://'+ACCOUNT+'/pl/api/deals';
const KEY_PATH='/app/secrets/getcourse_import.key';
const LEDGER_DIR='/tmp/bf2026-lot12-r166-orders';
const EMAIL=/^[^@\s<>"']+@[^@\s<>"']+\.[a-z]{2,}$/i;
const PHONE=/^\+?[0-9()\s-]{10,35}$/;
const NAME=/^[\p{L}' \-]{2,120}$/u;
const NONCE=/^[a-zA-Z0-9_-]{32,110}$/;
const truth=v=>v===true||v==='true';
function fail(code,http=422){const e=Error(code);e.http=http;return e;}
function contact(v){
 if(!v||typeof v!=='object'||Array.isArray(v))throw fail('BUYER_INVALID');
 const email=String(v.email||'').trim().toLowerCase();
 const name=String(v.name||'').trim().replace(/\s+/g,' ');
 const phone=String(v.phone||'').trim();
 if(email.length>254||!EMAIL.test(email)||!NAME.test(name)||!PHONE.test(phone)||
    phone.replace(/\D/g,'').length<10||phone.replace(/\D/g,'').length>15)
    throw fail('BUYER_INVALID');
 const pieces=name.split(' ');
 return {email,name,phone,first_name:pieces[0],last_name:pieces.slice(1).join(' ')};
}
function readRec(p){try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e}}
function saveRec(p,v){
 const tmp=p+'.tmp-'+process.pid+'-'+crypto.randomBytes(5).toString('hex');
 fs.writeFileSync(tmp,JSON.stringify(v),{mode:0o600,flag:'wx'});
 fs.renameSync(tmp,p);
}
function providerCode(json){
 const str=String(json?.error_code??json?.error??json?.result?.error_code??json?.result?.error_message??'UNKNOWN');
 return /^[0-9]{3}$/.test(str)?'GETCOURSE_'+str:'GETCOURSE_DECLINED';
}
function providerLink(json){
 const raw=json?.result?.payment_link??null;
 if(!raw)return null;
 try{return exactPaymentUrl(raw)}catch{return null}
}
function createOrderProvider({fetchImpl=globalThis.fetch,keyProvider=()=>secureRead(KEY_PATH),ledgerDir=LEDGER_DIR}={}){
 return async function order({selection,buyer,nonce,offer_agreement,privacy_agreement}={}){
  if(offer_agreement!==true||privacy_agreement!==true)throw fail('CONSENT_REQUIRED');
  if(!NONCE.test(nonce||''))throw fail('INVALID_NONCE');
  const who=contact(buyer);
  const plan=buildLot12SetPlan({selection});
  if(plan.items_count<2||plan.items_count>7)throw fail('INVALID_COUNT');
  fs.mkdirSync(ledgerDir,{recursive:true,mode:0o700});
  const signature=crypto.createHash('sha256').update(who.email+'\n'+plan.plan_sha256).digest('hex');
  const recordPath=path.join(ledgerDir,signature+'.json');
  let rec=readRec(recordPath);
  if(rec&&['complete','created_requires_price_readback'].includes(rec.state)&&rec.total_rub===plan.desired_order_total_rub)
    return {ok:true,order_submitted:true,deal_number:rec.deal_number,
      quoted_total_rub:rec.total_rub,checkout_url:null,public_release_allowed:false,
      native_total_readback_verified:false,replayed:true,
      message:'Заказ создан, но скидка в GetCourse не подтверждена. Оплата недоступна до корректировки суммы.'};
  if(rec)throw fail('ORDER_ALREADY_SUBMITTED_CHECK_GETCOURSE',409);
  const dealNumber=generateDealNumber();
  const state={state:'created',deal_number:dealNumber,plan_sha256:plan.plan_sha256,
    total_rub:plan.desired_order_total_rub,positions_done:0,
    started_at:new Date().toISOString(),nonce_sha256:crypto.createHash('sha256').update(nonce).digest('hex')};
  // Persistent exclusive reservation: do not create a second native Deal if duplicate request races.
  fs.writeFileSync(recordPath,JSON.stringify(state),{mode:0o600,flag:'wx'});
  let key;
  try{key=await keyProvider();if(typeof key!=='string'||key.length<64)throw Error('NO_CREDENTIAL')}
  catch{fs.unlinkSync(recordPath);throw fail('GETCOURSE_CREDENTIAL_UNAVAILABLE',503)}
  let lastId=null,lastLink=null;
  for(let i=0;i<plan.lines.length;i++){
   const line=plan.lines[i];
   const payload={
    user:{email:who.email,phone:who.phone,first_name:who.first_name,last_name:who.last_name},
    system:{refresh_if_exists:0,multiple_offers:i===0?0:1,return_payment_link:i===plan.lines.length-1?1:0,return_deal_number:1},
    deal:{deal_number:dealNumber,offer_id:line.offer_id,quantity:1,
     deal_cost:line.discounted_line_price_rub,deal_status:'new',deal_is_paid:0,deal_currency:'RUB',
     addfields:{'BF2026 Consent Nonce':nonce,'BF2026 Offer Revision SHA256':plan.plan_sha256}}
   };
   state.state='provider_request_inflight';state.step=i;saveRec(recordPath,state);
   let json;
   try{
    const res=await fetchImpl(ENDPOINT,{method:'POST',redirect:'error',
     headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},
     body:new URLSearchParams({action:'add',key,params:Buffer.from(JSON.stringify(payload)).toString('base64')}).toString(),
     signal:AbortSignal.timeout(9000)});
    if(res.status!==200)throw Error('PROVIDER_HTTP_'+res.status);
    const raw=await res.text();if(raw.length>16000)throw Error('RESPONSE_TOO_LARGE');
    json=JSON.parse(raw);
   }catch(e){state.state='unknown_provider_outcome';state.reason=e.message.slice(0,70);saveRec(recordPath,state);
    throw fail('GETCOURSE_CONNECTION_UNKNOWN_CHECK_ORDER',502)}
   if(!truth(json?.success)||!truth(json?.result?.success)){
    state.state='provider_rejected';state.reason=providerCode(json);
    if(i===0)fs.unlinkSync(recordPath); else saveRec(recordPath,state);
    throw fail(state.reason,502);
   }
   let ack;
   try{ack=normalizeImportAck(json,{dealNumber,previousDealId:lastId});}
   catch{state.state='unknown_provider_identity';saveRec(recordPath,state);
    throw fail('GETCOURSE_ORDER_RESPONSE_UNEXPECTED',502)}
   lastId=ack.deal_id;state.positions_done=i+1;
   state.state='position_imported';state.deal_id=lastId;saveRec(recordPath,state);
   if(i===plan.lines.length-1)lastLink=providerLink(json);
  }
  // Empirical native QA #72005/#72006: Import API ACK did not preserve per-line
  // discounts after multiple_offers append. Do not expose an overcharging link.
  state.state='created_requires_price_readback';
  state.provider_link_existed=!!lastLink;state.checkout_url=null;
  saveRec(recordPath,state);
  return {ok:true,order_submitted:true,checkout_url:null,deal_number:dealNumber,
   quoted_total_rub:plan.desired_order_total_rub,
   native_total_readback_verified:false,public_release_allowed:false,
   message:'Заказ создан в GetCourse. Сумма и скидка требуют сверки перед оплатой.'};
 };
}
function createLot12OrderRouter({createOrder=createOrderProvider(),origin='https://wf.tati-lar.ru'}={}){
 return async function handle(req,res){
  const respond=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(data));};
  if(req.method!=='POST')return respond(405,{ok:false,code:'METHOD_NOT_ALLOWED'});
  if(req.headers.origin!==origin)return respond(403,{ok:false,code:'ORIGIN_DENIED'});
  if(String(req.headers['content-type']||'').split(';')[0].trim()!=='application/json')
   return respond(415,{ok:false,code:'JSON_REQUIRED'});
  try{
   let raw='',bytes=0;
   for await(const part of req){bytes+=part.length;if(bytes>4096)throw fail('BODY_TOO_LARGE');raw+=part.toString('utf8')}
   const data=JSON.parse(raw);
   if(!data||typeof data!=='object'||Array.isArray(data)||
    Object.keys(data).some(k=>!['selection','buyer','nonce','offer_agreement','privacy_agreement'].includes(k)))
     throw fail('INVALID_BODY');
   const result=await createOrder(data);
   return respond(200,result);
  }catch(e){return respond(e.http||500,{ok:false,code:e.message,checkout_url:null,order_created:false})}
 };
}
module.exports={createOrderProvider,createLot12OrderRouter};
