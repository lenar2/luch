'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {EXPECTED,examineSingle,createSiteEngineerPlan}=require('./r123-single-widget-adapter.cjs');
function fixtures(){
 const lots=[],native_widget_bindings={};
 for(const [key,e] of Object.entries(EXPECTED)){
  native_widget_bindings[key]={
   widget_id:e.widget_id,offer_id:e.offer_id,product_id:e.pairs[0][0],
   training_id:e.service?null:e.pairs[0][1],expected_price_rub:e.price,
   paid_e2e_verified:false,public_release_allowed:false
  };
  if(e.pairs.length===2){
   native_widget_bindings[key].product_ids=e.pairs.map(p=>p[0]);
   native_widget_bindings[key].training_ids=e.pairs.map(p=>p[1]);
  }
  if(e.lot!==null)lots.push({lot:e.lot,title_on_site:e.lot===5?'Исцеление отвержения':'APPROVED',
   offer_id:e.offer_id,widget_id:e.widget_id,product_id:e.pairs[0][0],
   training_id:e.service?null:e.pairs[0][1],site_price_rub:e.price});
 }
 return {catalog:{schema:'bf2026.checkout.catalog.v2',lots},
  registry:{schema:'bf2026.native.form.registry.v2',rollout_enabled:false,native_widget_bindings}};
}
test('R123 site form adapter maps ten existing forms but never opens checkout',()=>{
 const x=fixtures(),p=createSiteEngineerPlan(x);
 assert.equal(p.total_existing_form_bindings,10);
 assert.equal(p.needs_training_metadata,0);assert.equal(p.needs_multi_product_metadata,0);
 assert.equal(p.public_release_allowed,false);assert.equal(p.checkout_url,null);
 assert.equal(p.forms.every(f=>f.public_release_allowed===false&&f.checkout_url===null),true);
 assert.equal(examineSingle({...x,key:'single:rejection_program'}).price_rub,6990);
 assert.equal(examineSingle({...x,key:'single:source:2'}).product_training_pairs.length,2);
 assert.equal(examineSingle({...x,key:'single:personal_zoom'}).native_training_id,null);
});
test('R123 site form adapter reports missing ID metadata without changing originals',()=>{
 const x=fixtures(),before=JSON.stringify(x);
 for(const k of ['single:rejection','single:devaluation','single:self',
  'single:guilt','single:dnv','single:source:1']){
  x.registry.native_widget_bindings[k].training_id=null;
  const lot=EXPECTED[k].lot;
  x.catalog.lots.find(row=>row.lot===lot).training_id=null;
 }
 delete x.registry.native_widget_bindings['single:source:2'].product_ids;
 delete x.registry.native_widget_bindings['single:source:2'].training_ids;
 const snapshot=JSON.stringify(x),p=createSiteEngineerPlan(x);
 assert.equal(p.needs_training_metadata,6);
 assert.equal(p.needs_multi_product_metadata,1);
 assert.equal(p.forms.filter(f=>f.status==='MAPPING_COMPLETE_QA_ONLY').length,2);
 assert.equal(JSON.stringify(x),snapshot,'pure adapter must not mutate user/site files');
 assert.notEqual(JSON.stringify(x),before);
 const source=p.forms.find(f=>f.key==='single:source:2');
 assert.deepEqual(source.suggested_registry_metadata.product_ids,[4550889,4550891]);
 assert.deepEqual(source.suggested_registry_metadata.training_ids,[934905122,934905123]);
});
test('R123 rejects unexpected Offer/widget/product/price and attempted public release',()=>{
 for(const mutate of [
  x=>x.registry.native_widget_bindings['single:rejection'].offer_id=8939999,
  x=>x.registry.native_widget_bindings['single:rejection'].widget_id=1680000,
  x=>x.registry.native_widget_bindings['single:rejection'].product_id=1234567,
  x=>x.registry.native_widget_bindings['single:rejection'].expected_price_rub=12990,
  x=>x.registry.native_widget_bindings['single:rejection'].training_id=936016999,
  x=>x.registry.native_widget_bindings['single:rejection'].public_release_allowed=true,
  x=>x.registry.rollout_enabled=true,
  x=>x.catalog.lots.find(l=>l.lot===5).title_on_site='Лот пять плюс Союз'
 ]){
  const x=fixtures();mutate(x);
  assert.throws(()=>createSiteEngineerPlan(x));
 }
 assert.throws(()=>examineSingle({...fixtures(),key:'single:trainer'}),
  {code:'R123_UNSUPPORTED_OR_UNVERIFIED_WIDGET_KEY'});
});
test('R123 real site registry/catalog read-only reconciliation, without any production write',
 {skip:!process.env.BF2026_R123_SITE_SNAPSHOT_DIR},()=>{
 const root=process.env.BF2026_R123_SITE_SNAPSHOT_DIR;
 assert.equal(root,'/srv/factory-scratch/bf2026-checkout-r2-20261119');
 const before=fs.statSync(path.join(root,'offer-registry.json')).mtimeMs;
 const catalog=JSON.parse(fs.readFileSync(path.join(root,'catalog-r110.json')));
 const registry=JSON.parse(fs.readFileSync(path.join(root,'offer-registry.json')));
 const p=createSiteEngineerPlan({catalog,registry});
 assert.equal(p.total_existing_form_bindings,10);
 assert.equal(p.public_release_allowed,false);
 assert.equal(p.needs_training_metadata>=0,true);
 assert.equal(p.needs_multi_product_metadata>=0,true);
 assert.equal(registry.rollout_enabled,false);
 assert.equal(fs.statSync(path.join(root,'offer-registry.json')).mtimeMs,before);
 console.log('R123_SITE_READONLY_FINDING',JSON.stringify({
  forms:p.total_existing_form_bindings,missing_trainings:p.needs_training_metadata,
  missing_multi_product:p.needs_multi_product_metadata,
  public_release_allowed:p.public_release_allowed}));
});
