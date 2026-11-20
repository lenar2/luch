'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EXPECTED}=require('./r123-single-widget-adapter.cjs');
const {ENTRIES,ROUTE_KEYS,validateMap,resolveSelection}=require('./r128-native-cta-map.cjs');
test('R128 exact ten individual native GetCourse CTA mappings plus two explicit QA-only widgets',()=>{
 assert.equal(validateMap(),true);
 assert.equal(ROUTE_KEYS.length,10);
 assert.equal(Object.values(ENTRIES).length,12);
 for(const [key,e] of Object.entries(EXPECTED)){
  const row=ENTRIES[key];
  assert.ok(row,key);assert.equal(row.widget_id,e.widget_id);
  assert.equal(row.offer_id,e.offer_id);assert.equal(row.amount_rub,e.price);
  assert.equal(row.client_guard_block_id>0,true);
  assert.equal(row.route_status,'INDIVIDUAL_QA_ONLY');
 }
});
test('R128 maps source variants independently and preserves the full Trainer + Zoom service',()=>{
 assert.equal(resolveSelection({kind:'single',lot:9,variant:'1'}).route_key,'single:source:1');
 assert.equal(resolveSelection({kind:'single',lot:9,variant:'2'}).route_key,'single:source:2');
 assert.deepEqual(ENTRIES['single:source:2'].product_training_pairs,[
  {product_id:4550889,training_id:934905122},
  {product_id:4550891,training_id:934905123}
 ]);
 assert.equal(ENTRIES.trainer_qa_only.product_training_pairs[0].training_id,935051957);
 assert.equal(ENTRIES.trainer_qa_only.route_key,null);
 assert.equal(ENTRIES['single:personal_zoom'].product_training_pairs[0].training_id,null);
});
test('R128 Trainer and bundle are represented but never resolve to an individual checkout route',()=>{
 const trainer=resolveSelection({kind:'single',lot:8});
 assert.equal(trainer.not_routable,true);assert.equal(trainer.route_key,null);
 assert.equal(ENTRIES.bundle_qa_only.route_key,null);
 assert.equal(ENTRIES.bundle_qa_only.widget_id,1686790);
 assert.equal(resolveSelection({kind:'set',items:['rejection_program','union']}),null);
});
test('R128 rejects tampered or fabricated mapping metadata',()=>{
 const clone=JSON.parse(JSON.stringify(require('./r128-native-cta-map.json')));
 clone.entries['single:rejection'].offer_id=8934925;
 assert.throws(()=>validateMap(clone),{code:'R128_NATIVE_CTA_MAPPING_MISMATCH_single:rejection'});
 const bad=JSON.parse(JSON.stringify(require('./r128-native-cta-map.json')));
 bad.entries.trainer_qa_only.route_key='single:trainer';
 assert.throws(()=>validateMap(bad));
 const badField=JSON.parse(JSON.stringify(require('./r128-native-cta-map.json')));
 badField.consent.client_guard_is_provider_proof=true;
 assert.throws(()=>validateMap(badField));
});
