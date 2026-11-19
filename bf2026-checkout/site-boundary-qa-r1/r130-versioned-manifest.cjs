'use strict';
/* R130 versioned 12-entry site-offer registry.
 * Extends (does not replace) R127's Ed25519 ten-route revision manifest.
 * Every site entry is pinned to the exact R128 map; the ten live CTA routes
 * must additionally match the independently verified R127 route manifest.
 * Signatures authenticate owner readback, NOT GetCourse vendor signatures.
 */
const crypto=require('node:crypto');
const {ENTRIES,ROUTE_KEYS}=require('./r128-native-cta-map.cjs');
const {readOwnerPrivateFile}=require('./r127-consent-boundary.cjs');
const {readApprovedKey}=require('./r126-signed-native-observer.cjs');
const {stable,keyId}=require('./r127-signed-revision-manifest.cjs');
const SCHEMA='bf2026.r130.versioned-site-offer-manifest.v1';
const ISSUER='BF2026_OWNER_APPROVED_NATIVE_SITE_OFFER_READBACK';
const SCOPE='BF2026_SITE';
const TEST_SCOPE='BF2026_R130_TEST';
const MAX_LIFETIME_MS=7*86400000;
const MAX_READBACK_AGE_MS=30*86400000;
const CALLBACK='/api/checkout/_provider/getcourse/order-created';
const CONSENT='/api/checkout/consent/';
const QA_PREFIX='/api/checkout/_qa/manifest/';
const PRIVATE_ROOT='/srv/factory-scratch/bf2026-r118-relay-stage-20261119/private-credentials';
const ENTRY_KEYS=Object.freeze(Object.keys(ENTRIES).sort());
const ROUTE_SET=Object.freeze([...ROUTE_KEYS].sort());
function fail(code){const e=Error(code);e.code=code;throw e}
function sha(v){return crypto.createHash('sha256').update(v).digest('hex')}
function isSha(v){return typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)}
function iso(v){
 if(typeof v!=='string'||! /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(Z|[+-]\d\d:\d\d)$/.test(v))return null;
 const n=Date.parse(v);return Number.isFinite(n)?n:null;
}
function exactKeys(obj,keys){
 return !!obj&&typeof obj==='object'&&!Array.isArray(obj)&&
  Object.keys(obj).sort().join('|')===[...keys].sort().join('|');
}
function expectedEntry(key){
 const e=ENTRIES[key];
 return {
  site_entry_key:key,route_key:e.route_key??null,site_lot:e.site_lot??null,
  variant:e.variant??null,widget_id:e.widget_id,offer_id:e.offer_id,
  amount_rub:e.amount_rub,
  product_training_pairs:e.product_training_pairs.map(p=>({
   product_id:p.product_id,training_id:p.training_id??null
  })),
  fulfillment:e.fulfillment??null,customer_title:e.customer_title??null,
  route_status:e.route_status
 };
}
const NATIVE_MAP_SHA256=sha(stable(ENTRIES));
function routeManifestReady(m){
 if(!m||m.schema!=='bf2026.r127.offer-revisions.v1'||
  m.source!=='OWNER_APPROVED_NATIVE_OFFER_REVISION_READBACK'||
  m.approved!==true||m.signature_verified!==true||
  !m.offers||typeof m.offers!=='object'||Array.isArray(m.offers))return false;
 const keys=Object.keys(m.offers).sort();
 return keys.length===ROUTE_SET.length&&keys.every((k,i)=>k===ROUTE_SET[i]);
}
function verifyVersionedManifest(envelope,{
 publicKey,scope=SCOPE,routeRevisionManifest,now=Date.now()
}={}){
 if(!publicKey||publicKey.asymmetricKeyType!=='ed25519')
  fail('R130_OWNER_ED25519_PUBLIC_KEY_REQUIRED');
 if(![SCOPE,TEST_SCOPE].includes(scope))fail('R130_REGISTRY_SCOPE_INVALID');
 if(!exactKeys(envelope,['key_id','payload','signature'])||
  envelope.key_id!==keyId(publicKey))fail('R130_ENVELOPE_OR_PINNED_KEY_INVALID');
 if(typeof envelope.signature!=='string'||!/^[A-Za-z0-9_-]{80,110}$/.test(envelope.signature))
  fail('R130_SIGNATURE_INVALID');
 const sig=Buffer.from(envelope.signature,'base64url');
 if(sig.length!==64||!crypto.verify(null,Buffer.from(stable(envelope.payload)),publicKey,sig))
  fail('R130_SIGNATURE_UNVERIFIED');
 const p=envelope.payload;
 if(!exactKeys(p,['schema','source','registry_scope','version',
  'previous_manifest_sha256','native_map_sha256','route_keys',
  'issued_at','expires_at','entries'])||
  p.schema!==SCHEMA||p.source!==ISSUER||p.registry_scope!==scope)
  fail('R130_PAYLOAD_SCHEMA_OR_SCOPE_INVALID');
 if(!Number.isSafeInteger(p.version)||p.version<1||
  (p.version===1?p.previous_manifest_sha256!==null:!isSha(p.previous_manifest_sha256)))
  fail('R130_VERSION_OR_PREVIOUS_HASH_INVALID');
 if(p.native_map_sha256!==NATIVE_MAP_SHA256)
  fail('R130_NATIVE_CTA_MAP_HASH_MISMATCH');
 if(!Array.isArray(p.route_keys)||p.route_keys.length!==ROUTE_SET.length||
  p.route_keys.some((k,i)=>k!==ROUTE_SET[i]))
  fail('R130_TEN_CTA_ROUTE_SET_MISMATCH');
 const issued=iso(p.issued_at),expires=iso(p.expires_at);
 if(issued===null||expires===null||issued>now+300000||expires<=now||
  expires<=issued||expires-issued>MAX_LIFETIME_MS)
  fail('R130_MANIFEST_EXPIRED_OR_TIME_INVALID');
 if(!p.entries||typeof p.entries!=='object'||Array.isArray(p.entries)||
  Object.keys(p.entries).sort().join('|')!==ENTRY_KEYS.join('|'))
  fail('R130_EXACT_TWELVE_SITE_ENTRY_SET_REQUIRED');
 if(!routeManifestReady(routeRevisionManifest))
  fail('R130_R127_ROUTE_REVISION_MANIFEST_NOT_VERIFIED');
 const normalized={};
 for(const key of ENTRY_KEYS){
  const row=p.entries[key],expected=expectedEntry(key);
  if(!exactKeys(row,[...Object.keys(expected),'revision_sha256',
   'native_readback_verified','readback_at','readback_evidence_sha256']))
   fail('R130_ENTRY_SHAPE_INVALID_'+key);
  for(const k of Object.keys(expected)){
   if(stable(row[k])!==stable(expected[k]))
    fail('R130_NATIVE_SITE_PRODUCT_OR_CTA_MAPPING_MISMATCH_'+key+'_'+k);
  }
  if(row.native_readback_verified!==true||!isSha(row.revision_sha256)||
   !isSha(row.readback_evidence_sha256))
   fail('R130_NATIVE_OFFER_READBACK_OR_SHA256_MISSING_'+key);
  const readback=iso(row.readback_at);
  if(readback===null||readback>issued||now-readback>MAX_READBACK_AGE_MS)
   fail('R130_NATIVE_OFFER_READBACK_STALE_'+key);
  if(expected.route_key){
   const r=routeRevisionManifest.offers[key];
   if(!r||r.offer_id!==expected.offer_id||
    r.revision_sha256!==row.revision_sha256||
    r.readback_evidence_sha256!==row.readback_evidence_sha256||
    iso(r.readback_at)!==readback||r.native_readback_verified!==true)
    fail('R130_R127_ROUTE_REVISION_OR_EVIDENCE_MISMATCH_'+key);
  }
  normalized[key]=Object.freeze({...expected,
   revision_sha256:row.revision_sha256,native_readback_verified:true,
   readback_at:new Date(readback).toISOString(),
   readback_evidence_sha256:row.readback_evidence_sha256});
 }
 const manifestSha=sha(stable(envelope));
 return Object.freeze({
  schema:'bf2026.r130.verified-versioned-site-manifest.v1',
  registry_scope:scope,version:p.version,
  previous_manifest_sha256:p.previous_manifest_sha256,
  manifest_sha256:manifestSha,payload_sha256:sha(stable(p)),
  key_id:envelope.key_id,issued_at:new Date(issued).toISOString(),
  expires_at:new Date(expires).toISOString(),
  native_map_sha256:NATIVE_MAP_SHA256,
  entries:Object.freeze(normalized),route_keys:ROUTE_SET,
  site_entry_count:ENTRY_KEYS.length,individual_route_count:ROUTE_SET.length,
  qa_only_entry_count:2,signature_verified:true,
  owner_readback_verified:true,public_release_allowed:false
 });
}
function signFixture(payload,privateKey){
 if(!privateKey||privateKey.asymmetricKeyType!=='ed25519')
  fail('R130_TEST_SIGNING_KEY_REQUIRED');
 const publicKey=crypto.createPublicKey(privateKey);
 return Object.freeze({key_id:keyId(publicKey),payload,
  signature:crypto.sign(null,Buffer.from(stable(payload)),privateKey).toString('base64url')});
}
function loadRuntimeTrust(env=process.env){
 try{
  if(typeof env.BF2026_R130_VERSIONED_PUBLIC_KEY_FILE!=='string')return null;
  return readApprovedKey({filePath:env.BF2026_R130_VERSIONED_PUBLIC_KEY_FILE});
 }catch{return null}
}
function loadVersionedEnvelope(env=process.env){
 const raw=readOwnerPrivateFile(env.BF2026_R130_VERSIONED_MANIFEST_FILE,{maxBytes:65536});
 if(!raw)return null;
 try{return JSON.parse(raw)}catch{return null}
}
function createVersionedManifestRegistry({
 pool,publicKey=null,routeRevisionManifest=null,scope=SCOPE,
 allowTestScope=false,clock=()=>Date.now()
}={}){
 if(typeof pool?.query!=='function')fail('R130_POSTGRES_REQUIRED');
 if(scope===TEST_SCOPE&&!allowTestScope)fail('R130_TEST_SCOPE_DISABLED');
 if(![SCOPE,TEST_SCOPE].includes(scope))fail('R130_REGISTRY_SCOPE_INVALID');
 async function readCurrent(queryable=pool,{lock=false}={}){
  if(!publicKey||!routeRevisionManifest)return null;
  try{
   const q=await queryable.query(
    'SELECT h.manifest_version,h.manifest_sha256,v.signed_envelope '+
    'FROM bf2026_r130_manifest_head h JOIN bf2026_r130_manifest_history v '+
    'ON v.registry_scope=h.registry_scope AND v.manifest_version=h.manifest_version '+
    'AND v.manifest_sha256=h.manifest_sha256 WHERE h.registry_scope=$1'+
    (lock?' FOR SHARE OF h':''),[scope]);
   if(!q.rows?.length)return null;
   const row=q.rows[0],envelope=typeof row.signed_envelope==='string'?
    JSON.parse(row.signed_envelope):row.signed_envelope;
   const verified=verifyVersionedManifest(envelope,{
    publicKey,scope,routeRevisionManifest,now:clock()
   });
   if(verified.version!==Number(row.manifest_version)||
    verified.manifest_sha256!==String(row.manifest_sha256).trim())
    return null;
   return verified;
  }catch{return null;}
 }
 async function current(){return readCurrent(pool)}
 async function status(){
  let dbReady=false,head=null;
  try{
   const q=await pool.query(
    "SELECT to_regclass('public.bf2026_r130_manifest_head') h,"+
    "to_regclass('public.bf2026_r130_manifest_history') v,"+
    "to_regclass('public.bf2026_r127_consent_challenges') c");
   dbReady=Boolean(q.rows?.[0]?.h&&q.rows?.[0]?.v&&q.rows?.[0]?.c);
   const x=await pool.query(
    'SELECT manifest_version,manifest_sha256 FROM bf2026_r130_manifest_head WHERE registry_scope=$1',[scope]);
   head=x.rows?.[0]||null;
  }catch{}
  const active=await current();
  return Object.freeze({
   route:'R130_VERSIONED_SITE_OFFER_MANIFEST',
   registry_scope:scope,postgres_ready:dbReady,
   trust_root_configured:Boolean(publicKey),
   r127_route_manifest_verified:routeManifestReady(routeRevisionManifest),
   manifest_active:Boolean(active),
   manifest_version:active?.version??(head?Number(head.manifest_version):null),
   manifest_sha256:active?.manifest_sha256??(head?String(head.manifest_sha256).trim():null),
   site_entry_count:active?.site_entry_count??12,
   individual_route_count:active?.individual_route_count??10,
   qa_only_entry_count:active?.qa_only_entry_count??2,
   rollback_protection:'PERSISTED_VERSION_AND_HASH_CHAIN',
   nonce_linkage:'R127_ORDER_CHALLENGE_ROW',
   gate_code:active?'R130_VERSIONED_MANIFEST_VERIFIED':
    !dbReady?'R130_POSTGRES_OR_MIGRATION_UNAVAILABLE':
    !publicKey?'R130_OWNER_PUBLIC_KEY_NOT_CONFIGURED':
    !routeManifestReady(routeRevisionManifest)?'R130_R127_ROUTE_REVISION_MANIFEST_NOT_VERIFIED':
    head?'R130_PERSISTED_HEAD_SIGNATURE_OR_CHAIN_INVALID':'R130_NO_ACTIVE_SIGNED_MANIFEST',
   public_release_allowed:false
  });
 }
 async function register(envelope){
  if(!publicKey||!routeRevisionManifest)fail('R130_TRUST_ROOT_OR_R127_ROUTE_MANIFEST_REQUIRED');
  const verified=verifyVersionedManifest(envelope,{
   publicKey,scope,routeRevisionManifest,now:clock()
  });
  const client=await pool.connect();let tx=false;
  try{
   await client.query('BEGIN');tx=true;
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['BF2026:R130:'+scope]);
   const q=await client.query(
    'SELECT manifest_version,manifest_sha256 FROM bf2026_r130_manifest_head WHERE registry_scope=$1 FOR UPDATE',[scope]);
   const head=q.rows?.[0];
   if(head&&Number(head.manifest_version)===verified.version&&
    String(head.manifest_sha256).trim()===verified.manifest_sha256){
    await client.query('COMMIT');tx=false;
    return Object.freeze({ok:true,duplicate:true,changed:false,
     registry_scope:scope,version:verified.version,
     manifest_sha256:verified.manifest_sha256,public_release_allowed:false});
   }
   if(!head){
    if(verified.version!==1||verified.previous_manifest_sha256!==null)
     fail('R130_MANIFEST_GENESIS_REQUIRED');
    await client.query(
     'INSERT INTO bf2026_r130_manifest_history '+
     '(registry_scope,manifest_version,manifest_sha256,previous_manifest_sha256,payload_sha256,key_id,issued_at,expires_at,signed_envelope) '+
     'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)',
     [scope,verified.version,verified.manifest_sha256,null,verified.payload_sha256,
      verified.key_id,verified.issued_at,verified.expires_at,JSON.stringify(envelope)]);
    await client.query(
     'INSERT INTO bf2026_r130_manifest_head(registry_scope,manifest_version,manifest_sha256) VALUES($1,$2,$3)',
     [scope,verified.version,verified.manifest_sha256]);
   }else{
    const currentVersion=Number(head.manifest_version);
    const currentHash=String(head.manifest_sha256).trim();
    if(verified.version<=currentVersion)
     fail('R130_MANIFEST_ROLLBACK_OR_REPLAY');
    if(verified.version!==currentVersion+1||
     verified.previous_manifest_sha256!==currentHash)
     fail('R130_MANIFEST_HASH_CHAIN_MISMATCH');
    const old=await client.query(
     'SELECT issued_at FROM bf2026_r130_manifest_history WHERE registry_scope=$1 AND manifest_version=$2',
     [scope,currentVersion]);
    if(!old.rows?.length||Date.parse(verified.issued_at)<=new Date(old.rows[0].issued_at).getTime())
     fail('R130_MANIFEST_ISSUED_AT_NOT_MONOTONIC');
    await client.query(
     'INSERT INTO bf2026_r130_manifest_history '+
     '(registry_scope,manifest_version,manifest_sha256,previous_manifest_sha256,payload_sha256,key_id,issued_at,expires_at,signed_envelope) '+
     'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)',
     [scope,verified.version,verified.manifest_sha256,verified.previous_manifest_sha256,
      verified.payload_sha256,verified.key_id,verified.issued_at,verified.expires_at,
      JSON.stringify(envelope)]);
    await client.query(
     'UPDATE bf2026_r130_manifest_head SET manifest_version=$2,manifest_sha256=$3,updated_at=now() WHERE registry_scope=$1',
     [scope,verified.version,verified.manifest_sha256]);
   }
   await client.query('COMMIT');tx=false;
   return Object.freeze({ok:true,duplicate:false,changed:true,
    registry_scope:scope,version:verified.version,
    manifest_sha256:verified.manifest_sha256,public_release_allowed:false});
  }catch(e){
   if(tx)try{await client.query('ROLLBACK')}catch{}
   throw e;
  }finally{client.release?.()}
 }
 async function assertCallback({client,row,callback}={}){
  if(!client||!row||!callback||row.r130_registry_scope!==scope||
   !Number.isSafeInteger(Number(row.r130_manifest_version))||
   !isSha(String(row.r130_manifest_sha256||'').trim())||
   typeof row.r130_site_entry_key!=='string')
   fail('R127_VERSIONED_MANIFEST_CHALLENGE_STALE');
  const active=await readCurrent(client,{lock:true});
  if(!active||active.version!==Number(row.r130_manifest_version)||
   active.manifest_sha256!==String(row.r130_manifest_sha256).trim())
   fail('R127_VERSIONED_MANIFEST_CHALLENGE_STALE');
  const entry=active.entries[row.r130_site_entry_key];
  const offers=Array.isArray(callback.offers)?callback.offers:[];
  if(!entry||entry.route_key!==row.route_key||
   entry.offer_id!==Number(row.offer_id)||entry.widget_id!==Number(row.widget_id)||
   entry.amount_rub!==Number(row.amount_rub)||
   entry.revision_sha256!==String(row.offer_revision_sha256).trim()||
   callback.offer_revision_sha256!==entry.revision_sha256||
   offers.length!==1||Number(offers[0])!==entry.offer_id)
   fail('R127_VERSIONED_MANIFEST_CHALLENGE_STALE');
  return true;
 }
 return Object.freeze({scope,current,status,register,assertCallback,
  verify:(envelope)=>verifyVersionedManifest(envelope,{
   publicKey,scope,routeRevisionManifest,now:clock()
  })});
}
function createManifestBoundBoundary({boundary,registry}={}){
 if(!boundary||typeof boundary.issueChallenge!=='function'||
  typeof boundary.receiveProviderOrderCallback!=='function'||
  !registry||typeof registry.current!=='function')
  fail('R130_BOUNDARY_DEPENDENCIES_REQUIRED');
 return Object.freeze({
  get callbackSecretConfigured(){return boundary.callbackSecretConfigured===true},
  status:(...a)=>boundary.status(...a),
  issueChallenge:async args=>{
   const active=await registry.current();
   if(!active)fail('R127_OFFER_REVISION_NOT_OWNER_VERIFIED');
   const key=args?.routeKey,entry=active.entries[key];
   if(!entry||entry.route_key!==key||entry.route_status!=='INDIVIDUAL_QA_ONLY')
    fail('R127_OFFER_REVISION_NOT_OWNER_VERIFIED');
   const manifestBinding={
    registry_scope:registry.scope,manifest_version:active.version,
    manifest_sha256:active.manifest_sha256,site_entry_key:key,
    revision_sha256:entry.revision_sha256
   };
   const challenge=await boundary.issueChallenge({...args,manifestBinding});
   return Object.freeze({...challenge,manifest_version:active.version,
    manifest_sha256:active.manifest_sha256,public_release_allowed:false});
  },
  receiveProviderOrderCallback:(...a)=>boundary.receiveProviderOrderCallback(...a),
  inspect:(...a)=>boundary.inspect(...a),
  publicCheckoutDecision:(...a)=>boundary.publicCheckoutDecision?.(...a)
 });
}
function send(res,status,data){
 if(res.headersSent)return;
 res.writeHead(status,{'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store, private','pragma':'no-cache',
  'x-content-type-options':'nosniff','x-robots-tag':'noindex,nofollow',
  'referrer-policy':'no-referrer'});
 res.end(JSON.stringify(data));
}
function createManifestGate({registry,fieldGate,qaConsentHttp,qaAuthorized}={}){
 if(!registry||typeof registry.current!=='function'||
  typeof registry.status!=='function'||typeof fieldGate!=='function'||
  typeof qaConsentHttp!=='function'||typeof qaAuthorized!=='function')fail('R130_HTTP_GATE_DEPENDENCIES_REQUIRED');
 return async function manifestGate(req,res,path){
  if(path===QA_PREFIX+'status'){
   if(req.method!=='GET'||!qaAuthorized(req))return send(res,404,{ok:false,code:'NOT_FOUND'});
   const status=await registry.status();
   return send(res,status.postgres_ready?200:503,{ok:true,...status});
  }
  const qaConsent=path.startsWith('/api/checkout/_qa/consent-boundary/');
  if(qaConsent||path===CALLBACK||(path===CONSENT+'challenge'&&req.method==='POST')){
   const active=await registry.current();
   if(!active)return send(res,503,{ok:false,
    code:'R130_VERSIONED_MANIFEST_NOT_ACTIVE',
    state:'HOLD_OWNER_SIGNED_12_ENTRY_MANIFEST_OR_R127_ROUTE_REVISION',
    manifest_version:null,provider_consent_verified:false,
    provider_signature_verified:false,public_release_allowed:false});
  }
  if(qaConsent)return qaConsentHttp(req,res,path);
  return fieldGate(req,res,path);
 };
}
module.exports={
 SCHEMA,ISSUER,SCOPE,TEST_SCOPE,MAX_LIFETIME_MS,MAX_READBACK_AGE_MS,
 ENTRY_KEYS,ROUTE_SET,NATIVE_MAP_SHA256,expectedEntry,verifyVersionedManifest,
 signFixture,loadRuntimeTrust,loadVersionedEnvelope,createVersionedManifestRegistry,
 createManifestBoundBoundary,createManifestGate
};
