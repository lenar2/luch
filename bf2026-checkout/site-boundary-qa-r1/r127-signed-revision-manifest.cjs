'use strict';
/* R127 owner-signed native Offer/terms revision manifest.
 * No unsigned JSON file can enable a challenge. Private signing key stays
 * offline; only the owner-private Ed25519 public key is installed server-side.
 */
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {EXPECTED}=require('./r123-single-widget-adapter.cjs');
const {readApprovedKey,PRIVATE_ROOT}=require('./r126-signed-native-observer.cjs');
const SCHEMA='bf2026.r127.signed-offer-revisions.v1';
const ISSUER='BF2026_OWNER_APPROVED_NATIVE_OFFER_REVISION_READBACK';
const MAX_LIFETIME_MS=7*86400000;
function fail(code){const e=Error(code);e.code=code;throw e}
function sha(b){return crypto.createHash('sha256').update(b).digest('hex')}
function isHex64(v){return typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)}
function validDate(v){
 if(typeof v!=='string'||! /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(v))return null;
 const n=Date.parse(v);return Number.isFinite(n)?n:null;
}
function stable(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
}
function keyId(publicKey){
 return 'BF2026_'+sha(publicKey.export({type:'spki',format:'der'})).slice(0,32).toUpperCase();
}
function readPrivateJson(filePath,maxBytes=32768){
 if(typeof filePath!=='string'||!path.isAbsolute(filePath)||
  path.dirname(filePath)!==PRIVATE_ROOT)return null;
 try{
  const dir=fs.lstatSync(PRIVATE_ROOT),st=fs.lstatSync(filePath),uid=process.getuid?.();
  if(typeof uid!=='number'||!dir.isDirectory()||dir.isSymbolicLink()||
   dir.uid!==uid||(dir.mode&0o022)!==0||!st.isFile()||st.isSymbolicLink()||
   st.uid!==uid||(st.mode&0o077)!==0||st.size<2||st.size>maxBytes||
   fs.realpathSync(filePath)!==filePath)return null;
  return JSON.parse(fs.readFileSync(filePath,'utf8'));
 }catch{return null}
}
function verifySignedRevisionManifest(envelope,{publicKey,now=Date.now()}={}){
 if(!publicKey||publicKey.asymmetricKeyType!=='ed25519')fail('R127_REVISION_ED25519_KEY_REQUIRED');
 if(!envelope||typeof envelope!=='object'||Array.isArray(envelope)||
  Object.keys(envelope).sort().join('|')!=='key_id|payload|signature')
  fail('R127_REVISION_ENVELOPE_SHAPE_INVALID');
 if(envelope.key_id!==keyId(publicKey))fail('R127_REVISION_KEY_ID_NOT_PINNED');
 if(typeof envelope.signature!=='string'||!/^[A-Za-z0-9_-]{80,110}$/.test(envelope.signature))
  fail('R127_REVISION_SIGNATURE_INVALID');
 const signature=Buffer.from(envelope.signature,'base64url');
 if(signature.length!==64||!crypto.verify(null,Buffer.from(stable(envelope.payload)),publicKey,signature))
  fail('R127_REVISION_SIGNATURE_UNVERIFIED');
 const p=envelope.payload;
 if(!p||typeof p!=='object'||Array.isArray(p)||
  Object.keys(p).sort().join('|')!=='expires_at|issued_at|offers|schema|source'||
  p.schema!==SCHEMA||p.source!==ISSUER||
  !p.offers||typeof p.offers!=='object'||Array.isArray(p.offers))
  fail('R127_REVISION_PAYLOAD_SHAPE_INVALID');
 const issued=validDate(p.issued_at),expires=validDate(p.expires_at);
 if(!issued||!expires||issued>now+300000||expires<=now||
  expires<=issued||expires-issued>MAX_LIFETIME_MS)
  fail('R127_REVISION_MANIFEST_EXPIRED_OR_INVALID');
 const routes=Object.keys(EXPECTED),out={};
 for(const [route,row] of Object.entries(p.offers)){
  if(!routes.includes(route)||!row||typeof row!=='object'||Array.isArray(row)||
   Object.keys(row).sort().join('|')!=='native_readback_verified|offer_id|readback_at|readback_evidence_sha256|revision_sha256'||
   row.offer_id!==EXPECTED[route].offer_id||row.native_readback_verified!==true||
   !isHex64(row.revision_sha256)||!isHex64(row.readback_evidence_sha256))
   fail('R127_REVISION_OFFER_ENTRY_INVALID');
  const readbackAt=validDate(row.readback_at);
  if(!readbackAt||readbackAt>issued||now-readbackAt>30*86400000)
   fail('R127_REVISION_NATIVE_READBACK_STALE');
  out[route]=Object.freeze({offer_id:row.offer_id,
   revision_sha256:row.revision_sha256,native_readback_verified:true,
   readback_at:new Date(readbackAt).toISOString(),
   readback_evidence_sha256:row.readback_evidence_sha256});
 }
 if(!Object.keys(out).length)fail('R127_REVISION_MANIFEST_EMPTY');
 return Object.freeze({
  schema:'bf2026.r127.offer-revisions.v1',
  source:'OWNER_APPROVED_NATIVE_OFFER_REVISION_READBACK',
  approved:true,offers:Object.freeze(out),
  key_id:envelope.key_id,issued_at:new Date(issued).toISOString(),
  expires_at:new Date(expires).toISOString(),
  signature_verified:true
 });
}
function signRevisionManifest(payload,privateKey){
 if(!privateKey||privateKey.asymmetricKeyType!=='ed25519')fail('R127_REVISION_SIGNING_KEY_REQUIRED');
 const publicKey=crypto.createPublicKey(privateKey);
 return Object.freeze({
  key_id:keyId(publicKey),payload,
  signature:crypto.sign(null,Buffer.from(stable(payload)),privateKey).toString('base64url')
 });
}
function loadSignedRevisionManifest(env=process.env){
 const envelope=readPrivateJson(env.BF2026_R127_REVISION_MANIFEST_FILE);
 if(!envelope||typeof env.BF2026_R127_REVISION_PUBLIC_KEY_FILE!=='string')return null;
 try{
  const publicKey=readApprovedKey({filePath:env.BF2026_R127_REVISION_PUBLIC_KEY_FILE});
  return verifySignedRevisionManifest(envelope,{publicKey});
 }catch{return null}
}
module.exports={SCHEMA,ISSUER,MAX_LIFETIME_MS,keyId,stable,
 verifySignedRevisionManifest,signRevisionManifest,loadSignedRevisionManifest};
