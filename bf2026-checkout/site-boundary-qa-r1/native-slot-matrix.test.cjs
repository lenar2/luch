'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {buildMatrix,readMatrix}=require('./native-slot-matrix.cjs');
const d='/srv/factory-scratch/bf2026-checkout-r2-20261119';
const c=JSON.parse(fs.readFileSync(d+'/catalog-r110.json'));
const r=JSON.parse(fs.readFileSync(d+'/offer-registry.json'));
test('all 12 real site titles retained; native fields never invented',()=>{
 const m=buildMatrix({catalog:c,registry:r});
 assert.equal(m.slots.length,12);
 assert.equal(m.status.registered_native_forms,10);
 assert.deepEqual(m.status.unregistered_slots,[8,10,11]);
 assert.equal(m.status.released_routes,0);
 assert.equal(m.slots[4].title,'Исцеление отвержения');
 assert.equal(m.slots[6].title,'Союз нового времени');
 assert.equal(m.slots[0].variants[0].widget_id,1686768);
 assert.equal(m.slots[0].variants[0].offer_id,8934973);
 assert.equal(m.slots[0].variants[0].training_ids.length,0);
 assert.equal(m.slots.every(x=>x.checkout_released===false),true);
});
test('Source I+II is one native Offer with two exact distinct grants, never inactive duplicate',()=>{
 const m=readMatrix(d+'/catalog-r110.json',d+'/offer-registry.json');
 const source=m.slots.find(s=>s.lot===9);
 assert.equal(source.variants.length,2);
 const ii=source.variants[1];
 assert.equal(ii.offer_id,8934987);assert.equal(ii.widget_id,1686774);
 assert.deepEqual(ii.product_ids,[4550889,4550891]);
 assert.deepEqual(ii.training_ids,[934905122,934905123]);
 assert.equal(ii.grant_count_required,2);
 assert.ok(!m.slots.some(s=>s.variants.some(v=>v.offer_id===8934988)));
 assert.equal(ii.ready,false);
});
test('Zoom service requires 3-session booking and zero training grants',()=>{
 const z=buildMatrix({catalog:c,registry:r}).slots[11].variants[0];
 assert.equal(z.kind,'NATIVE_SERVICE_NO_TRAINING');
 assert.equal(z.offer_id,8934993);assert.equal(z.widget_id,1686776);
 assert.equal(z.price_rub,80000);assert.deepEqual(z.product_ids,[4559058]);
 assert.deepEqual(z.training_ids,[]);
 assert.equal(z.grant_count_required,0);
 assert.deepEqual(z.service_fulfillment,{zoom_sessions:3,booking_required_after_payment:true});
 assert.equal(z.ready,false);
});
test('no fraudulent native forms for trainer, dynamic set or application',()=>{
 const m=buildMatrix({catalog:c,registry:r});
 assert.equal(m.slots[7].variants[0].widget_id,null);
 assert.equal(m.slots[7].variants[0].kind,'NATIVE_PENDING');
 assert.equal(m.slots[9].variants[0].kind,'DYNAMIC_SET');
 assert.equal(m.slots[10].variants[0].kind,'APPLICATION_ONLY');
 for(const n of [8,10,11])assert.equal(m.slots[n-1].checkout_released,false);
});
test('site/Product/Training and Source II mismatch cannot silently pass',()=>{
 const broken=structuredClone(c);broken.lots[8].variants['2'].training_ids=[934905122,123];
 assert.throws(()=>buildMatrix({catalog:broken,registry:r}),{code:'SOURCE_I_II_MAPPING_CONFLICT'});
 const changed=structuredClone(r);changed.native_widget_bindings['single:rejection_program'].product_id=99;
 assert.throws(()=>buildMatrix({catalog:c,registry:changed}),{code:'PRODUCT_REGISTRY_CONFLICT'});
});
