'use strict';
/* BF2026 R126 owner-controlled read-only native observer binding.
 * No public URL, no connector credentials in GitHub or browser. Exact private
 * module location is fixed; using this module requires independent owner audit.
 * OFF by default. Secret/private key generation is NOT performed here.
 */
const fs=require('node:fs');
const path=require('node:path');
const {
 readApprovedKey,createSignedReadOnlyObserver,PRIVATE_ROOT
}=require('./r126-signed-native-observer.cjs');
const TRANSPORT_FILE=PRIVATE_ROOT+'/observer-transport-approved.cjs';
function fail(code){const e=new Error(code);e.code=code;throw e}
function assertOwnerPrivateFile(filePath){
 let st,dir,real;try{
  st=fs.lstatSync(filePath);
  dir=fs.lstatSync(PRIVATE_ROOT);
  real=fs.realpathSync(filePath);
 }catch{fail('R126_OBSERVER_TRANSPORT_NOT_PROVISIONED')}
 const uid=process.getuid?.();
 if(typeof uid!=='number'||!dir.isDirectory()||dir.isSymbolicLink()||
    dir.uid!==uid||(dir.mode&0o022)!==0||
    !st.isFile()||st.isSymbolicLink()||st.uid!==uid||
    (st.mode&0o077)!==0||st.size>16384||st.size<100||
    real!==filePath)
  fail('R126_OBSERVER_TRANSPORT_FILE_NOT_PRIVATE');
}
function createConfiguredObserver(env=process.env){
 if(env.BF2026_R126_NATIVE_OBSERVER_ENABLED!=='1')return null;
 if(env.BF2026_R126_PROVIDER_VERIFY_ENABLED!=='1')fail('R126_OBSERVER_PARENT_FLAG_REQUIRED');
 if(typeof env.BF2026_R126_OBSERVER_PUBLIC_KEY_FILE!=='string')
  fail('R126_OBSERVER_PUBLIC_KEY_FILE_REQUIRED');
 const publicKey=readApprovedKey({filePath:env.BF2026_R126_OBSERVER_PUBLIC_KEY_FILE});
 assertOwnerPrivateFile(TRANSPORT_FILE);
 // Explicitly fixed owner-audited local module, not user/browser supplied
 // dynamic code. It MUST only do authenticated read-only native calls and
 // sign every response at source with the configured observer keypair.
 let transport;
 try{transport=require(TRANSPORT_FILE)}catch{fail('R126_OBSERVER_TRANSPORT_UNAVAILABLE')}
 if(transport?.kind!=='BF2026_NATIVE_OWNER_APPROVED_READONLY_V1'||
    transport?.mutationMethodsAvailable!==false)
  fail('R126_OBSERVER_NOT_EXPLICIT_READONLY');
 return createSignedReadOnlyObserver({transport,publicKey});
}
module.exports={TRANSPORT_FILE,createConfiguredObserver};
