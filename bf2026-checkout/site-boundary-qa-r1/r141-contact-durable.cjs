'use strict';
/*
 * R141 -- durable, fail-closed R137 branded contact checkout adapter.
 * Works for one existing fixed GetCourse Offer; dynamic Lot10 remains isolated
 * in R130/R136, never substituted by a single "bundle" or fake offer.
 * Postgres is not required: one durable request record per idempotency key,
 * O_EXCL claim, fsync before each external POST, no unsafe retry on restart.
 * Public network OFF until independent provider/consent/realtime proof.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SCHEMA='bf2026.r141.contact-durable.v1';
const REQUIRED=['owner_approved','getcourse_write_key_verified','getcourse_account_verified',
  'native_order_fields_verified','native_provider_order_creation_verified',
  'provider_order_notifications_approved','native_consent_enforced',
  'native_order_readback_available','provider_payment_url_verified'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function error(code){const e=Error(code);e.code=code;throw e}
function sha(s){return crypto.createHash('sha256').update(s).digest('hex')}
function hmac(secret,s){return crypto.createHmac('sha256',secret).update(s).digest('hex')}
function deny(code,status=503){return [status,{ok:false,code,checkout_url:null,public_release_allowed:false}]}
function allowedKey(k){return typeof k==='string'&&/^[A-Za-z0-9_-]{32,512}$/.test(k)}
function canonicalDetails({selection,buyer,quote,offers}){
 const lot=selection.lot,k=lot===9?'9:'+selection.variant:String(lot);
 const spec=offers[k];
 if(!spec||lot===12||lot===10||lot===11||lot<1||lot>9||
   selection.kind!=='single'||(lot!==9&&selection.variant!==undefined)||
   !Number.isSafeInteger(quote.total_rub)||quote.total_rub!==spec[1]||
   quote.kind!=='single'||quote.items?.length!==1||
   quote.items[0]?.site_lot!==lot)
   error('R141_OFFER_OR_QUOTE_MISMATCH');
 return {key:k,offer_id:spec[0],total_rub:spec[1],buyer_email:buyer.email.toLowerCase()};
}
function auditDir(dir,uid=process.getuid()){
 if(!path.isAbsolute(dir))error('R141_LEDGER_DIR_NOT_ABSOLUTE');
 const s=fs.lstatSync(dir);
 if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==uid||
   (s.mode&0o077)!==0)error('R141_LEDGER_DIR_UNTRUSTED');
}
function atomicReplace(filename,json){
 const data=JSON.stringify(json);
 if(Buffer.byteLength(data)>4096)error('R141_LEDGER_ENTRY_TOO_BIG');
 const tmp=filename+'.'+crypto.randomBytes(10).toString('hex')+'.tmp';
 let fd;
 try{
  fd=fs.openSync(tmp,'wx',0o600);fs.writeFileSync(fd,data);fs.fsyncSync(fd);fs.closeSync(fd);fd=null;
  fs.renameSync(tmp,filename);
  const dfd=fs.openSync(path.dirname(filename),'r');try{fs.fsyncSync(dfd)}finally{fs.closeSync(dfd)}
 }finally{if(fd!==undefined&&fd!==null)fs.closeSync(fd);
  try{fs.unlinkSync(tmp)}catch{}}
}
function claim(filename,json){
 const bytes=JSON.stringify(json);
 if(Buffer.byteLength(bytes)>4096)error('R141_LEDGER_ENTRY_TOO_BIG');
 let fd;
 try{
  fd=fs.openSync(filename,'wx',0o600);
  fs.writeFileSync(fd,bytes);
  fs.fsyncSync(fd);
  fs.closeSync(fd);fd=null;
  const dfd=fs.openSync(path.dirname(filename),'r');try{fs.fsyncSync(dfd)}finally{fs.closeSync(dfd)}
  return true;
 }catch(e){if(e.code==='EEXIST')return false;throw e}
 finally{if(fd!==undefined&&fd!==null)fs.closeSync(fd)}
}
function read(filename){
 let s;
 try{s=fs.lstatSync(filename)}catch(e){if(e.code==='ENOENT')return null;throw e}
 if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077)!==0||
   s.size>4096||s.size<40)error('R141_LEDGER_CORRUPT');
 const r=JSON.parse(fs.readFileSync(filename,'utf8'));
 if(!r||r.schema!==SCHEMA||!UUID.test(r.request_id))error('R141_LEDGER_UNTRUSTED');
 return r;
}
function encryptionKey(secret){return crypto.createHash('sha256').update('BF2026_R141_PAYMENT_LINK_V1\0').update(secret).digest()}
function seal(url,secret){
 const nonce=crypto.randomBytes(12);
 const c=crypto.createCipheriv('aes-256-gcm',encryptionKey(secret),nonce);
 const ciphertext=Buffer.concat([c.update(url,'utf8'),c.final()]);
 return {nonce:nonce.toString('base64url'),ciphertext:ciphertext.toString('base64url'),tag:c.getAuthTag().toString('base64url')};
}
function openLink(sealed,secret){
 const d=crypto.createDecipheriv('aes-256-gcm',encryptionKey(secret),Buffer.from(sealed.nonce,'base64url'));
 d.setAuthTag(Buffer.from(sealed.tag,'base64url'));
 return Buffer.concat([d.update(Buffer.from(sealed.ciphertext,'base64url')),d.final()]).toString('utf8');
}
function numericId(x){return /^[1-9][0-9]{0,17}$/.test(String(x??''))?String(x):null}
function providerAck(v,dealNumber,validUrl){
 if(!v||![true,'true'].includes(v.success)||!v.result||
   ![true,'true'].includes(v.result.success)||
   [true,'true'].includes(v.result.error)||
   numericId(v.result.deal_number)!==dealNumber||
   !numericId(v.result.deal_id))error('R141_PROVIDER_ORDER_ACK_UNVERIFIED');
 const link=v.result.payment_link;
 if(!validUrl(link))error('R141_PAYMENT_LINK_HOST_INVALID');
 return {deal_id:String(v.result.deal_id),deal_number:dealNumber,payment_link:link};
}
function verifyReadback(r,{dealId,dealNumber,offer,amount,buyerHash}){
 return !!r&&r.source==='GETCOURSE_AUTHORIZED_NATIVE_READ_ONLY_ORDER'&&
  r.account_host==='study.shkola-dnv.com'&&
  String(r.deal_id)===String(dealId)&&String(r.deal_number)===String(dealNumber)&&
  r.order_status==='new'&&r.payment_total_rub===amount&&r.currency==='RUB'&&
  Array.isArray(r.positions)&&r.positions.length===1&&r.positions[0]?.offer_id===offer&&
  r.positions[0].quantity===1&&r.positions[0].price_rub===amount&&
  r.buyer_email_hash===buyerHash&&r.native_order_consent_verified===true&&
  r.native_unchecked_consent_rejection_verified===true;
}
function createDurableContact({
 directory,quote,send,nativeReadback,preflight,keyProvider,
 clean,validUrl,offers,
 allowProviderNetwork=false,clock=()=>Date.now()
}={}){
 if(typeof clean!=='function'||typeof validUrl!=='function'||
  !offers||typeof offers!=='object'||Array.isArray(offers)||
  typeof quote!=='function'||typeof send!=='function'||
  typeof nativeReadback!=='function'||typeof preflight!=='function'||
  typeof keyProvider!=='function'||typeof directory!=='string')
  error('R141_DEPENDENCIES_REQUIRED');
 function readyStatus(){
  return {ok:true,ready:false,mode:'HOLD_UNTIL_NATIVE_UNPAID_PROVIDER_PROOF',
    actual_payment_link_verified:false,legal_consent_required:true};
 }
 async function readiness(){
  if(!allowProviderNetwork)return readyStatus();
  let gates;
  try{gates=await preflight()}catch{return readyStatus()}
  if(!gates||REQUIRED.some(k=>gates[k]!==true))return readyStatus();
  let key;try{key=await keyProvider()}catch{return readyStatus()}
  if(!allowedKey(key))return readyStatus();
  try{auditDir(directory)}catch{return readyStatus()}
  return {ok:true,ready:true,provider_import_operational_realtime_verified:false};
 }
 async function start(payload){
  const status=await readiness();
  if(!status.ready)return deny('R141_GETCOURSE_REALTIME_OR_CONSENT_HOLD');
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
     Object.keys(payload).sort().join('|')!==
       ['buyer','legal_consent','request_id','selection'].sort().join('|'))
   return deny('R141_CONTACT_SHAPE_INVALID',422);
  const buyer=clean(payload.buyer),selection=payload.selection,id=payload.request_id;
  if(!buyer||payload.legal_consent!==true||!UUID.test(id)||!selection||
    typeof selection!=='object'||Array.isArray(selection)||
    Object.keys(selection).some(k=>!['kind','lot','variant'].includes(k)))
   return deny('R141_CONTACT_OR_CONSENT_INVALID',422);
  let details;
  try{details=canonicalDetails({selection,buyer,quote:quote(selection),offers})}
  catch{return deny('R141_OFFER_OR_QUOTE_MISMATCH',422)}
  let secret;
  try{secret=await keyProvider()}catch{return deny('R141_KEY_NOT_AVAILABLE')}
  if(!allowedKey(secret))return deny('R141_KEY_NOT_AVAILABLE');
  auditDir(directory);
  const fingerprint=hmac(secret,JSON.stringify({request_id:id,buyer_email:details.buyer_email,
   buyer_first:buyer.first_name,buyer_last:buyer.last_name,buyer_phone:buyer.phone,
   offer_id:details.offer_id,price_rub:details.total_rub,legal_consent:true}));
  const recordKey=sha('R141_REQ_ID\0'+id); // key rotations must not bypass claim
  const recordName=path.join(directory,recordKey+'.json');
  let persisted;
  try{persisted=read(recordName)}catch{return deny('R141_LEDGER_CORRUPT')}
  if(persisted){
   if(persisted.fingerprint!==fingerprint)return deny('R141_IDEMPOTENCY_PAYLOAD_CHANGED',409);
   if(persisted.state==='VERIFIED_UNPAID_LINK'&&persisted.sealed_link){
    try{
     const checkoutUrl=openLink(persisted.sealed_link,secret);
     if(validUrl(checkoutUrl))return [200,{ok:true,checkout_url:checkoutUrl,
       total_rub:details.total_rub,offer_id:details.offer_id,
       idempotent_replay:true,unpaid_order_native_verified:true,
       payment_verified:false,receipt_verified:false,access_grants_verified:false}];
    }catch{}
   }
   return deny('R141_EXISTING_ORDER_MANUAL_RECONCILIATION_NO_RETRY',409);
  }
  // Use 15-digit native order number; deterministic across restart.
  const dealNumber=String(100000000000000n+
   BigInt('0x'+hmac(secret,'DEAL\0'+recordKey).slice(0,15))%900000000000000n);
  const entry={schema:SCHEMA,request_id:id,fingerprint,deal_number:dealNumber,
   offer_id:details.offer_id,total_rub:details.total_rub,
   state:'SEND_UNCERTAIN',created_at:new Date(clock()).toISOString()};
  // Durable claim+fsync BEFORE any external GetCourse write. On crash or
  // ambiguous response, identical retries must not re-send to provider.
  if(!claim(recordName,entry))return deny('R141_CONCURRENT_ORDER_ALREADY_CLAIMED_NO_RETRY',409);
  const body={user:buyer,system:{refresh_if_exists:0,multiple_offers:0,
   return_payment_link:1,return_deal_number:1},deal:{
   deal_number:dealNumber,offer_id:details.offer_id,deal_cost:details.total_rub,
   quantity:1,deal_is_paid:0,deal_status:'new',deal_currency:'RUB'}};
  let ack;
  try{ack=providerAck(await send(body,secret),dealNumber,validUrl)}
  catch{
   atomicReplace(recordName,{...entry,state:'PROVIDER_OUTCOME_UNKNOWN_NO_RETRY'});
   return deny('R141_PROVIDER_RESULT_UNKNOWN_MANUAL_RECONCILIATION',502);
  }
  atomicReplace(recordName,{...entry,deal_id:ack.deal_id,
   state:'PROVIDER_ACKED_HOLD_NATIVE_READBACK'});
  let native;
  try{native=await nativeReadback({dealNumber,dealId:ack.deal_id,
    offerId:details.offer_id,expectedTotalRub:details.total_rub,
    buyerEmail:details.buyer_email})}
  catch{return deny('R141_NATIVE_ORDER_READBACK_UNAVAILABLE')}
  const buyerHash=hmac(secret,details.buyer_email);
  if(!verifyReadback(native,{dealId:ack.deal_id,dealNumber,
    offer:details.offer_id,amount:details.total_rub,buyerHash}))
    return deny('R141_NATIVE_UNPAID_ORDER_OR_CONSENT_NOT_VERIFIED');
  atomicReplace(recordName,{...entry,deal_id:ack.deal_id,
    state:'VERIFIED_UNPAID_LINK',sealed_link:seal(ack.payment_link,secret)});
  return [200,{ok:true,checkout_url:ack.payment_link,
   total_rub:details.total_rub,offer_id:details.offer_id,
   unpaid_order_native_verified:true,payment_verified:false,
   receipt_verified:false,access_grants_verified:false}];
 }
 return Object.freeze({readiness,start,status:readiness});
}
module.exports={SCHEMA,REQUIRED,createDurableContact,verifyReadback};
