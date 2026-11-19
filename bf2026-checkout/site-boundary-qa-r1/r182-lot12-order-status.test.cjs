'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {stateFor}=require('./r182-lot12-order-status.cjs');
function setup(){
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'r182-lot12-'));
 const nonce='a'.repeat(40),hash=crypto.createHash('sha256').update(nonce).digest('hex');
 const p=path.join(d,'f'.repeat(64)+'.json');
 const rec={state:'created_requires_price_readback',deal_number:'285070227416268',deal_id:925063710,
  positions_done:2,total_rub:11690,nonce_sha256:hash,
  native_total_readback_verified:false,
  provider_checkout_url:'https://study.shkola-dnv.com/pl/sales/pay?deal=925063710'};
 const save=()=>fs.writeFileSync(p,JSON.stringify(rec),{mode:0o600});
 save();return {d,nonce,rec,save}
}
test('pending price does not leak link',()=>{const x=setup();const r=stateFor({deal_number:x.rec.deal_number,nonce:x.nonce},{ledgerDir:x.d});assert.equal(r.http,200);assert.equal(r.data.checkout_url,null);assert.equal(r.data.processing,true);});
test('wrong nonce does not expose order',()=>{const x=setup();const r=stateFor({deal_number:x.rec.deal_number,nonce:'b'.repeat(40)},{ledgerDir:x.d});assert.equal(r.http,404);});
test('verified price, native positions and protected nonce release trusted provider URL',()=>{
 const x=setup();Object.assign(x.rec,{state:'price_verified',native_total_readback_verified:true,native_status:'new',
  verified_positions:[{offer_id:1,position_id:3,quantity:1,currency:'RUB',price_rub:6000},{offer_id:2,position_id:4,quantity:1,currency:'RUB',price_rub:5690}],
  price_verified_at:new Date().toISOString()});
 x.save();const r=stateFor({deal_number:x.rec.deal_number,nonce:x.nonce},{ledgerDir:x.d});
 assert.equal(r.http,200);assert.equal(r.data.price_verified,true);assert.equal(r.data.payment_ready,true);
 assert.match(r.data.checkout_url,/study.shkola-dnv.com/);
});
test('stale readback refuses payment link',()=>{
 const x=setup();Object.assign(x.rec,{state:'price_verified',native_total_readback_verified:true,native_status:'new',
  verified_positions:[{price_rub:6000,quantity:1,currency:'RUB'},{price_rub:5690,quantity:1,currency:'RUB'}],
  price_verified_at:new Date(Date.now()-660000).toISOString()});x.save();
 const r=stateFor({deal_number:x.rec.deal_number,nonce:x.nonce},{ledgerDir:x.d});
 assert.equal(r.data.price_verified,true);assert.equal(r.data.payment_ready,false)
});
test('mismatched native total refuses payment link',()=>{
 const x=setup();Object.assign(x.rec,{state:'price_verified',native_total_readback_verified:true,native_status:'new',
  verified_positions:[{price_rub:6000,quantity:1,currency:'RUB'},{price_rub:6000,quantity:1,currency:'RUB'}],
  price_verified_at:new Date().toISOString()});x.save();
 const r=stateFor({deal_number:x.rec.deal_number,nonce:x.nonce},{ledgerDir:x.d});
 assert.equal(r.data.payment_ready,false)
});
test('untrusted provider URL refuses payment',()=>{
 const x=setup();Object.assign(x.rec,{state:'price_verified',native_total_readback_verified:true,native_status:'new',
  verified_positions:[{price_rub:6000,quantity:1,currency:'RUB'},{price_rub:5690,quantity:1,currency:'RUB'}],
  price_verified_at:new Date().toISOString(),provider_checkout_url:'https://attacker.test/'});
 x.save();const r=stateFor({deal_number:x.rec.deal_number,nonce:x.nonce},{ledgerDir:x.d});
 assert.equal(r.data.payment_ready,false);
});
