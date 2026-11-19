'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {plan,request}=require('./r119-import.cjs');
const mail='qa@example.invalid',key='a'.repeat(32),secret='NOT_REAL_GETCOURSE_KEY';
const dec=x=>JSON.parse(Buffer.from(new URLSearchParams(x.body).get('params'),'base64').toString());
test('verified pair exact 11690, 2 existing Offer IDs, no real network',()=>{
 const p=plan({kind:'set',items:['rejection_program','union']},mail,key);
 assert.equal(p.total_rub,11690);
 assert.deepEqual(p.lines.map(x=>[x.offer_id,x.amount_rub]),[[8933492,6290],[8919715,5400]]);
 assert.equal(p.live_enabled,false);
});
test('sequential API contract: new unpaid order, then append with provider deal number',()=>{
 const p=plan({kind:'set',items:['rejection_program','union']},mail,key);
 const a=dec(request(p,0,secret));
 assert.equal(a.system.multiple_offers,0); assert.equal(a.deal.deal_is_paid,0); assert.equal(a.deal.deal_currency,'RUB');
 assert.equal(a.deal.deal_number,undefined);
 assert.throws(()=>request(p,1,secret),/PROVIDER_ORDER_NUMBER_REQUIRED/);
 const b=dec(request(p,1,secret,'71995'));
 assert.equal(b.system.multiple_offers,1); assert.equal(b.deal.deal_number,'71995');
 assert.equal(b.system.return_payment_link,1);
 assert.equal(b.deal.deal_is_paid,0);
});
test('different valid sets reconcile exactly to server quote and known Offers',()=>{
 const cases=[{kind:'set',items:['rejection','devaluation']},
 {kind:'set',items:['devaluation','self','union']},
 {kind:'set',items:['rejection_program','dnv','union','trainer']},
 {kind:'set',items:['source','dnv','union'],source_variant:'2'}];
 for(const q of cases){const p=plan(q,mail,key);assert.equal(p.lines.reduce((s,x)=>s+x.amount_rub,0),p.total_rub);
 assert(p.lines.every(x=>x.offer_id>0&&x.amount_rub>0));}
});
test('cannot plan invalid combo, import as paid, or assume order number',()=>{
 assert.throws(()=>plan({kind:'set',items:['rejection_program','rejection']},mail,key));
 assert.throws(()=>plan({kind:'single',lot:5},mail,key));
 assert.throws(()=>plan({kind:'set',items:['rejection_program','union']},mail,'BAD_KEY'));
 const p=plan({kind:'set',items:['rejection_program','union']},mail,key);
 assert.throws(()=>request(p,0,'bad'));
 assert.throws(()=>request(p,1,secret,'guess'));
 assert.throws(()=>request({...p,live_enabled:true},0,secret));
});
