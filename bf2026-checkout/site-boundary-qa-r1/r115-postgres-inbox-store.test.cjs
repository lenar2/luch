'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),
 path=require('node:path'),os=require('node:os');
const {createInboxStore}=require('./r115-postgres-inbox-store.cjs');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bf2026-r115-pool-'));
test.after(()=>{delete process.env.BF2026_R115_DB_POOL_MODULE;fs.rmSync(temp,{recursive:true,force:true})});
test('trusted server pool module is required, no implicit production DB connection',()=>{
 delete process.env.BF2026_R115_DB_POOL_MODULE;
 assert.throws(()=>createInboxStore(),/R115_TRUSTED_POOL_MODULE_REQUIRED/);
 process.env.BF2026_R115_DB_POOL_MODULE='relative-file.js';
 assert.throws(()=>createInboxStore(),/R115_TRUSTED_POOL_MODULE_REQUIRED/);
});
test('trusted absolute site-owned pool module yields a durable-query inbox, not a fake payment',async()=>{
 const file=path.join(temp,'staging-pool.cjs');
 fs.writeFileSync(file,"module.exports.pool={async query(sql,args){if(sql.startsWith('INSERT INTO bf2026_native_event_inbox'))return {rowCount:1,rows:[{event_id:args[1]}]};throw Error('unexpected');}};");
 process.env.BF2026_R115_DB_POOL_MODULE=file;
 const store=createInboxStore();
 const result=await store.accept({source:'BF2026_TRUSTED_RELAY',event_id:'TEST-999',
  provider_order_id:'ORDER-TEST-999',status_hint:'PAID',occurred_at:'2033-01-01T00:00:00Z',
  raw_sha256:'c'.repeat(64)});
 assert.equal(result.status,'ACCEPTED_PENDING_READBACK');
 assert.equal(result.payment_verified,false);
 assert.equal(result.grant_writes,0);
});
