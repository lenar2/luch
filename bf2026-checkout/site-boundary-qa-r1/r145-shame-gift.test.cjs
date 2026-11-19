'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const R=require('./r145-shame-gift.cjs');
const NOW=Date.parse('2026-11-20T08:00:00.000Z');
const KEY=Buffer.alloc(32,7);
const ACTIVE_OFFERS=['8933492','8919715','8934207','8934247','8937776','8937784'];
function activation(overrides={}){
 const evidence={owner_approval_sha256:'a'.repeat(64),training_readback_sha256:'b'.repeat(64),product_mapping_sha256:'c'.repeat(64),payment_readback_sha256:'d'.repeat(64),refund_readback_sha256:'e'.repeat(64),entitlement_readback_sha256:'f'.repeat(64),grant_write_sha256:'1'.repeat(64),offer_registry_sha256:'2'.repeat(64),process_configuration_sha256:'3'.repeat(64)};
 return {schema:R.ACTIVATION_SCHEMA,enabled:true,owner_approved:true,ui_owner_approval_verified:true,account_host:R.ACCOUNT_HOST,gift_training_id:936028240,gift_product_id:4559950,gift_lesson_id:350912495,access_days:365,access_days_owner_approved:true,training_readback_verified:true,product_training_mapping_verified:true,native_payment_readback_verified:true,native_refund_readback_verified:true,native_entitlement_readback_verified:true,native_grant_write_verified:true,provider_grant_idempotency_verified:false,offer_registry_readback_verified:true,eligible_offer_ids:ACTIVE_OFFERS,evidence,...overrides};
}
function hint(status='PAID',n='1'){
 const id=String(n).padStart(64,'0');return {source:'GETCOURSE_SHARED_SECRET_CALLBACK',event_id:id,raw_sha256:crypto.createHash('sha256').update('raw-'+n).digest('hex'),provider_order_id:'9001',status_hint:status,auth_method:'BEARER_SHARED_SECRET',provider_signature_verified:false};
}
function order(overrides={}){
 return {source:'GETCOURSE_AUTHORIZED_NATIVE_READ_ONLY_ORDER',account_host:R.ACCOUNT_HOST,native_order_readback_verified:true,native_payment_readback_verified:true,native_refund_readback_verified:true,native_payment_verified:true,deal_id:'9001',deal_number:'99001',user_id:'12345',order_status:'payed',payment_status:'paid',currency:'RUB',order_total_rub:6990,paid_total_rub:6990,paid_at:'2026-11-20T07:30:00.000Z',created_at:'2026-11-19T12:00:00.000Z',readback_at:new Date(NOW).toISOString(),refund_status:'none',refunded_total_rub:0,chargeback:false,positions:[{offer_id:8933492,quantity:1,price_rub:6990}],evidence_sha256:'9'.repeat(64),...overrides};
}
function notFound(userId='12345'){
 return {source:'GETCOURSE_AUTHORIZED_NATIVE_ENTITLEMENT_READBACK',account_host:R.ACCOUNT_HOST,native_entitlement_readback_verified:true,user_id:userId,training_id:936028240,access_status:'NOT_FOUND',no_active_entitlement:true,checked_at:new Date(NOW).toISOString(),evidence_sha256:'8'.repeat(64)};
}
function activeEntitlement(userId='12345',orderId='9001'){
 const start=Date.parse('2026-11-20T07:30:00Z');return {source:'GETCOURSE_AUTHORIZED_NATIVE_ENTITLEMENT_READBACK',account_host:R.ACCOUNT_HOST,native_entitlement_readback_verified:true,user_id:userId,training_id:936028240,access_status:'ACTIVE',grant_source:'BF2026_R145_SHAME_GIFT',source_order_id:orderId,access_days:365,access_from:new Date(start).toISOString(),access_until:new Date(start+365*86400000).toISOString(),native_grant_id:'1234567',checked_at:new Date(NOW).toISOString(),evidence_sha256:'7'.repeat(64)};
}
class FakeStore{
 constructor(){this.events=new Map();this.grants=new Map();}
 async enqueue(event,gift){
  const old=this.events.get(event.event_id);if(old){if(old!==event.raw_sha256){const e=Error('R145_CALLBACK_REPLAY_PAYLOAD_CONFLICT');e.code='R145_CALLBACK_REPLAY_PAYLOAD_CONFLICT';throw e;}return {status:'DUPLICATE_CALLBACK',duplicate:true};}
  this.events.set(event.event_id,event.raw_sha256);
  const existing=this.grants.get(gift.buyer_id_sha256);if(existing)return {status:'BUYER_ALREADY_CLAIMED',duplicate:false,existing_state:existing.state};
  this.grants.set(gift.buyer_id_sha256,{...gift,source_event_id:event.event_id,state:'READY',attempt_count:0,provider_write_attempt_count:0,lease_until:0});return {status:'QUEUED_NOT_GRANTED',duplicate:false,gift_key:gift.gift_key};
 }
 async claimNext(now=NOW){const row=[...this.grants.values()].find(x=>x.state==='READY'||x.state==='RECONCILIATION_REQUIRED'||(x.state==='GRANTING'&&x.lease_until<=now));if(!row)return null;row.state='GRANTING';row.attempt_count++;row.lease_until=now+120000;return {...row};}
 async markState(key,state,details={}){const row=[...this.grants.values()].find(x=>x.gift_key===key);if(!row)return false;row.state=state;row.lease_until=0;Object.assign(row,details);return true;}
 async recordRefund({orderId,buyerHash,evidenceSha,eventId,rawSha}){const old=this.events.get(eventId);if(old){assert.equal(old,rawSha);return {updated:0,duplicate:true,states:[]};}this.events.set(eventId,rawSha);const row=this.grants.get(buyerHash);if(!row||row.source_order_id!==orderId)return {updated:0,duplicate:false,states:[]};row.state=row.state==='GRANTED'?'REFUND_AFTER_GRANT_REVIEW':'REFUNDED_NO_GRANT';row.lease_until=0;row.last_code='R145_NATIVE_REFUND_CONFIRMED:'+evidenceSha;return {updated:1,duplicate:false,states:[row.state]};}
 async getState(key){const row=[...this.grants.values()].find(x=>x.gift_key===key);return row?{state:row.state,attempt_count:row.attempt_count,provider_write_attempt_count:row.provider_write_attempt_count}:null;}
 async recordProviderWriteAttempt(key){const row=[...this.grants.values()].find(x=>x.gift_key===key);if(!row||row.state!=='GRANTING')return 0;row.provider_write_attempt_count++;return row.provider_write_attempt_count;}
}
function coordinator({store=new FakeStore(),cfg=activation(),currentOrder=order(),adapter=null,now=NOW}={}){
 return {store,instance:R.createGiftCoordinator({store,activationProvider:()=>cfg,readNativeOrder:async()=>currentOrder,userIdEncryptionKeyProvider:()=>KEY,providerAdapter:adapter,clock:()=>now})};
}
test('Moscow promo window is inclusive at start and exclusive at end',()=>{
 assert.equal(R.inGiftWindow('2026-11-20T10:00:00+03:00'),true);
 assert.equal(R.inGiftWindow('2026-11-20T07:00:00Z'),true);
 assert.equal(R.inGiftWindow('2026-11-20T09:59:59.999+03:00'),false);
 assert.equal(R.inGiftWindow('2026-11-21T09:59:59.999+03:00'),true);
 assert.equal(R.inGiftWindow('2026-11-21T10:00:00+03:00'),false);
 assert.equal(R.inGiftWindow('2026-11-21T07:00:00Z'),false);
 assert.equal(R.isoMs('2026-11-20T10:30:00'),null);
 assert.equal(R.moscowWallClock(Date.parse('2026-11-20T07:30:00Z')),'2026-11-20T10:30:00');
});
test('activation is fail-closed until owner UI, native mapping, payment/refund and grant evidence exist',()=>{
 assert.equal(R.validateActivation(null).active,false);
 assert.equal(R.validateActivation(activation({ui_owner_approval_verified:false})).code,'R145_GETCOURSE_UI_OWNER_APPROVAL_MISSING');
 assert.equal(R.validateActivation(activation({eligible_offer_ids:[]})).code,'R145_ACTIVE_PAID_OFFER_ALLOWLIST_MISSING');
 assert.equal(R.validateActivation(activation({training_readback_verified:false})).active,false);
 assert.equal(R.validateActivation(activation()).active,true);
});
test('disabled coordinator makes no provider readback, DB enqueue or grant attempt',async()=>{
 let reads=0,enqueues=0;const store=new FakeStore();store.enqueue=async()=>{enqueues++;};
 const c=R.createGiftCoordinator({store,activationProvider:()=>null,readNativeOrder:async()=>{reads++;},userIdEncryptionKeyProvider:()=>KEY,clock:()=>NOW});
 assert.equal(c.status().active,false);assert.equal((await c.processCallbackHint(hint())).code,'R145_ACTIVATION_FILE_MISSING');
 assert.equal((await c.drainOne()).provider_write_attempts,0);assert.equal(reads,0);assert.equal(enqueues,0);
});
test('paid callback is only a hint; fresh native paid readback queues exactly one encrypted gift',async()=>{
 const {store,instance}=coordinator();const r=await instance.processCallbackHint(hint());
 assert.equal(r.status,'QUEUED_NOT_GRANTED');assert.equal(r.queued,true);assert.equal(r.grant_writes,0);
 assert.equal(store.grants.size,1);const row=[...store.grants.values()][0];
 assert.notEqual(row.user_id_ciphertext,'12345');assert.equal(R.openUserId({nonce:row.user_id_nonce,ciphertext:row.user_id_ciphertext,tag:row.user_id_tag},KEY),'12345');
 assert.equal(row.source_order_id,'9001');assert.deepEqual(row.offer_ids,['8933492']);
});
test('duplicate callback is idempotent and changed payload under same event ID conflicts',async()=>{
 const {instance}=coordinator();const h=hint();assert.equal((await instance.processCallbackHint(h)).status,'QUEUED_NOT_GRANTED');
 assert.equal((await instance.processCallbackHint(h)).status,'DUPLICATE_CALLBACK');
 const changed={...h,raw_sha256:'f'.repeat(64)};assert.equal((await instance.processCallbackHint(changed)).code,'R145_CALLBACK_REPLAY_PAYLOAD_CONFLICT');
});
test('one buyer receives one gift across different paid orders and callbacks',async()=>{
 const store=new FakeStore();let current=order();const instance=R.createGiftCoordinator({store,activationProvider:()=>activation(),readNativeOrder:async({provider_order_id})=>({...current,deal_id:provider_order_id,deal_number:'99'+provider_order_id}),userIdEncryptionKeyProvider:()=>KEY,clock:()=>NOW});
 assert.equal((await instance.processCallbackHint(hint('PAID','1'))).status,'QUEUED_NOT_GRANTED');
 current=order({deal_id:'9002',deal_number:'99002'});const h={...hint('PAID','2'),provider_order_id:'9002'};
 assert.equal((await instance.processCallbackHint(h)).status,'BUYER_ALREADY_CLAIMED');assert.equal(store.grants.size,1);
});
test('unpaid/created order callback never triggers a grant queue',async()=>{
 const {store,instance}=coordinator();const h=hint('UNPAID');
 assert.equal((await instance.processCallbackHint(h)).code,'R145_NO_GRANT_ORDER_NOT_PAID');assert.equal(store.grants.size,0);
 const {store:s2,instance:c2}=coordinator({currentOrder:order({order_status:'new',payment_status:'unpaid',paid_total_rub:0,paid_at:null})});
 assert.equal((await c2.processCallbackHint(hint())).code,'R145_ORDER_NOT_FULLY_PAID');assert.equal(s2.grants.size,0);
});
test('partial payment and mismatched total do not qualify',()=>{
 const a=R.validateActivation(activation());
 assert.equal(R.evaluatePaidEvidence({callbackHint:hint(),nativeOrder:order({paid_total_rub:3000}),activation:a,nowMs:NOW}).code,'R145_PAID_TOTAL_NOT_FULLY_RECONCILED');
});
test('refund/chargeback readback prevents enqueue even if callback says PAID',async()=>{
 const {store,instance}=coordinator({currentOrder:order({refund_status:'partial',refunded_total_rub:100})});
 assert.equal((await instance.processCallbackHint(hint())).code,'R145_ORDER_REFUNDED_OR_CHARGEBACK');assert.equal(store.grants.size,0);
});
test('paid_at, not order-created time or callback-received time, controls eligibility',()=>{
 const a=R.validateActivation(activation());
 assert.equal(R.evaluatePaidEvidence({callbackHint:hint(),nativeOrder:order({created_at:'2026-11-10T10:00:00Z'}),activation:a,nowMs:NOW}).eligible,true);
 assert.equal(R.evaluatePaidEvidence({callbackHint:hint(),nativeOrder:order({paid_at:'2026-11-20T06:59:59.999Z'}),activation:a,nowMs:NOW}).code,'R145_PAYMENT_OUTSIDE_MOSCOW_24H_WINDOW');
 assert.equal(R.evaluatePaidEvidence({callbackHint:hint(),nativeOrder:order({paid_at:'2026-11-21T07:00:00Z'}),activation:a,nowMs:NOW}).code,'R145_PAYMENT_OUTSIDE_MOSCOW_24H_WINDOW');
 assert.equal(R.evaluatePaidEvidence({callbackHint:hint(),nativeOrder:order({paid_at:'2026-11-20T10:30:00'}),activation:a,nowMs:NOW}).code,'R145_PAID_AT_TIMEZONE_REQUIRED');
});
test('lead-only, removed and unknown Offer IDs are excluded by owner-attested allowlist',()=>{
 const a=R.validateActivation(activation());
 assert.equal(R.evaluatePaidEvidence({callbackHint:hint(),nativeOrder:order({positions:[{offer_id:999999,quantity:1,price_rub:6990}]}),activation:a,nowMs:NOW}).code,'R145_ORDER_CONTAINS_NON_ELIGIBLE_OR_DUPLICATE_OFFER');
});
test('multi-offer paid Lot10 deal qualifies only when every line is on the active allowlist and totals reconcile',()=>{
 const a=R.validateActivation(activation());const o=order({order_total_rub:12990,paid_total_rub:12990,positions:[{offer_id:8933492,quantity:1,price_rub:6990},{offer_id:8919715,quantity:1,price_rub:6000}]});
 assert.equal(R.evaluatePaidEvidence({callbackHint:hint(),nativeOrder:o,activation:a,nowMs:NOW}).eligible,true);
 assert.equal(R.evaluatePaidEvidence({callbackHint:hint(),nativeOrder:{...o,positions:[...o.positions,{offer_id:999999,quantity:1,price_rub:1}],order_total_rub:12991,paid_total_rub:12991},activation:a,nowMs:NOW}).eligible,false);
});
test('confirmed refund callback marks a queued gift as refunded without issuing it',async()=>{
 const store=new FakeStore();let current=order();const instance=R.createGiftCoordinator({store,activationProvider:()=>activation(),readNativeOrder:async()=>current,userIdEncryptionKeyProvider:()=>KEY,clock:()=>NOW});
 await instance.processCallbackHint(hint('PAID','1'));current=order({refund_status:'full',refunded_total_rub:6990,order_status:'refunded',payment_status:'refunded'});
 const r=await instance.processRefundHint(hint('REFUND','2'));assert.equal(r.updated,1);assert.equal([...store.grants.values()][0].state,'REFUNDED_NO_GRANT');
});
test('no grant occurs without native entitlement readback and GetCourse UI owner gate',async()=>{
 const store=new FakeStore();const c=coordinator({store,adapter:{capabilities:{native_grant_write_verified:true},readGiftEntitlement:async()=>notFound(),grantGiftAccess:async()=>{throw Error('must not call')}}});
 await c.instance.processCallbackHint(hint());const r=await c.instance.drainOne();assert.equal(r.code,'R145_NATIVE_ENTITLEMENT_PROVIDER_NOT_APPROVED');
});
test('verified provider entitlement is granted once and read back before marking GRANTED',async()=>{
 const store=new FakeStore();let active=false,writes=0;const adapter={capabilities:{native_grant_write_verified:true,native_entitlement_readback_verified:true},
  readGiftEntitlement:async()=>active?activeEntitlement():notFound(),
  grantGiftAccess:async(args)=>{writes++;assert.equal(args.trainingId,936028240);assert.equal(args.productId,4559950);assert.equal(args.accessDays,365);active=true;return {accepted:true,native_grant_id:'1234567'};}};
 const c=coordinator({store,adapter});await c.instance.processCallbackHint(hint());const r=await c.instance.drainOne();
 assert.equal(r.grant_writes_verified,1);assert.equal(writes,1);assert.equal([...store.grants.values()][0].state,'GRANTED');
});
test('already active gift entitlement prevents a second provider write',async()=>{
 const store=new FakeStore();let writes=0;const adapter={capabilities:{native_grant_write_verified:true,native_entitlement_readback_verified:true},readGiftEntitlement:async()=>activeEntitlement(),grantGiftAccess:async()=>{writes++;}};
 const c=coordinator({store,adapter});await c.instance.processCallbackHint(hint());const r=await c.instance.drainOne();
 assert.equal(r.code,'R145_BUYER_ALREADY_HAS_GIFT');assert.equal(writes,0);assert.equal([...store.grants.values()][0].state,'ALREADY_ENTITLED');
});
test('crash/uncertain write after restart: readback first, never blindly repeat without provider idempotency',async()=>{
 const store=new FakeStore();let writes=0;const adapter={capabilities:{native_grant_write_verified:true,native_entitlement_readback_verified:true},readGiftEntitlement:async()=>notFound(),grantGiftAccess:async()=>{writes++;throw Error('unknown outcome');}};
 const c=coordinator({store,adapter});await c.instance.processCallbackHint(hint());
 assert.equal((await c.instance.drainOne()).code,'R145_PROVIDER_GRANT_OUTCOME_UNKNOWN');
 assert.equal((await c.instance.drainOne()).code,'R145_RESTART_UNCERTAIN_NO_PROVIDER_IDEMPOTENCY');assert.equal(writes,1);
});
test('provider idempotency retry after restart reuses the same stable idempotency key',async()=>{
 const store=new FakeStore();let writes=0,firstKey=null,active=false;const cfg=activation({provider_grant_idempotency_verified:true});
 const adapter={capabilities:{native_grant_write_verified:true,native_entitlement_readback_verified:true,native_grant_idempotency_verified:true},
  readGiftEntitlement:async()=>active?activeEntitlement():notFound(),grantGiftAccess:async(args)=>{writes++;if(firstKey===null)firstKey=args.idempotencyKey;else assert.equal(args.idempotencyKey,firstKey);if(writes===1)throw Error('ambiguous timeout');active=true;return {accepted:true,native_grant_id:'1234567'};}};
 const c=coordinator({store,cfg,adapter});await c.instance.processCallbackHint(hint());
 assert.equal((await c.instance.drainOne()).code,'R145_PROVIDER_GRANT_OUTCOME_UNKNOWN');
 assert.equal((await c.instance.drainOne()).grant_writes_verified,1);assert.equal(writes,2);assert.equal([...store.grants.values()][0].state,'GRANTED');
});
test('refund after already-issued gift is flagged for owner-controlled revocation review, never silently ignored',async()=>{
 const store=new FakeStore();let current=order(),active=false;const adapter={capabilities:{native_grant_write_verified:true,native_entitlement_readback_verified:true},readGiftEntitlement:async()=>active?activeEntitlement():notFound(),grantGiftAccess:async()=>{active=true;return {accepted:true,native_grant_id:'1234567'};}};
 const instance=R.createGiftCoordinator({store,activationProvider:()=>activation(),readNativeOrder:async()=>current,userIdEncryptionKeyProvider:()=>KEY,providerAdapter:adapter,clock:()=>NOW});
 await instance.processCallbackHint(hint());await instance.drainOne();current=order({refund_status:'full',refunded_total_rub:6990,order_status:'refunded',payment_status:'refunded'});
 const r=await instance.processRefundHint(hint('REFUND','3'));assert.equal(r.updated,1);assert.equal([...store.grants.values()][0].state,'REFUND_AFTER_GRANT_REVIEW');
});
test('PostgreSQL store requires a real pool and claim SQL is row-locked with SKIP LOCKED',async()=>{
 assert.throws(()=>R.createPostgresStore({}),/R145_POSTGRES_POOL_REQUIRED/);let sql='';
 const row={gift_key:'a'.repeat(64)};const client={query:async(q)=>{sql+=q+'\n';if(q.startsWith('SELECT * FROM'))return {rows:[row]};if(q.startsWith('UPDATE'))return {rows:[row]};return {rows:[],rowCount:1};},release(){}};
 const pool={connect:async()=>client};const store=R.createPostgresStore(pool);const got=await store.claimNext(NOW);
 assert.equal(got.gift_key,row.gift_key);assert.match(sql,/FOR UPDATE SKIP LOCKED/);assert.match(sql,/attempt_count=attempt_count\+1/);
});
test('PostgreSQL enqueue uses transaction advisory lock, callback dedupe and unique buyer/training outbox',async()=>{
 const sql=[];const client={query:async(q)=>{sql.push(q);if(q.startsWith('SELECT raw_sha256'))return {rows:[]};if(q.startsWith('INSERT INTO bf2026_r145_shame_gift_outbox'))return {rowCount:1,rows:[{gift_key:'a'.repeat(64)}]};return {rows:[],rowCount:1};},release(){}};
 const store=R.createPostgresStore({connect:async()=>client});
 const gift={gift_key:'a'.repeat(64),buyer_id_sha256:'b'.repeat(64),user_id_nonce:'nonce',user_id_ciphertext:'cipher',user_id_tag:'tag',source_order_id:'9001',offer_ids:['8933492'],order_total_rub:6990,paid_at:'2026-11-20T07:30:00Z',native_readback_sha256:'c'.repeat(64),grant_idempotency_key:'d'.repeat(64)};
 const r=await store.enqueue({event_id:'e'.repeat(64),raw_sha256:'f'.repeat(64)},gift);
 assert.equal(r.status,'QUEUED_NOT_GRANTED');assert.ok(sql.some(x=>x.includes('pg_advisory_xact_lock')));
 assert.ok(sql.some(x=>x.includes('ON CONFLICT(account_host,buyer_id_sha256,training_id) DO NOTHING')));
 assert.ok(sql[0]==='BEGIN'&&sql.at(-1)==='COMMIT');
});
test('PostgreSQL refund transaction cancels reconciliation retries and flags already-granted gifts',async()=>{
 const sql=[];const client={query:async(q)=>{sql.push(q);if(q.startsWith('SELECT raw_sha256'))return {rows:[]};if(q.startsWith('UPDATE bf2026_r145_shame_gift_outbox'))return {rowCount:1,rows:[{state:'REFUND_AFTER_GRANT_REVIEW'}]};return {rows:[],rowCount:1};},release(){}};
 const store=R.createPostgresStore({connect:async()=>client});
 const r=await store.recordRefund({orderId:'9001',buyerHash:'a'.repeat(64),evidenceSha:'b'.repeat(64),eventId:'c'.repeat(64),rawSha:'d'.repeat(64)});
 assert.equal(r.updated,1);assert.ok(sql.some(x=>x.includes("'REFUND_AFTER_GRANT_REVIEW'")));
 assert.ok(sql.some(x=>x.includes("'RECONCILIATION_REQUIRED','HOLD'")));
});

test('pre-grant readback failure does not consume the provider write attempt budget',async()=>{
 const store=new FakeStore();let reads=0,writes=0,active=false;const adapter={capabilities:{native_grant_write_verified:true,native_entitlement_readback_verified:true},readGiftEntitlement:async()=>active?activeEntitlement():notFound(),grantGiftAccess:async()=>{writes++;active=true;return {accepted:true,native_grant_id:'1234567'};}};
 const instance=R.createGiftCoordinator({store,activationProvider:()=>activation(),readNativeOrder:async()=>{reads++;if(reads===2)throw Error('temporary readback failure');return order();},userIdEncryptionKeyProvider:()=>KEY,providerAdapter:adapter,clock:()=>NOW});
 await instance.processCallbackHint(hint());
 assert.equal((await instance.drainOne()).code,'R145_PRE_GRANT_PAYMENT_READBACK_FAILED');
 assert.equal((await instance.drainOne()).grant_writes_verified,1);assert.equal(writes,1);
});
