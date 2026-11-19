'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createDurableContact,REQUIRED,verifyReadback}=require('./r141-contact-durable.cjs');
// Use the ACTUAL R137 source for server integration, portable stubs otherwise.
const r137=process.env.BF2026_R137_SOURCE_FILE
  ? require(process.env.BF2026_R137_SOURCE_FILE)
  : {
     offers:{'5':[8933492,6990], '12':[8934993,80000]},
     clean:b=>b&&Object.entries(b).length===4&&
       ['first_name','last_name','email','phone'].every(k=>typeof b[k]==='string')
       ? b:null,
     validUrl:v=>{try{const u=new globalThis.URL(v);return u.protocol==='https:'&&
       u.hostname==='study.shkola-dnv.com'&&u.pathname.startsWith('/sales/')&&
       !u.username&&!u.password;}catch{return false}}
    };
const {clean,validUrl,offers}=r137;
const SECRET='R141_STUB_ONLY_NOT_AN_ACTUAL_GETCOURSE_KEY_'.repeat(2);
const URL='https://study.shkola-dnv.com/sales/control/deal/pay/id/924000001';
const buyer={first_name:'Анна',last_name:'Иванова',
 email:'anna@qa.invalid',phone:'+79991234567'};
const selection={kind:'single',lot:5};
const makePayload=(id='12345678-1234-4234-8234-1234567890ab')=>({
 buyer,selection,legal_consent:true,request_id:id
});
const gates=Object.fromEntries(REQUIRED.map(x=>[x,true]));
const quote=q=>({kind:'single',total_rub:q.lot===5?6990:6000,
 items:[{site_lot:q.lot}]});
