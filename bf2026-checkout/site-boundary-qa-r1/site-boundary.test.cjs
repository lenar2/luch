'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createBoundary}=require('./site-boundary.cjs');
const b=createBoundary();
test('LIVE R109 status is read-only and fail-closed at zero routes', {timeout:20000}, async()=>{
 const r=await b.status();
 assert.equal(r.http_status,200);
 assert.equal(r.body.verified_sale_routes,0);
 assert.equal(r.body.sales_ready,false);
 assert.equal(r.body.status,'WAITING_FOR_VERIFIED_OFFERS');
});
test('LIVE Lot5 site quote matches adapter using fresh native readback overlay; start still blocked', {timeout:30000}, async()=>{
 const input={kind:'single',lot:5};
 const q=await b.quote(input);
 assert.equal(q.site_quote.total_rub,6990);
 assert.equal(q.adapter.ready_for_native_binding,true);
 assert.equal(q.site_availability.ready,false);
 const s=await b.start(input);
 assert.equal(s.http_status,503);
 assert.equal(s.code,'GETCOURSE_OFFER_NOT_READY');
 assert.equal(s.returned_checkout_url,null);
});
test('LIVE Lot5 + Union site quote matches adapter exactly at 11690; Union mapping blocks route', {timeout:30000}, async()=>{
 const input={kind:'set',items:['rejection_program','union']};
 const q=await b.quote(input);
 assert.equal(q.site_quote.subtotal_rub,12990);
 assert.equal(q.site_quote.discount_percent,10);
 assert.equal(q.site_quote.total_rub,11690);
 assert.equal(q.adapter.selection_key,'set:rejection_program|union');
 assert.equal(q.adapter.ready_for_native_binding,false);
 assert.ok(q.adapter.blockers.some(x=>x.line_key==='union'));
 assert.equal(q.site_availability.ready,false);
 const s=await b.start(input);
 assert.equal(s.http_status,503);
 assert.equal(s.code,'GETCOURSE_OFFER_NOT_READY');
 assert.equal(s.returned_checkout_url,null);
});
test('LIVE R109 audio pair uses 3333 + 3333 and rounds the 10% final total to 6000', {timeout:30000}, async()=>{
 const q=await b.quote({kind:'set',items:['rejection','devaluation']});
 assert.deepEqual(q.site_quote.items.map(x=>x.base_price_rub),[3333,3333]);
 assert.equal(q.site_quote.subtotal_rub,6666);
 assert.equal(q.site_quote.discount_percent,10);
 assert.equal(q.site_quote.total_rub,6000);
 assert.equal(q.adapter.ready_for_native_binding,false);
});
test('LIVE Source II single variant is 10000 and remains unbound', {timeout:30000}, async()=>{
 const q=await b.quote({kind:'single',lot:9,variant:'2'});
 assert.equal(q.site_quote.total_rub,10000);
 assert.equal(q.adapter.selection_key,'single:source:2');
 assert.equal(q.adapter.ready_for_native_binding,false);
});
test('LIVE R109 rejects client price overrides and invalid three-audio selection', {timeout:30000}, async()=>{
 const tampered=await b.rejectedQuote({kind:'single',lot:5,total_rub:1});
 assert.equal(tampered.http_status,422);
 const invalid=await b.rejectedQuote({kind:'set',items:['rejection','devaluation','self']});
 assert.equal(invalid.http_status,422);
});

