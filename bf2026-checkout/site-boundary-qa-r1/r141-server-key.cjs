'use strict';
/*
 * R141: Read existing BF2026 GetCourse key from owner-private backend file.
 * Verify Order fields via the documented READ-ONLY account/fields endpoint.
 * Never logs or exports the key. Never invokes /pl/api/deals.
 * An authenticated fields GET does NOT prove write API, real-time checkout,
 * order-level legal consent or GetCourse Process callback configuration.
 */
const fs=require('node:fs'),path=require('node:path');
const ACCOUNT='study.shkola-dnv.com';
const EXPECTED=Object.freeze([
  {id:23331550,title:'BF2026 Consent Nonce',type:'string',context_type:'deal'},
  {id:23331559,title:'BF2026 Offer Revision SHA256',type:'string',context_type:'deal'}
]);
function secureRead(filePath=path.join(__dirname,'secrets','getcourse_import.key')){
 if(!path.isAbsolute(filePath))throw Error('R141_KEY_FILE_ABSOLUTE_REQUIRED');
 const d=path.dirname(filePath),dst=fs.lstatSync(d),s=fs.lstatSync(filePath);
 const uid=process.getuid?.();
 if(typeof uid!=='number'||dst.uid!==uid||s.uid!==uid||
   !dst.isDirectory()||dst.isSymbolicLink()||(dst.mode&0o077)!==0||
   !s.isFile()||s.isSymbolicLink()||(s.mode&0o077)!==0||
   s.size<24||s.size>512||fs.realpathSync(filePath)!==filePath)
   throw Error('R141_KEY_FILE_OWNER_PRIVATE_REQUIRED');
 const v=fs.readFileSync(filePath,'utf8').trim();
 if(!/^[A-Za-z0-9_-]{24,512}$/.test(v))
   throw Error('R141_KEY_CONTENT_INVALID');
 return v;
}
function credentialStatus(filePath){
 try{secureRead(filePath);return Object.freeze({configured:true,owner_private:true,
   provider_write_capability_verified:false,public_release_allowed:false});}
 catch{return Object.freeze({configured:false,owner_private:false,
   provider_write_capability_verified:false,public_release_allowed:false})}
}
async function readNativeOrderFields({
 filePath, fetchImpl=globalThis.fetch, timeoutMs=8000
}={}){
 let key;try{key=secureRead(filePath)}catch{return Object.freeze({
  native_order_fields_readback_verified:false,code:'R141_KEY_NOT_PROVISIONED'})}
 if(typeof fetchImpl!=='function'||timeoutMs<1000||timeoutMs>15000)
  throw Error('R141_READER_DEPENDENCIES_INVALID');
 let response,raw,json;
 try{
  response=await fetchImpl('https://'+ACCOUNT+'/pl/api/account/fields',{
   method:'POST',redirect:'error',
   headers:{'Content-Type':'application/x-www-form-urlencoded',
    'Accept':'application/json'},
   body:new URLSearchParams({action:'get',key}).toString(),
   signal:AbortSignal.timeout(timeoutMs)
  });
  if(response?.status!==200)throw Error('R141_NATIVE_FIELDS_HTTP_FAILED');
  raw=await response.text();
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>100000)
   throw Error('R141_NATIVE_FIELDS_RESPONSE_TOO_LARGE');
  json=JSON.parse(raw);
 }catch{
  return Object.freeze({native_order_fields_readback_verified:false,
   code:'R141_GETCOURSE_READONLY_FIELD_LOOKUP_UNAVAILABLE',
   provider_write_capability_verified:false,public_release_allowed:false});
 }
 const list=json?.info;
 if(json.success!==true||!Array.isArray(list)||list.length>1000||
   EXPECTED.some(wanted=>list.filter(v=>
     v&&v.id===wanted.id&&v.title===wanted.title&&
     v.type===wanted.type&&v.context_type===wanted.context_type).length!==1))
   return Object.freeze({native_order_fields_readback_verified:false,
    code:'R141_GETCOURSE_ORDER_FIELD_SCHEMA_MISMATCH',
    provider_write_capability_verified:false,public_release_allowed:false});
 const selected=EXPECTED.map(wanted=>{
  const native=list.find(v=>v.id===wanted.id);
  return Object.freeze({id:wanted.id,title:wanted.title,type:wanted.type,
   context_type:wanted.context_type,form_id:native.form_id});
 });
 if(selected.some(x=>!Number.isSafeInteger(x.form_id)||x.form_id<=0)||
   selected[0].form_id!==selected[1].form_id)
  return Object.freeze({native_order_fields_readback_verified:false,
   code:'R141_ORDER_FIELD_FORM_CONTEXT_CONFLICT',
   provider_write_capability_verified:false,public_release_allowed:false});
 return Object.freeze({
  native_order_fields_readback_verified:true,
  code:'R141_GETCOURSE_ORDER_FIELDS_NATIVE_READBACK',
  provider_host:ACCOUNT,fields:selected,
  provider_write_capability_verified:false,
  callback_process_native_verified:false,
  provider_checkout_realtime_verified:false,
  native_order_consent_verified:false,
  public_release_allowed:false
 });
}
module.exports={ACCOUNT,EXPECTED,secureRead,credentialStatus,readNativeOrderFields};