const hmac=x=>crypto.createHmac('sha256',SECRET).update(x).digest('hex');
function fixture(t,{allow=true,gate=gates,sendFn,readFn,root}={}){
 const dir=root||fs.mkdtempSync(path.join(os.tmpdir(),'bf2026-r141-test-'));
 fs.chmodSync(dir,0o700);
 if(!root)t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 let sent=0;
 const send=async(body,key)=>{sent++;assert.equal(key,SECRET);
  assert.equal(body.deal.deal_is_paid,0);
  assert.equal(body.deal.deal_cost,6990);
  assert.equal(body.system.return_payment_link,1);
  if(sendFn)return sendFn(body);
  return {success:'true',result:{success:'true',deal_number:body.deal.deal_number,
   deal_id:'924000001',payment_link:URL}};
 };
 const nativeReadback=async args=>readFn?readFn(args):({
  source:'GETCOURSE_AUTHORIZED_NATIVE_READ_ONLY_ORDER',
  account_host:'study.shkola-dnv.com',deal_number:args.dealNumber,
  deal_id:args.dealId,order_status:'new',payment_total_rub:6990,currency:'RUB',
  positions:[{offer_id:8933492,price_rub:6990,quantity:1}],
  buyer_email_hash:hmac(args.buyerEmail),native_order_consent_verified:true,
  native_unchecked_consent_rejection_verified:true
 });
 const create=(key=SECRET)=>createDurableContact({directory:dir,quote,send,clean,validUrl,offers,
  nativeReadback,preflight:async()=>gate,keyProvider:async()=>key,
  allowProviderNetwork:allow});
 return {dir,create,get sends(){return sent}};
}
test('default-off / blocked provider gates do not persist PII or send',async t=>{
 const f=fixture(t,{allow:false}),instance=f.create();
 assert.equal((await instance.start(makePayload()))[0],503);
 assert.equal(f.sends,0);assert.deepEqual(fs.readdirSync(f.dir),[]);
 const blocked=fixture(t,{gate:{...gates,native_provider_order_creation_verified:false}});
 assert.equal((await blocked.create().start(makePayload()))[0],503);
 assert.equal(blocked.sends,0);
});
test('real filesystem fsync + idempotent replay across brand-new coordinator restart',async t=>{
 const f=fixture(t);
 const [code,a]=await f.create().start(makePayload());
 assert.equal(code,200);assert.equal(a.checkout_url,URL);
 assert.equal(a.payment_verified,false);assert.equal(a.unpaid_order_native_verified,true);
 assert.equal(f.sends,1);
 const files=fs.readdirSync(f.dir);assert.equal(files.length,1);
 assert.equal(fs.statSync(path.join(f.dir,files[0])).mode&0o777,0o600);
 const raw=fs.readFileSync(path.join(f.dir,files[0]),'utf8');
 assert(!raw.includes(URL));assert(!raw.includes('anna@qa.invalid'));
 assert(!raw.includes('Анна'));assert(!raw.includes('+79991234567'));
 const [replayed,b]=await f.create().start(makePayload());
 assert.equal(replayed,200);assert.equal(b.checkout_url,URL);
 assert.equal(b.idempotent_replay,true);assert.equal(f.sends,1);
});
test('same request id with altered buyer/offer is permanently rejected',async t=>{
 const f=fixture(t);
 assert.equal((await f.create().start(makePayload()))[0],200);
 const changed=makePayload();changed.buyer={...buyer,first_name:'Мария'};
 assert.equal((await f.create().start(changed))[0],409);
 assert.equal(f.sends,1);
});
test('ambiguous provider HTTP result never retried, even after restart',async t=>{
 const f=fixture(t,{sendFn:()=>{throw Error('TEST_ONLY_NETWORK_DROP_AFTER_POST')}});
 const a=await f.create().start(makePayload());
 assert.equal(a[0],502);
 const b=await f.create().start(makePayload());
 assert.equal(b[0],409);assert.equal(f.sends,1);
});
test('provider ACK without authenticated native readback does not expose link',async t=>{
 const f=fixture(t,{readFn:async()=>null});
 const a=await f.create().start(makePayload());
 assert.equal(a[0],503);assert.equal(a[1].checkout_url,null);
 assert.equal((await f.create().start(makePayload()))[0],409);
 assert.equal(f.sends,1);
});
test('foreign provider payment URL fails closed and preserves no-retry marker',async t=>{
 const f=fixture(t,{sendFn:body=>({
  success:'true',result:{success:'true',deal_id:'924000001',
   deal_number:body.deal.deal_number,payment_link:'https://evil.invalid/pay'}
 })});
 assert.equal((await f.create().start(makePayload()))[0],502);
 assert.equal((await f.create().start(makePayload()))[0],409);
 assert.equal(f.sends,1);
});
test('Lot10 dynamic and removed Lot12 cannot use single-offer R137 adapter',async t=>{
 const f=fixture(t);
 for(const lot of [10,11,12]){
  const p=makePayload(crypto.randomUUID());p.selection={kind:'single',lot};
  assert.equal((await f.create().start(p))[0],422);
 }
 assert.equal(f.sends,0);assert.deepEqual(fs.readdirSync(f.dir),[]);
});
test('two concurrent same-ID POST requests use exactly one provider send',async t=>{
 const f=fixture(t);
 const first=f.create(),second=f.create(),p=makePayload();
 const results=await Promise.all([first.start(p),second.start(p)]);
 assert.equal(results.filter(x=>x[0]===200).length,1);
 assert.equal(results.filter(x=>x[0]===409).length,1);
 assert.equal(f.sends,1);
});
test('native readback validation cannot promote wrong amount or unverified consent',()=>{
 const correct={source:'GETCOURSE_AUTHORIZED_NATIVE_READ_ONLY_ORDER',
 account_host:'study.shkola-dnv.com',deal_id:'924000001',
 deal_number:'123456789012345',order_status:'new',payment_total_rub:6990,
 currency:'RUB',positions:[{offer_id:8933492,price_rub:6990,quantity:1}],
 buyer_email_hash:hmac(buyer.email),native_order_consent_verified:true,
 native_unchecked_consent_rejection_verified:true};
 const expected={dealId:'924000001',dealNumber:'123456789012345',
 offer:8933492,amount:6990,buyerHash:hmac(buyer.email)};
 assert.equal(verifyReadback(correct,expected),true);
 for(const update of [{payment_total_rub:7000},{native_order_consent_verified:false},
  {native_unchecked_consent_rejection_verified:false},{order_status:'payed'},
  {account_host:'evil.invalid'},{buyer_email_hash:'0'.repeat(64)}]){
  assert.equal(verifyReadback({...correct,...update},expected),false);
 }
});

test('provider key rotation cannot evade one-time durable order claim',async t=>{
 const f=fixture(t),p=makePayload();
 assert.equal((await f.create().start(p))[0],200);
 const newer='R141_TEST_ONLY_ROTATED_SECRET_'.repeat(2);
 assert.equal((await f.create(newer).start(p))[0],409);
 assert.equal(f.sends,1);
});
