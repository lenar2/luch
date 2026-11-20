'use strict';
/* BF2026 R126: independently signed owner-approved READ-ONLY observer interface.
 * Signatures authenticate the observer's claims, NOT a GetCourse signature.
 * The observer transport is an injected, reviewed, read-only connector.
 * Never accepts an arbitrary provider URL or an HTTP-submitted evidence body.
 */
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {SUBJECT}=require('./r126-provider-verification.cjs');
const PRIVATE_ROOT='/srv/factory-scratch/bf2026-r118-relay-stage-20261119/private-credentials';
const SCHEMA='bf2026.r126.native-observer-signed-readback.v1';
const ACTIONS=Object.freeze(['origin','fiscal_receipt','purchase_grants']);
function fail(code){const e=Error(code);e.code=code;throw e}
function readApprovedKey({filePath,uid=process.getuid?.()}={}){
 if(typeof uid!=='number'||typeof filePath!=='string'||
   !path.isAbsolute(filePath)||path.dirname(filePath)!==PRIVATE_ROOT)
   fail('R126_OBSERVER_KEY_PATH_NOT_ALLOWLISTED');
 let st,dir,real;
 try{st=fs.lstatSync(filePath);dir=fs.lstatSync(PRIVATE_ROOT);real=fs.realpathSync(filePath)}
 catch{fail('R126_OBSERVER_KEY_UNAVAILABLE')}
 if(!dir.isDirectory()||dir.isSymbolicLink()||dir.uid!==uid||(dir.mode&0o022)!==0||
  st.isSymbolicLink()||!st.isFile()||st.uid!==uid||(st.mode&0o077)!==0||
  st.size>4096||st.size<80||real!==filePath)
   fail('R126_OBSERVER_KEY_NOT_OWNER_PRIVATE');
 let key;try{key=crypto.createPublicKey(fs.readFileSync(filePath))}
 catch{fail('R126_OBSERVER_KEY_PARSE_ERROR')}
 if(key.asymmetricKeyType!=='ed25519')fail('R126_OBSERVER_ED25519_REQUIRED');
 return key;
}
function canonical(payload){return JSON.stringify(payload)}
function validateSignedEnvelope({envelope,action,nonce,key,clock=()=>Date.now()}={}){
 if(!ACTIONS.includes(action))fail('R126_OBSERVER_ACTION_NOT_ALLOWED');
 if(!envelope||typeof envelope!=='object'||Array.isArray(envelope)||
   Object.keys(envelope).sort().join(',')!=='key_id,payload,signature')
   fail('R126_OBSERVER_ENVELOPE_SHAPE_INVALID');
 if(!key||key.asymmetricKeyType!=='ed25519')fail('R126_OBSERVER_ED25519_REQUIRED');
 const serialized=JSON.stringify(envelope);
 if(typeof serialized!=='string'||Buffer.byteLength(serialized,'utf8')>32768)
  fail('R126_OBSERVER_ENVELOPE_TOO_LARGE');
 const expectedKeyId='BF2026_'+crypto.createHash('sha256')
  .update(key.export({type:'spki',format:'der'})).digest('hex').slice(0,32).toUpperCase();
 if(envelope.key_id!==expectedKeyId)fail('R126_OBSERVER_KEY_ID_NOT_PINNED');
 const data=envelope.payload;
 if(!data||typeof data!=='object'||Array.isArray(data)||
   data.schema!==SCHEMA||data.action!==action||
   data.nonce!==nonce||
   data.issuer!=='BF2026_OWNER_APPROVED_READONLY_NATIVE_OBSERVER'||
   data.account_host!==SUBJECT.account_host||
   data.qa_user_id!==SUBJECT.qa_user_id||
   data.order_number!==SUBJECT.order_number||
   data.deal_id!==SUBJECT.deal_id||
   data.offer_id!==SUBJECT.offer_id||
   data.amount_rub!==SUBJECT.amount_rub||
   typeof envelope.key_id!=='string'||!/^BF2026_[A-Z0-9_]{6,64}$/.test(envelope.key_id))
  fail('R126_OBSERVER_ENVELOPE_SCOPE_MISMATCH');
 const timestamp=Date.parse(data.observed_at);
 if(!Number.isFinite(timestamp)||Math.abs(clock()-timestamp)>5*60*1000)
  fail('R126_OBSERVER_TIMESTAMP_EXPIRED');
 if(typeof envelope.signature!=='string'||!/^[A-Za-z0-9_-]{80,110}$/.test(envelope.signature))
  fail('R126_OBSERVER_SIGNATURE_INVALID');
 let signature;
 try{signature=Buffer.from(envelope.signature,'base64url')}
 catch{fail('R126_OBSERVER_SIGNATURE_INVALID')}
 if(signature.length!==64||
   !crypto.verify(null,Buffer.from(canonical(data),'utf8'),key,signature))
  fail('R126_OBSERVER_SIGNATURE_UNVERIFIED');
 return data;
}
function createSignedReadOnlyObserver({transport,publicKey,clock=()=>Date.now()}={}){
 if(!transport||typeof transport!=='object'||
   typeof transport.readOriginAttestation!=='function'||
   typeof transport.readFiscallyRegisteredReceipt!=='function'||
   typeof transport.readPurchaseGrants!=='function')
  fail('R126_OBSERVER_APPROVED_READONLY_TRANSPORT_REQUIRED');
 if(!publicKey||publicKey.asymmetricKeyType!=='ed25519')
  fail('R126_OBSERVER_ED25519_REQUIRED');
 async function call(action,subject,method){
  if(subject!==SUBJECT)fail('R126_OBSERVER_SUBJECT_MISMATCH');
  const nonce=crypto.randomBytes(24).toString('hex');
  // Transport methods MUST be authorized read-only native browser or
  // approved connector calls. No POST/import/action/change API here.
  const envelope=await transport[method]({subject,nonce,action});
  const data=validateSignedEnvelope({envelope,action,nonce,key:publicKey,clock});
  return data.data;
 }
 return Object.freeze({
  async verifyIndependentOrigin(subject){
   const v=await call('origin',subject,'readOriginAttestation');
   return {
    approved_read_only_observer:v?.approved_read_only_observer===true,
    server_authenticated:v?.server_authenticated===true,
    source_account_host:v?.source_account_host??null,
    _notice:'Owner observer signature verifies observer identity; NOT provider GetCourse signature'
   };
  },
  readFiscallyRegisteredReceipt:subject=>call('fiscal_receipt',subject,'readFiscallyRegisteredReceipt'),
  readPurchaseGrants:subject=>call('purchase_grants',subject,'readPurchaseGrants')
 });
}
module.exports={PRIVATE_ROOT,SCHEMA,readApprovedKey,validateSignedEnvelope,createSignedReadOnlyObserver};
