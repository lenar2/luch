'use strict';
// GetCourse Process "Call URL" callback identity. GetCourse docs do not
// specify a provider signature; this is a configured shared-secret header,
// not a provider-signed webhook. Event remains a hint only.
const crypto=require('node:crypto');
const HOST='study.shkola-dnv.com';
const SOURCE='GETCOURSE_SHARED_SECRET_CALLBACK';
const SCHEMA='bf2026.getcourse.callback.hint.v1';
const ORDER='71994',DEAL='924624456',OFFER=8935004,AMOUNT=11690;
function fail(code){const e=new Error(code);e.code=code;throw e}
function secretFromEnv(env=process.env){
 const raw=env.BF2026_GETCOURSE_CALLBACK_SECRET_HEX||'';
 if(!/^[a-f0-9]{64,128}$/i.test(raw)||raw.length%2) return null;
 return Buffer.from(raw,'hex');
}
function verifyCallback({rawBody,authorization,accountHost,secret,nowMs=Date.now()}={}){
 if(!Buffer.isBuffer(secret)||secret.length<32)fail('GETCOURSE_CALLBACK_SECRET_NOT_CONFIGURED');
 if(!Buffer.isBuffer(rawBody)||rawBody.length<2||rawBody.length>2048)fail('GETCOURSE_CALLBACK_BODY_INVALID');
 if(accountHost!==HOST)fail('GETCOURSE_CALLBACK_ACCOUNT_IDENTITY_MISMATCH');
 if(typeof authorization!=='string'||!authorization.startsWith('Bearer '))fail('GETCOURSE_CALLBACK_AUTH_REQUIRED');
 const supplied=Buffer.from(authorization.slice(7),'hex');
 if(supplied.length!==secret.length||!crypto.timingSafeEqual(supplied,secret))
  fail('GETCOURSE_CALLBACK_SHARED_SECRET_INVALID');
 let body;try{body=JSON.parse(rawBody.toString('utf8'))}catch{fail('GETCOURSE_CALLBACK_JSON_INVALID')}
 const allowed=['schema','account_host','deal_id','deal_number','offers','status','cost_money_value',
  'payed_money','payed_at','created_at'];
 if(!body||typeof body!=='object'||Array.isArray(body)||
  Object.keys(body).sort().join('|')!==allowed.sort().join('|'))fail('GETCOURSE_CALLBACK_FIELDS_INVALID');
 if(body.schema!==SCHEMA||body.account_host!==HOST||String(body.deal_id)!==DEAL||
  String(body.deal_number)!==ORDER)fail('GETCOURSE_CALLBACK_ORDER_IDENTITY_MISMATCH');
 const offers=(Array.isArray(body.offers)?body.offers:String(body.offers||'').split(/[,\s;]+/))
  .map(x=>String(x).trim()).filter(Boolean).sort();
 if(offers.length!==1||offers[0]!==String(OFFER))fail('GETCOURSE_CALLBACK_OFFER_MISMATCH');
 const amount=Number(String(body.cost_money_value).replace(/\s/g,'').replace(',','.'));
 if(!Number.isFinite(amount)||amount!==AMOUNT)fail('GETCOURSE_CALLBACK_AMOUNT_MISMATCH');
 const status=String(body.status||'').toLowerCase();
 if(!['new','payed','part_payed','cancelled','false','payment_waiting','waiting_for_return'].includes(status))
  fail('GETCOURSE_CALLBACK_STATUS_INVALID');
 const paid=Number(String(body.payed_money??'').replace(/\s/g,'').replace(',','.'));
 if(!Number.isFinite(paid)||paid<0||paid>AMOUNT)fail('GETCOURSE_CALLBACK_PAID_AMOUNT_INVALID');
 if(status==='new'&&paid!==0)fail('GETCOURSE_CALLBACK_NEW_WITH_PAID_AMOUNT');
 if(status==='payed'&&paid!==AMOUNT)fail('GETCOURSE_CALLBACK_PAID_TOTAL_MISMATCH');
 const occurred=status==='payed'?Date.parse(body.payed_at):Date.parse(body.created_at);
 if(!Number.isFinite(occurred)||occurred>nowMs+300000||occurred<nowMs-365*24*3600*1000)
  fail('GETCOURSE_CALLBACK_EVENT_TIME_INVALID');
 const digest=crypto.createHash('sha256').update(rawBody).digest('hex');
 return Object.freeze({source:SOURCE,event_id:digest,provider_order_id:DEAL,
  order_number:ORDER,offer_id:OFFER,status_hint:status==='payed'?'PAID':
   status==='new'?'UNPAID':status.toUpperCase(),order_total_rub:AMOUNT,
  paid_total_rub:paid,occurred_at:new Date(occurred).toISOString(),raw_sha256:digest,
  auth_method:'BEARER_SHARED_SECRET',provider_signature_verified:false,
  payment_verified:false,receipt_verified:false,grants_verified:false,grant_writes:0});
}
function createStore(pool){
 if(typeof pool?.query!=='function')fail('GETCOURSE_CALLBACK_PG_REQUIRED');
 return {async accept(event){
  if(!event||event.source!==SOURCE||event.event_id!==event.raw_sha256)fail('GETCOURSE_CALLBACK_VERIFIED_EVENT_REQUIRED');
  const q=await pool.query("INSERT INTO bf2026_getcourse_callback_hints(event_id,provider_order_id,order_number,offer_id,status_hint,order_total_rub,paid_total_rub,occurred_at,raw_sha256,auth_method,provider_signature_verified) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false) ON CONFLICT(event_id) DO NOTHING RETURNING event_id",
   [event.event_id,event.provider_order_id,event.order_number,event.offer_id,event.status_hint,event.order_total_rub,event.paid_total_rub,event.occurred_at,event.raw_sha256,event.auth_method]);
  if(q.rowCount)return {status:'ACCEPTED_HINT_ONLY',duplicate:false};
  const old=await pool.query('SELECT provider_order_id,order_number,offer_id,status_hint,raw_sha256 FROM bf2026_getcourse_callback_hints WHERE event_id=$1',[event.event_id]);
  const r=old.rows?.[0];
  if(!r||r.provider_order_id!==event.provider_order_id||r.order_number!==event.order_number||
   Number(r.offer_id)!==event.offer_id||r.status_hint!==event.status_hint||r.raw_sha256!==event.raw_sha256)
   fail('GETCOURSE_CALLBACK_REPLAY_CONFLICT');
  return {status:'DUPLICATE_HINT_ONLY',duplicate:true};
 }};
}
async function ingest({rawBody,authorization,accountHost,secret,store,nowMs=Date.now()}={}){
 const event=verifyCallback({rawBody,authorization,accountHost,secret,nowMs});
 if(typeof store?.accept!=='function')fail('GETCOURSE_CALLBACK_STORE_REQUIRED');
 const saved=await store.accept(event);
 return {ok:true,http_status:202,status:saved.status,duplicate:saved.duplicate,
  provider_order_id:event.provider_order_id,order_number:event.order_number,
  status_hint:event.status_hint,auth_method:event.auth_method,
  provider_signature_verified:false,payment_verified:false,receipt_verified:false,
  grants_verified:false,grant_writes:0,release_allowed:false};
}
module.exports={HOST,SOURCE,SCHEMA,secretFromEnv,verifyCallback,createStore,ingest};
