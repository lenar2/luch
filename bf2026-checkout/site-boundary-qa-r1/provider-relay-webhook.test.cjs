'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {SCHEMA,SOURCE,hmac,verifyRelayHint,createPostgresEventInbox,ingestRelayEvent,guardPaidProof}=require('./provider-relay-webhook.cjs');
const secret=Buffer.alloc(40,0x45),nowMs=2000000000000,stamp=String(nowMs/1000);
function event(overrides={}){
 return {schema:SCHEMA,event_id:'evt12345',provider_order_id:'GCORDER1234',
  status_hint:'PAID',occurred_at:new Date(nowMs).toISOString(),...overrides};
}
function signed(body=event(),when=stamp){
 const raw=Buffer.from(JSON.stringify(body));
 return {rawBody:raw,timestamp:when,signature:hmac(secret,when,raw),secret,nowMs};
}
function fakePool(){
 const events=new Map();
 return {events,pool:{async query(sql,p){
  if(sql.startsWith('INSERT INTO bf2026_native_event_inbox')){
   const key=p[0]+':'+p[1];
   if(events.has(key))return {rowCount:0,rows:[]};
   events.set(key,{source:p[0],event_id:p[1],provider_order_id:p[2],status_hint:p[3],
    occurred_at:p[4],raw_sha256:p[5]});
   return {rowCount:1,rows:[{event_id:p[1]}]};
  }
  if(sql.startsWith('SELECT provider_order_id,status_hint,raw_sha256')){
   const row=events.get(p[0]+':'+p[1]);return {rowCount:row?1:0,rows:row?[row]:[]};
  }
  throw Error('UNHANDLED_FAKE_SQL');
 }}};
}
test('HMAC relay signature covers exact bytes and timestamp; does NOT prove a native payment',()=>{
 const result=verifyRelayHint(signed());
 assert.equal(result.source,SOURCE);assert.equal(result.status_hint,'PAID');
 assert.equal(result.provider_order_id,'GCORDER1234');
 assert.equal(Object.keys(result).includes('payment_verified'),false);
 assert.equal(Object.isFrozen(result),true);
});
test('modified, expired or future timestamps and wrong signature fail closed',()=>{
 const x=signed();
 assert.throws(()=>verifyRelayHint({...x,rawBody:Buffer.concat([x.rawBody,Buffer.from(' ')])}),{code:'RELAY_SIGNATURE_INVALID'});
 assert.throws(()=>verifyRelayHint({...x,signature:'0'.repeat(64)}),{code:'RELAY_SIGNATURE_INVALID'});
 assert.throws(()=>verifyRelayHint({...x,nowMs:nowMs+301000}),{code:'RELAY_TIMESTAMP_EXPIRED'});
 assert.throws(()=>verifyRelayHint({...x,nowMs:nowMs-301000}),{code:'RELAY_TIMESTAMP_EXPIRED'});
 assert.throws(()=>verifyRelayHint({...x,secret:Buffer.alloc(8)}),{code:'RELAY_HMAC_KEY_NOT_CONFIGURED'});
});
test('buyer PII and spoofed price or grant claim are not allowed in hint schema',()=>{
 for(const extra of [{email:'buyer@example.com'},{paid_total_rub:11690},{grant_verified:true},{offer_id:8933492}]){
  assert.throws(()=>verifyRelayHint(signed(event(extra))),{code:'RELAY_HINT_FIELDS_INVALID'});
 }
 assert.throws(()=>verifyRelayHint(signed(event({status_hint:'PAID_CONFIRMED'}))),{code:'RELAY_HINT_VALUES_INVALID'});
});
test('PostgreSQL inbox deduplicates same event ID; conflict is rejected',async()=>{
 const db=fakePool(),store=createPostgresEventInbox(db.pool);
 const x=verifyRelayHint(signed());
 const first=await store.accept(x),second=await store.accept(x);
 assert.equal(first.status,'ACCEPTED_PENDING_READBACK');
 assert.equal(second.status,'DUPLICATE_PENDING_READBACK');
 assert.equal(db.events.size,1);
 assert.equal(first.payment_verified,false);
 await assert.rejects(()=>store.accept({...x,raw_sha256:'a'.repeat(64)}),{code:'RELAY_EVENT_ID_REPLAY_CONFLICT'});
});
test('authenticated PAID hint alone returns 202 PENDING, never grants or sale release',async()=>{
 const db=fakePool();
 const x=await ingestRelayEvent({...signed(),store:createPostgresEventInbox(db.pool)});
 assert.equal(x.http_status,202);assert.equal(x.status,'ACCEPTED_PENDING_READBACK');
 assert.equal(x.payment_verified,false);assert.equal(x.release_allowed,false);
 assert.equal(x.grant_writes,0);
 assert.equal(db.events.size,1);
});
test('a hint may only be reconciled against independent 11690 paid native evidence',()=>{
 const x=verifyRelayHint(signed()),receipt={status:'PAID_NATIVE_READBACK_VERIFIED',
  provider_order_id:'GCORDER1234',paid_event_id:'GC-EV-123',paid_total_rub:11690,
  actual_grants_verified:2,grant_writes:0,receipt_tax_verified:true,consent_verified:true};
 assert.equal(guardPaidProof({event:x,receipt}).payment_verified,false);
 assert.throws(()=>guardPaidProof({event:x,receipt:{...receipt,paid_total_rub:12990}}),{code:'INDEPENDENT_PROVIDER_PAID_PROOF_REQUIRED'});
 assert.throws(()=>guardPaidProof({event:x,receipt:{...receipt,provider_order_id:'OTHER'}}),{code:'INDEPENDENT_PROVIDER_PAID_PROOF_REQUIRED'});
 assert.throws(()=>guardPaidProof({event:x,receipt:{...receipt,actual_grants_verified:1}}),{code:'INDEPENDENT_PROVIDER_PAID_PROOF_REQUIRED'});
 assert.throws(()=>guardPaidProof({event:x,receipt:{...receipt,grant_writes:2}}),{code:'INDEPENDENT_PROVIDER_PAID_PROOF_REQUIRED'});
});

test('R115 inbox migration is additive, unique per relay event and never writes grants',()=>{
 const sql=require('node:fs').readFileSync(__dirname+'/r115-event-inbox.sql','utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS bf2026_native_event_inbox/);
 assert.match(sql,/PRIMARY KEY \(source,event_id\)/);
 assert.match(sql,/PENDING_PROVIDER_READBACK/);
 assert.match(sql,/BEGIN;[\s\S]*COMMIT;/);
 assert.doesNotMatch(sql,/UPDATE\s+bf2026_native_checkout_paid_events/i);
});
test('concurrent same-ID callback delivery creates a single durable inbox record',async()=>{
 const db=fakePool(),store=createPostgresEventInbox(db.pool),e=verifyRelayHint(signed());
 const out=await Promise.all([store.accept(e),store.accept(e),store.accept(e)]);
 assert.equal(out.filter(x=>x.status==='ACCEPTED_PENDING_READBACK').length,1);
 assert.equal(out.filter(x=>x.status==='DUPLICATE_PENDING_READBACK').length,2);
 assert.equal(db.events.size,1);
});
