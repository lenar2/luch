'use strict';
/* Server-only GetCourse ORDER IMPORT key loader.
 * Import requires read/write credential. Prior R123 read-only Export API key
 * cannot create deals; never silently reuse it. No keys in browser/GitHub.
 */
const {readOwnerPrivateFile}=require('./r127-consent-boundary.cjs');
const {ACCOUNT,ENDPOINT,createImportTransport}=require('./r130-getcourse-import.cjs');
function ownerConfig(env=process.env){
 if(env?.BF2026_R130_IMPORT_ENABLED!=='1')return null;
 const path=env?.BF2026_R130_WRITE_KEY_FILE;
 const raw=readOwnerPrivateFile(path,{maxBytes:4096});
 if(!raw)return null;
 let info;try{info=JSON.parse(raw)}catch{return null}
 if(!info||info.account_host!==ACCOUNT||info.endpoint!==ENDPOINT||
   info.approved!==true||info.capability!=='orders_write'||
   info.key_type!=='READ_WRITE_NOT_READ_ONLY'||
   typeof info.key!=='string'||info.key.length<32||info.key.length>1024)
  return null;
 return Object.freeze({
  account_host:ACCOUNT,capability:'orders_write',
  keyProvider:()=>info.key,approved:true
 });
}
function createOwnerImportTransport({env=process.env,fetchImpl=globalThis.fetch}={}){
 const config=ownerConfig(env);
 if(!config)return null;
 return createImportTransport({keyProvider:config.keyProvider,
  fetchImpl,allowProviderNetwork:false});
 // A valid write key alone DOES NOT unlock writes; a separate verified
 // native consent + order-field preflight must explicitly enable network
 // for the controlled worker. The imported connector is still default-OFF.
}
module.exports={ownerConfig,createOwnerImportTransport};
