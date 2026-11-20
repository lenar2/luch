'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {stageMetadata,TRAINING_PATCH}=require('./r124-stage-training-overlay.cjs');
const {EXPECTED}=require('./r123-single-widget-adapter.cjs');
const stageRoot='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
const enabled=process.env.BF2026_STAGE_ONLY==='1';
function read(){return {
 catalog:JSON.parse(fs.readFileSync(path.join(stageRoot,'catalog-r110.json'),'utf8')),
 registry:JSON.parse(fs.readFileSync(path.join(stageRoot,'offer-registry.json'),'utf8'))
}}
test('R124 stage overlay is copy-only, canonical six Training IDs, ten approved forms, public hold',{skip:!enabled},()=>{
 const files=['catalog-r110.json','offer-registry.json'];
 const before=files.map(f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(stageRoot,f))).digest('hex'));
 const originals=read();
 const originalJson=JSON.stringify(originals);
 const s=stageMetadata(originals);
 assert.deepEqual(s.source_training_patches,Object.keys(TRAINING_PATCH));
 assert.equal(s.plan.total_existing_form_bindings,10);
 assert.equal(s.plan.needs_training_metadata,0);
 assert.equal(s.plan.needs_multi_product_metadata,0);
 assert.equal(s.plan.public_release_allowed,false);assert.equal(s.checkout_url,null);
 assert.equal(JSON.stringify(originals),originalJson);
 for(const [k,id] of Object.entries(TRAINING_PATCH)){
  const e=EXPECTED[k],lot=s.catalog.lots.find(row=>row.lot===e.lot);
  assert.equal(lot.training_id,id);assert.equal(s.registry.native_widget_bindings[k].training_id,id);
  assert.equal(originals.registry.native_widget_bindings[k].training_id,null);
 }
 const after=files.map(f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(stageRoot,f))).digest('hex'));
 assert.deepEqual(after,before);
});
test('R124 stage overlay fails closed on training mismatch, wrong Offer/widget, rollout or checkout route',{skip:!enabled},()=>{
 const cases=[
  x=>x.registry.native_widget_bindings['single:rejection'].training_id=999,
  x=>x.catalog.lots.find(row=>row.lot===1).training_id=987,
  x=>x.registry.native_widget_bindings['single:rejection'].offer_id=123,
  x=>x.registry.native_widget_bindings['single:dnv'].widget_id=555,
  x=>x.registry.native_widget_bindings['single:source:2'].product_ids=[4550889],
  x=>x.registry.rollout_enabled=true,
  x=>x.catalog.release.global_enabled=true,
  x=>x.registry.checkout_forms['single:rejection']={status:'ACTIVE'},
  x=>x.catalog.lots.find(row=>row.lot===5).title_on_site='Лот пять плюс Союз'
 ];
 for(const mutate of cases){
  const snapshot=read();mutate(snapshot);
  assert.throws(()=>stageMetadata(snapshot));
 }
});
