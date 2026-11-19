'use strict';
/*
 * R145 — BF2026 first-24h shame-audiopractice gift.
 * Inactive unless an owner-private activation manifest is supplied.
 * Not wired to server.js, public routes, GetCourse Process, scheduler, email
 * or marketing. Process callback is only a hint; native payment/refund and
 * entitlement readbacks are mandatory. PostgreSQL outbox is durable.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ACCOUNT_HOST='study.shkola-dnv.com';
const ACTIVATION_SCHEMA='bf2026.r145.shame-gift.activation.v1';
const CALLBACK_SOURCE='GETCOURSE_SHARED_SECRET_CALLBACK';
const GIFT=Object.freeze({training_id:936028240,product_id:4559950,lesson_id:350912495,
 title:'Исцеляющая аудиопрактика «Освобождение от стыда»',access_days:365});
const WINDOW=Object.freeze({timezone:'Europe/Moscow',start_local:'2026-11-20T10:00:00+03:00',
 end_local_exclusive:'2026-11-21T10:00:00+03:00',start_utc:'2026-11-20T07:00:00.000Z',
 end_utc_exclusive:'2026-11-21T07:00:00.000Z',
 start_ms:Date.parse('2026-11-20T07:00:00Z'),end_ms:Date.parse('2026-11-21T07:00:00Z')});
const HASH=/^[a-f0-9]{64}$/,ID=/^[1-9][0-9]{0,17}$/;
const CALLBACK_STATUSES=new Set(['PAID','UNPAID','PART_PAID','CANCELLED','REFUND','PAYMENT_WAITING','WAITING_FOR_RETURN']);
const STATES=new Set(['READY','GRANTING','GRANTED','ALREADY_ENTITLED','REFUNDED_NO_GRANT','REFUND_AFTER_GRANT_REVIEW','RECONCILIATION_REQUIRED','HOLD']);
function fail(code){const e=Error(code);e.code=code;throw e}
function sha(v){return crypto.createHash('sha256').update(String(v)).digest('hex')}
function numericId(v){return typeof v==='number'&&Number.isSafeInteger(v)&&v>0?String(v):typeof v==='string'&&ID.test(v)?v:null}
function isoMs(v){if(typeof v!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,3})?(?:Z|[+-][0-9]{2}:[0-9]{2})$/.test(v))return null;const n=Date.parse(v);return Number.isFinite(n)?n:null}
function inGiftWindow(v){const n=typeof v==='number'?v:isoMs(v);return n!==null&&n>=WINDOW.start_ms&&n<WINDOW.end_ms}
function moscowWallClock(ms){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second;
}
function exact(o,keys){return !!o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===[...keys].sort().join('|')}
const AK=['schema','enabled','owner_approved','ui_owner_approval_verified','account_host','gift_training_id','gift_product_id','gift_lesson_id','access_days','access_days_owner_approved','training_readback_verified','product_training_mapping_verified','native_payment_readback_verified','native_refund_readback_verified','native_entitlement_readback_verified','native_grant_write_verified','provider_grant_idempotency_verified','offer_registry_readback_verified','eligible_offer_ids','evidence'].sort();
const EK=['owner_approval_sha256','training_readback_sha256','product_mapping_sha256','payment_readback_sha256','refund_readback_sha256','entitlement_readback_sha256','grant_write_sha256','offer_registry_sha256','process_configuration_sha256'].sort();
function validateActivation(c){
 const no=code=>Object.freeze({active:false,code,public_release_allowed:false,grant_writes:0});
 if(!c)return no('R145_ACTIVATION_FILE_MISSING');
 if(!exact(c,AK))return no('R145_ACTIVATION_SCHEMA_INVALID');
 if(c.schema!==ACTIVATION_SCHEMA||c.enabled!==true)return no('R145_GIFT_NOT_ENABLED');
 if(c.owner_approved!==true||c.ui_owner_approval_verified!==true)return no('R145_GETCOURSE_UI_OWNER_APPROVAL_MISSING');
 if(c.account_host!==ACCOUNT_HOST||c.gift_training_id!==GIFT.training_id||c.gift_product_id!==GIFT.product_id||c.gift_lesson_id!==GIFT.lesson_id)return no('R145_NATIVE_GIFT_MAPPING_MISMATCH');
 if(c.access_days!==365||c.access_days_owner_approved!==true)return no('R145_GIFT_ACCESS_TERM_NOT_OWNER_APPROVED');
 for(const k of ['training_readback_verified','product_training_mapping_verified','native_payment_readback_verified','native_refund_readback_verified','native_entitlement_readback_verified','native_grant_write_verified','offer_registry_readback_verified'])if(c[k]!==true)return no('R145_NATIVE_PROVIDER_CAPABILITY_EVIDENCE_INCOMPLETE');
 if(typeof c.provider_grant_idempotency_verified!=='boolean')return no('R145_PROVIDER_IDEMPOTENCY_EVIDENCE_INVALID');
 if(!Array.isArray(c.eligible_offer_ids)||!c.eligible_offer_ids.length||c.eligible_offer_ids.length>64)return no('R145_ACTIVE_PAID_OFFER_ALLOWLIST_MISSING');
 const ids=c.eligible_offer_ids.map(numericId);if(ids.some(x=>!x)||new Set(ids).size!==ids.length)return no('R145_ACTIVE_PAID_OFFER_ALLOWLIST_INVALID');
 if(!exact(c.evidence,EK)||Object.values(c.evidence).some(x=>typeof x!=='string'||!HASH.test(x)))return no('R145_NATIVE_OWNER_EVIDENCE_HASHES_INCOMPLETE');
 return Object.freeze({active:true,code:'R145_GIFT_ACTIVATION_EVIDENCE_COMPLETE',account_host:ACCOUNT_HOST,
  gift_training_id:GIFT.training_id,gift_product_id:GIFT.product_id,gift_lesson_id:GIFT.lesson_id,
  access_days:365,eligible_offer_ids:Object.freeze(ids),provider_grant_idempotency_verified:c.provider_grant_idempotency_verified,
  evidence:Object.freeze({...c.evidence}),window:WINDOW,public_release_allowed:false});
}
function readOwnerPrivateActivation(file){
 if(typeof file!=='string'||!path.isAbsolute(file))return null;
 try{
  const uid=process.getuid?.(),d=fs.lstatSync(path.dirname(file)),s=fs.lstatSync(file);
  if(typeof uid!=='number'||d.uid!==uid||s.uid!==uid||!d.isDirectory()||d.isSymbolicLink()||(d.mode&0o077)!==0||
   !s.isFile()||s.isSymbolicLink()||(s.mode&0o077)!==0||s.size<2||s.size>32768||fs.realpathSync(file)!==file)return null;
  const c=JSON.parse(fs.readFileSync(file,'utf8'));return validateActivation(c).active?c:null;
 }catch{return null}
}
function loadActivation(env=process.env){return readOwnerPrivateActivation(env?.BF2026_R145_SHAME_GIFT_ACTIVATION_FILE)}
function normalizeHint(h){
 if(!h||typeof h!=='object'||Array.isArray(h))fail('R145_CALLBACK_HINT_REQUIRED');
 if(h.source!==CALLBACK_SOURCE||h.auth_method!=='BEARER_SHARED_SECRET'||h.provider_signature_verified!==false)fail('R145_CALLBACK_IS_NOT_AUTHENTICATED_HINT');
 if(!HASH.test(h.event_id||'')||!HASH.test(h.raw_sha256||''))fail('R145_CALLBACK_EVENT_DIGEST_INVALID');
 const id=numericId(h.provider_order_id);if(!id||!CALLBACK_STATUSES.has(h.status_hint))fail('R145_CALLBACK_ORDER_OR_STATUS_INVALID');
 return Object.freeze({source:CALLBACK_SOURCE,event_id:h.event_id,raw_sha256:h.raw_sha256,provider_order_id:id,status_hint:h.status_hint,auth_method:'BEARER_SHARED_SECRET',provider_signature_verified:false});
}
function identityMatches(o,id){return !id||String(o.deal_id)===id||String(o.deal_number)===id}
function validatePaidOrder(o,a,orderId,now){
 if(!o||o.source!=='GETCOURSE_AUTHORIZED_NATIVE_READ_ONLY_ORDER'||o.account_host!==ACCOUNT_HOST||o.native_order_readback_verified!==true||o.native_payment_readback_verified!==true||o.native_refund_readback_verified!==true||!identityMatches(o,orderId))return {ok:false,code:'R145_NATIVE_ORDER_READBACK_UNVERIFIED'};
 const dealId=numericId(o.deal_id),dealNumber=numericId(o.deal_number),userId=numericId(o.user_id);
 if(!dealId||!dealNumber||!userId)return {ok:false,code:'R145_NATIVE_ORDER_IDENTITY_INVALID'};
 const rb=isoMs(o.readback_at);if(rb===null||rb>now+60000||now-rb>300000)return {ok:false,code:'R145_NATIVE_ORDER_READBACK_STALE'};
 if(!HASH.test(o.evidence_sha256||''))return {ok:false,code:'R145_NATIVE_ORDER_EVIDENCE_HASH_MISSING'};
 if(o.refund_status!=='none'||o.refunded_total_rub!==0||o.chargeback===true)return {ok:false,code:'R145_ORDER_REFUNDED_OR_CHARGEBACK'};
 if(o.order_status!=='payed'||o.payment_status!=='paid'||o.native_payment_verified!==true)return {ok:false,code:'R145_ORDER_NOT_FULLY_PAID'};
 if(o.currency!=='RUB'||!Number.isSafeInteger(o.order_total_rub)||o.order_total_rub<=0||!Number.isSafeInteger(o.paid_total_rub)||o.paid_total_rub!==o.order_total_rub)return {ok:false,code:'R145_PAID_TOTAL_NOT_FULLY_RECONCILED'};
 const paid=isoMs(o.paid_at);if(paid===null)return {ok:false,code:'R145_PAID_AT_TIMEZONE_REQUIRED'};
 if(!inGiftWindow(paid))return {ok:false,code:'R145_PAYMENT_OUTSIDE_MOSCOW_24H_WINDOW'};
 if(!Array.isArray(o.positions)||o.positions.length<1||o.positions.length>5)return {ok:false,code:'R145_NATIVE_PAID_POSITIONS_INVALID'};
 const ids=[],seen=new Set();let total=0;
 for(const line of o.positions){const id=numericId(line?.offer_id);if(!id||!a.eligible_offer_ids.includes(id)||seen.has(id)||line.quantity!==1||!Number.isSafeInteger(line.price_rub)||line.price_rub<=0)return {ok:false,code:'R145_ORDER_CONTAINS_NON_ELIGIBLE_OR_DUPLICATE_OFFER'};seen.add(id);ids.push(id);total+=line.price_rub;}
 if(total!==o.order_total_rub)return {ok:false,code:'R145_NATIVE_PAID_POSITION_TOTAL_MISMATCH'};
 return {ok:true,deal_id:dealId,deal_number:dealNumber,user_id:userId,buyer_id_sha256:sha(userId),offer_ids:Object.freeze(ids),order_total_rub:total,paid_at:new Date(paid).toISOString(),readback_sha256:o.evidence_sha256,moscow_paid_at:moscowWallClock(paid)};
}
function evaluatePaidEvidence({callbackHint,nativeOrder,activation,nowMs=Date.now()}={}){
 if(!activation?.active)return {eligible:false,code:'R145_GIFT_ACTIVATION_HOLD'};
 let h;try{h=normalizeHint(callbackHint)}catch(e){return {eligible:false,code:e.code||'R145_CALLBACK_HINT_INVALID'}};
 if(h.status_hint!=='PAID')return {eligible:false,code:'R145_CALLBACK_HINT_NOT_PAID'};
 const r=validatePaidOrder(nativeOrder,activation,h.provider_order_id,nowMs);
 return r.ok?Object.freeze({eligible:true,code:'R145_VERIFIED_PAID_GIFT_ELIGIBLE',...r,event_id:h.event_id,event_payload_sha256:h.raw_sha256,callback_used_as_hint_only:true,provider_signature_verified:false}):Object.freeze({eligible:false,code:r.code});
}
function evaluateRefundEvidence({callbackHint,nativeOrder,activation,nowMs=Date.now()}={}){
 if(!activation?.active)return {eligible:false,code:'R145_GIFT_ACTIVATION_HOLD'};
 let h;try{h=normalizeHint(callbackHint)}catch(e){return {eligible:false,code:e.code||'R145_CALLBACK_HINT_INVALID'}};
 if(h.status_hint!=='REFUND')return {eligible:false,code:'R145_CALLBACK_HINT_NOT_REFUND'};
 const o=nativeOrder,at=isoMs(o?.readback_at);
 if(!o||o.source!=='GETCOURSE_AUTHORIZED_NATIVE_READ_ONLY_ORDER'||o.account_host!==ACCOUNT_HOST||o.native_order_readback_verified!==true||o.native_refund_readback_verified!==true||!identityMatches(o,h.provider_order_id)||at===null||at>nowMs+60000||nowMs-at>300000||!HASH.test(o.evidence_sha256||''))return {eligible:false,code:'R145_REFUND_READBACK_UNVERIFIED'};
 const dealId=numericId(o.deal_id),userId=numericId(o.user_id);if(!dealId||!userId)return {eligible:false,code:'R145_REFUND_ORDER_IDENTITY_INVALID'};
 if(!['partial','full','refunded','chargeback'].includes(o.refund_status)||!Number.isSafeInteger(o.refunded_total_rub)||o.refunded_total_rub<=0)return {eligible:false,code:'R145_REFUND_NOT_CONFIRMED_BY_PROVIDER'};
 return Object.freeze({eligible:true,code:'R145_NATIVE_REFUND_CONFIRMED',deal_id:dealId,buyer_id_sha256:sha(userId),event_id:h.event_id,event_payload_sha256:h.raw_sha256,evidence_sha256:o.evidence_sha256});
}
function sealUserId(id,key){
 if(!Buffer.isBuffer(key)||key.length!==32)fail('R145_USER_ID_ENCRYPTION_KEY_REQUIRED');
 const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv),ct=Buffer.concat([c.update(String(id),'utf8'),c.final()]);
 return {nonce:iv.toString('base64url'),ciphertext:ct.toString('base64url'),tag:c.getAuthTag().toString('base64url')};
}
function openUserId(s,key){
 if(!Buffer.isBuffer(key)||key.length!==32)fail('R145_USER_ID_ENCRYPTION_KEY_REQUIRED');
 const d=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(s.nonce,'base64url'));d.setAuthTag(Buffer.from(s.tag,'base64url'));
 return Buffer.concat([d.update(Buffer.from(s.ciphertext,'base64url')),d.final()]).toString('utf8');
}
function verifyEntitlement(e,{userId,orderId,activation,nowMs=Date.now()}={}){
 if(!e||e.source!=='GETCOURSE_AUTHORIZED_NATIVE_ENTITLEMENT_READBACK'||e.account_host!==ACCOUNT_HOST||e.native_entitlement_readback_verified!==true||String(e.user_id)!==String(userId)||Number(e.training_id)!==GIFT.training_id)return {ok:false,code:'R145_GIFT_ENTITLEMENT_READBACK_UNVERIFIED'};
 const at=isoMs(e.checked_at);if(at===null||at>nowMs+60000||nowMs-at>300000||!HASH.test(e.evidence_sha256||''))return {ok:false,code:'R145_GIFT_ENTITLEMENT_READBACK_STALE'};
 if(e.access_status==='NOT_FOUND'&&e.no_active_entitlement===true)return {ok:true,exists:false};
 if(e.access_status!=='ACTIVE')return {ok:false,code:'R145_GIFT_ENTITLEMENT_STATE_UNKNOWN'};
 const start=isoMs(e.access_from),end=isoMs(e.access_until);if(start===null||end===null||end<=start||Math.abs((end-start)/86400000-activation.access_days)>1.1)return {ok:false,code:'R145_GIFT_ENTITLEMENT_TERM_MISMATCH'};
 if(e.grant_source!=='BF2026_R145_SHAME_GIFT'||String(e.source_order_id)!==String(orderId)||e.access_days!==activation.access_days||!numericId(String(e.native_grant_id||'')))return {ok:false,code:'R145_GIFT_ENTITLEMENT_SOURCE_MISMATCH'};
 return {ok:true,exists:true,native_grant_id:String(e.native_grant_id),access_from:new Date(start).toISOString(),access_until:new Date(end).toISOString()};
}
function createPostgresStore(pool){
 if(typeof pool?.connect!=='function')fail('R145_POSTGRES_POOL_REQUIRED');
 async function enqueue(event,gift){
  const c=await pool.connect();let tx=false;
  try{
   await c.query('BEGIN');tx=true;await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['bf2026-r145-gift:'+gift.buyer_id_sha256]);
   const old=await c.query('SELECT raw_sha256 FROM bf2026_r145_shame_gift_events WHERE account_host=$1 AND event_id=$2',[ACCOUNT_HOST,event.event_id]);
   if(old.rows.length){if(old.rows[0].raw_sha256!==event.raw_sha256)fail('R145_CALLBACK_REPLAY_PAYLOAD_CONFLICT');await c.query('COMMIT');tx=false;return {status:'DUPLICATE_CALLBACK',duplicate:true};}
   await c.query("INSERT INTO bf2026_r145_shame_gift_events(account_host,event_id,raw_sha256,provider_order_id,buyer_id_sha256,decision,native_readback_sha256,paid_at,offer_ids,order_total_rub) VALUES($1,$2,$3,$4,$5,'ELIGIBLE',$6,$7,$8::bigint[],$9)",[ACCOUNT_HOST,event.event_id,event.raw_sha256,gift.source_order_id,gift.buyer_id_sha256,gift.native_readback_sha256,gift.paid_at,gift.offer_ids,gift.order_total_rub]);
   const ins=await c.query("INSERT INTO bf2026_r145_shame_gift_outbox(gift_key,account_host,buyer_id_sha256,user_id_nonce,user_id_ciphertext,user_id_tag,training_id,product_id,source_order_id,source_event_id,offer_ids,order_total_rub,paid_at,access_days,grant_idempotency_key,state,attempt_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::bigint[],$12,$13,$14,$15,'READY',0) ON CONFLICT(account_host,buyer_id_sha256,training_id) DO NOTHING RETURNING gift_key",[gift.gift_key,ACCOUNT_HOST,gift.buyer_id_sha256,gift.user_id_nonce,gift.user_id_ciphertext,gift.user_id_tag,GIFT.training_id,GIFT.product_id,gift.source_order_id,event.event_id,gift.offer_ids,gift.order_total_rub,gift.paid_at,GIFT.access_days,gift.grant_idempotency_key]);
   if(ins.rowCount===1){await c.query('COMMIT');tx=false;return {status:'QUEUED_NOT_GRANTED',duplicate:false,gift_key:gift.gift_key};}
   const priorGift=await c.query('SELECT state FROM bf2026_r145_shame_gift_outbox WHERE account_host=$1 AND buyer_id_sha256=$2 AND training_id=$3',[ACCOUNT_HOST,gift.buyer_id_sha256,GIFT.training_id]);
   await c.query('COMMIT');tx=false;return {status:'BUYER_ALREADY_CLAIMED',duplicate:false,existing_state:priorGift.rows[0]?.state||'UNKNOWN'};
  }catch(e){if(tx)try{await c.query('ROLLBACK')}catch{}throw e}finally{c.release?.()}
 }
 async function claimNext(nowMs=Date.now(),leaseMs=120000){
  const c=await pool.connect();let tx=false;
  try{
   await c.query('BEGIN');tx=true;
   const q=await c.query("SELECT * FROM bf2026_r145_shame_gift_outbox WHERE state IN ('READY','GRANTING','RECONCILIATION_REQUIRED') AND (state='READY' OR lease_until IS NULL OR lease_until<to_timestamp($1/1000.0)) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED",[nowMs]);
   if(!q.rows.length){await c.query('COMMIT');tx=false;return null;}
   const u=await c.query("UPDATE bf2026_r145_shame_gift_outbox SET state='GRANTING',attempt_count=attempt_count+1,lease_until=to_timestamp($2/1000.0),updated_at=now() WHERE gift_key=$1 RETURNING *",[q.rows[0].gift_key,nowMs+leaseMs]);
   await c.query('COMMIT');tx=false;return u.rows[0]||null;
  }catch(e){if(tx)try{await c.query('ROLLBACK')}catch{}throw e}finally{c.release?.()}
 }
 async function markState(key,state,d={}){
  if(!STATES.has(state))fail('R145_OUTBOX_STATE_INVALID');
  const q=await pool.query('UPDATE bf2026_r145_shame_gift_outbox SET state=$2,provider_grant_id=$3,access_from=$4,access_until=$5,last_code=$6,lease_until=NULL,updated_at=now() WHERE gift_key=$1 RETURNING state',[key,state,d.provider_grant_id||null,d.access_from||null,d.access_until||null,d.code||null]);return q.rowCount===1;
 }
 async function recordRefund({orderId,buyerHash,evidenceSha,eventId,rawSha}){
  const c=await pool.connect();let tx=false;
  try{
   await c.query('BEGIN');tx=true;await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['bf2026-r145-gift:'+buyerHash]);
   const old=await c.query('SELECT raw_sha256 FROM bf2026_r145_shame_gift_events WHERE account_host=$1 AND event_id=$2',[ACCOUNT_HOST,eventId]);
   if(old.rows.length){if(old.rows[0].raw_sha256!==rawSha)fail('R145_CALLBACK_REPLAY_PAYLOAD_CONFLICT');await c.query('COMMIT');tx=false;return {updated:0,duplicate:true,states:[]};}
   await c.query("INSERT INTO bf2026_r145_shame_gift_events(account_host,event_id,raw_sha256,provider_order_id,buyer_id_sha256,decision,native_readback_sha256) VALUES($1,$2,$3,$4,$5,'REFUND_CONFIRMED',$6)",[ACCOUNT_HOST,eventId,rawSha,orderId,buyerHash,evidenceSha]);
   const q=await c.query("UPDATE bf2026_r145_shame_gift_outbox SET state=CASE WHEN state='GRANTED' THEN 'REFUND_AFTER_GRANT_REVIEW' ELSE 'REFUNDED_NO_GRANT' END,last_code=$3,lease_until=NULL,updated_at=now() WHERE account_host=$1 AND source_order_id=$2 AND state IN ('READY','GRANTING','GRANTED','RECONCILIATION_REQUIRED','HOLD') RETURNING state",[ACCOUNT_HOST,orderId,'R145_NATIVE_REFUND_CONFIRMED:'+evidenceSha]);
   await c.query('COMMIT');tx=false;return {updated:q.rowCount,duplicate:false,states:q.rows.map(x=>x.state)};
  }catch(e){if(tx)try{await c.query('ROLLBACK')}catch{}throw e}finally{c.release?.()}
 }
 async function getState(key){const q=await pool.query('SELECT state,attempt_count,provider_write_attempt_count FROM bf2026_r145_shame_gift_outbox WHERE gift_key=$1',[key]);return q.rows[0]||null;}
 async function recordProviderWriteAttempt(key){const q=await pool.query("UPDATE bf2026_r145_shame_gift_outbox SET provider_write_attempt_count=provider_write_attempt_count+1,updated_at=now() WHERE gift_key=$1 AND state='GRANTING' RETURNING provider_write_attempt_count",[key]);return Number(q.rows[0]?.provider_write_attempt_count)||0;}
 return Object.freeze({enqueue,claimNext,markState,recordRefund,getState,recordProviderWriteAttempt});
}
function createGiftCoordinator({store,activationProvider=()=>null,readNativeOrder,userIdEncryptionKeyProvider=()=>null,providerAdapter=null,clock=()=>Date.now()}={}){
 if(!store||typeof store.enqueue!=='function'||typeof store.claimNext!=='function'||typeof store.markState!=='function'||typeof store.recordRefund!=='function'||typeof store.recordProviderWriteAttempt!=='function'||typeof readNativeOrder!=='function'||typeof activationProvider!=='function'||typeof userIdEncryptionKeyProvider!=='function'||typeof clock!=='function')fail('R145_COORDINATOR_DEPENDENCIES_REQUIRED');
 function activation(){let c;try{c=activationProvider()}catch{return validateActivation(null)}return c?.active===true?c:validateActivation(c);}
 function status(){const a=activation();return Object.freeze({ok:true,active:a.active,code:a.code,gift_training_id:GIFT.training_id,window:WINDOW,provider_write_enabled:a.active&&providerAdapter?.capabilities?.native_grant_write_verified===true,grant_writes:0,public_release_allowed:false});}
 async function processRefundHint(raw){
  const a=activation();if(!a.active)return {updated:0,grant_writes:0,code:a.code};let h;try{h=normalizeHint(raw)}catch(e){return {updated:0,grant_writes:0,code:e.code||'R145_CALLBACK_HINT_INVALID'};}
  if(h.status_hint!=='REFUND')return {updated:0,grant_writes:0,code:'R145_NOT_A_REFUND_HINT'};let o;try{o=await readNativeOrder({provider_order_id:h.provider_order_id})}catch{return {updated:0,grant_writes:0,code:'R145_REFUND_READBACK_UNAVAILABLE'};}
  const d=evaluateRefundEvidence({callbackHint:h,nativeOrder:o,activation:a,nowMs:clock()});if(!d.eligible)return {updated:0,grant_writes:0,code:d.code};
  try{return {...await store.recordRefund({orderId:d.deal_id,buyerHash:d.buyer_id_sha256,evidenceSha:d.evidence_sha256,eventId:d.event_id,rawSha:d.event_payload_sha256}),grant_writes:0,code:'R145_REFUND_RECORDED_NO_NEW_GRANT'};}catch(e){return {updated:0,grant_writes:0,code:e.code||'R145_REFUND_PERSIST_FAILED'};}
 }
 async function processCallbackHint(raw){
  const a=activation();if(!a.active)return {queued:false,grant_writes:0,code:a.code};let h;try{h=normalizeHint(raw)}catch(e){return {queued:false,grant_writes:0,code:e.code||'R145_CALLBACK_HINT_INVALID'};}
  if(h.status_hint==='REFUND')return processRefundHint(raw);if(h.status_hint!=='PAID')return {queued:false,grant_writes:0,code:'R145_NO_GRANT_ORDER_NOT_PAID'};
  let o;try{o=await readNativeOrder({provider_order_id:h.provider_order_id})}catch{return {queued:false,grant_writes:0,code:'R145_NATIVE_PAYMENT_READBACK_UNAVAILABLE'};}
  const d=evaluatePaidEvidence({callbackHint:h,nativeOrder:o,activation:a,nowMs:clock()});if(!d.eligible)return {queued:false,grant_writes:0,code:d.code};
  let key;try{key=userIdEncryptionKeyProvider()}catch{key=null}if(!Buffer.isBuffer(key)||key.length!==32)return {queued:false,grant_writes:0,code:'R145_USER_ID_ENCRYPTION_KEY_NOT_CONFIGURED'};
  const sealed=sealUserId(d.user_id,key),giftKey=sha(ACCOUNT_HOST+'|'+d.buyer_id_sha256+'|'+GIFT.training_id);
  const gift={gift_key:giftKey,buyer_id_sha256:d.buyer_id_sha256,user_id_nonce:sealed.nonce,user_id_ciphertext:sealed.ciphertext,user_id_tag:sealed.tag,source_order_id:d.deal_id,source_event_id:h.event_id,offer_ids:d.offer_ids,order_total_rub:d.order_total_rub,paid_at:d.paid_at,native_readback_sha256:d.readback_sha256,grant_idempotency_key:sha('BF2026_R145_NATIVE_GIFT_GRANT|'+giftKey)};
  try{const saved=await store.enqueue({event_id:h.event_id,raw_sha256:h.raw_sha256},gift);return {...saved,queued:saved.status==='QUEUED_NOT_GRANTED',grant_writes:0,payment_verified:true,refund_verified:true,public_release_allowed:false};}catch(e){return {queued:false,grant_writes:0,code:e.code||'R145_DURABLE_ENQUEUE_FAILED'};}
 }
 async function drainOne(){
  const a=activation();if(!a.active)return {processed:false,provider_write_attempts:0,grant_writes_verified:0,code:a.code};const p=providerAdapter;
  if(!p||typeof p.readGiftEntitlement!=='function'||typeof p.grantGiftAccess!=='function'||p.capabilities?.native_grant_write_verified!==true||p.capabilities?.native_entitlement_readback_verified!==true)return {processed:false,provider_write_attempts:0,grant_writes_verified:0,code:'R145_NATIVE_ENTITLEMENT_PROVIDER_NOT_APPROVED'};
  let row;try{row=await store.claimNext(clock())}catch{return {processed:false,provider_write_attempts:0,grant_writes_verified:0,code:'R145_OUTBOX_CLAIM_FAILED'};}if(!row)return {processed:false,provider_write_attempts:0,grant_writes_verified:0,code:'R145_OUTBOX_EMPTY'};
  const key=(()=>{try{return userIdEncryptionKeyProvider()}catch{return null}})(),gk=String(row.gift_key);if(!Buffer.isBuffer(key)||key.length!==32){await store.markState(gk,'HOLD',{code:'R145_USER_ID_ENCRYPTION_KEY_NOT_CONFIGURED'});return {processed:true,provider_write_attempts:0,grant_writes_verified:0,code:'R145_USER_ID_ENCRYPTION_KEY_NOT_CONFIGURED'};}
  let userId;try{userId=openUserId({nonce:row.user_id_nonce,ciphertext:row.user_id_ciphertext,tag:row.user_id_tag},key)}catch{await store.markState(gk,'HOLD',{code:'R145_USER_ID_DECRYPT_FAILED'});return {processed:true,provider_write_attempts:0,grant_writes_verified:0,code:'R145_USER_ID_DECRYPT_FAILED'};}
  let o;try{o=await readNativeOrder({provider_order_id:String(row.source_order_id)})}catch{await store.markState(gk,'RECONCILIATION_REQUIRED',{code:'R145_PRE_GRANT_PAYMENT_READBACK_FAILED'});return {processed:true,provider_write_attempts:0,grant_writes_verified:0,code:'R145_PRE_GRANT_PAYMENT_READBACK_FAILED'};}
  const h={source:CALLBACK_SOURCE,event_id:String(row.source_event_id),raw_sha256:String(row.source_event_id),provider_order_id:String(row.source_order_id),status_hint:'PAID',auth_method:'BEARER_SHARED_SECRET',provider_signature_verified:false};
  const paid=evaluatePaidEvidence({callbackHint:h,nativeOrder:o,activation:a,nowMs:clock()});if(!paid.eligible){const state=paid.code==='R145_ORDER_REFUNDED_OR_CHARGEBACK'?'REFUNDED_NO_GRANT':'HOLD';await store.markState(gk,state,{code:paid.code});return {processed:true,provider_write_attempts:0,grant_writes_verified:0,code:paid.code};}
  let current=await store.getState?.(gk);if(current&&current.state!=='GRANTING')return {processed:true,provider_write_attempts:0,grant_writes_verified:0,code:'R145_OUTBOX_NO_LONGER_GRANTABLE'};
  let before;try{before=await p.readGiftEntitlement({userId,trainingId:GIFT.training_id})}catch{await store.markState(gk,'RECONCILIATION_REQUIRED',{code:'R145_PRE_GRANT_ENTITLEMENT_READBACK_FAILED'});return {processed:true,provider_write_attempts:0,grant_writes_verified:0,code:'R145_PRE_GRANT_ENTITLEMENT_READBACK_FAILED'};}
  const checked=isoMs(before?.checked_at);if(!before||before.source!=='GETCOURSE_AUTHORIZED_NATIVE_ENTITLEMENT_READBACK'||before.account_host!==ACCOUNT_HOST||before.native_entitlement_readback_verified!==true||String(before.user_id)!==userId||Number(before.training_id)!==GIFT.training_id||checked===null||checked>clock()+60000||clock()-checked>300000||!HASH.test(before.evidence_sha256||'')){await store.markState(gk,'RECONCILIATION_REQUIRED',{code:'R145_PRE_GRANT_ENTITLEMENT_NOT_VERIFIED'});return {processed:true,provider_write_attempts:0,grant_writes_verified:0,code:'R145_PRE_GRANT_ENTITLEMENT_NOT_VERIFIED'};}
  if(before.access_status==='ACTIVE'){await store.markState(gk,'ALREADY_ENTITLED',{code:'R145_BUYER_ALREADY_HAS_GIFT'});return {processed:true,provider_write_attempts:0,grant_writes_verified:0,code:'R145_BUYER_ALREADY_HAS_GIFT'};}
  if(before.access_status!=='NOT_FOUND'||before.no_active_entitlement!==true){await store.markState(gk,'RECONCILIATION_REQUIRED',{code:'R145_PRE_GRANT_ENTITLEMENT_STATE_UNKNOWN'});return {processed:true,provider_write_attempts:0,grant_writes_verified:0,code:'R145_PRE_GRANT_ENTITLEMENT_STATE_UNKNOWN'};}
  if(Number(row.provider_write_attempt_count)>0&&!a.provider_grant_idempotency_verified){await store.markState(gk,'HOLD',{code:'R145_RESTART_UNCERTAIN_NO_PROVIDER_IDEMPOTENCY'});return {processed:true,provider_write_attempts:0,grant_writes_verified:0,code:'R145_RESTART_UNCERTAIN_NO_PROVIDER_IDEMPOTENCY'};}
  if(a.provider_grant_idempotency_verified&&p.capabilities.native_grant_idempotency_verified!==true){await store.markState(gk,'HOLD',{code:'R145_PROVIDER_IDEMPOTENCY_CAPABILITY_MISMATCH'});return {processed:true,provider_write_attempts:0,grant_writes_verified:0,code:'R145_PROVIDER_IDEMPOTENCY_CAPABILITY_MISMATCH'};}
  current=await store.getState?.(gk);if(current&&current.state!=='GRANTING')return {processed:true,provider_write_attempts:0,grant_writes_verified:0,code:'R145_OUTBOX_REVOKED_BEFORE_PROVIDER_WRITE'};
  let attemptNo=0;try{attemptNo=await store.recordProviderWriteAttempt(gk)}catch{}if(!attemptNo){await store.markState(gk,'HOLD',{code:'R145_PROVIDER_WRITE_ATTEMPT_NOT_DURABLE'});return {processed:true,provider_write_attempts:0,grant_writes_verified:0,code:'R145_PROVIDER_WRITE_ATTEMPT_NOT_DURABLE'};}
  let ack;try{ack=await p.grantGiftAccess({userId,trainingId:GIFT.training_id,productId:GIFT.product_id,accessDays:a.access_days,source:'BF2026_R145_SHAME_GIFT',sourceOrderId:String(row.source_order_id),idempotencyKey:String(row.grant_idempotency_key)});}catch{await store.markState(gk,'RECONCILIATION_REQUIRED',{code:'R145_PROVIDER_GRANT_OUTCOME_UNKNOWN'});return {processed:true,provider_write_attempts:1,grant_writes_verified:0,code:'R145_PROVIDER_GRANT_OUTCOME_UNKNOWN'};}
  if(!ack||ack.accepted!==true||!numericId(String(ack.native_grant_id||''))){await store.markState(gk,'RECONCILIATION_REQUIRED',{code:'R145_PROVIDER_GRANT_ACK_UNVERIFIED'});return {processed:true,provider_write_attempts:1,grant_writes_verified:0,code:'R145_PROVIDER_GRANT_ACK_UNVERIFIED'};}
  let after;try{after=await p.readGiftEntitlement({userId,trainingId:GIFT.training_id})}catch{await store.markState(gk,'RECONCILIATION_REQUIRED',{code:'R145_POST_GRANT_ENTITLEMENT_READBACK_FAILED'});return {processed:true,provider_write_attempts:1,grant_writes_verified:0,code:'R145_POST_GRANT_ENTITLEMENT_READBACK_FAILED'};}
  const v=verifyEntitlement(after,{userId,orderId:String(row.source_order_id),activation:a,nowMs:clock()});if(!v.ok||!v.exists||v.native_grant_id!==String(ack.native_grant_id)){await store.markState(gk,'RECONCILIATION_REQUIRED',{code:v.code||'R145_POST_GRANT_NATIVE_READBACK_MISMATCH'});return {processed:true,provider_write_attempts:1,grant_writes_verified:0,code:v.code||'R145_POST_GRANT_NATIVE_READBACK_MISMATCH'};}
  await store.markState(gk,'GRANTED',{provider_grant_id:v.native_grant_id,access_from:v.access_from,access_until:v.access_until,code:'R145_NATIVE_GIFT_ENTITLEMENT_VERIFIED'});return {processed:true,provider_write_attempts:1,grant_writes_verified:1,code:'R145_NATIVE_GIFT_ENTITLEMENT_VERIFIED',training_id:GIFT.training_id,access_days:a.access_days,public_release_allowed:false};
 }
 return Object.freeze({status,processCallbackHint,processRefundHint,drainOne});
}
module.exports={ACCOUNT_HOST,ACTIVATION_SCHEMA,GIFT,WINDOW,STATES,sha,numericId,isoMs,inGiftWindow,moscowWallClock,validateActivation,readOwnerPrivateActivation,loadActivation,normalizeHint,evaluatePaidEvidence,evaluateRefundEvidence,sealUserId,openUserId,verifyEntitlement,createPostgresStore,createGiftCoordinator};
