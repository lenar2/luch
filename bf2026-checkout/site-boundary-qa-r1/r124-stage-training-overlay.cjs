'use strict';
// BF2026 R124: copy-on-read stage metadata overlay for six independently
// native-verified Product -> Training IDs (#4112 comment 6999798652).
// This never mutates catalog-r110.json, offer-registry.json, or production.
const {EXPECTED,createSiteEngineerPlan}=require('./r123-single-widget-adapter.cjs');
const TRAINING_PATCH=Object.freeze({
 'single:rejection':936016494,
 'single:devaluation':936016504,
 'single:self':936016509,
 'single:guilt':936016513,
 'single:dnv':583995140,
 'single:source:1':934905122
});
function fail(code){const e=Error(code);e.code=code;throw e}
function stageMetadata({catalog,registry}={}){
 if(!catalog||!registry||registry.rollout_enabled!==false||catalog.release?.global_enabled!==false)
  fail('R124_STAGE_GLOBAL_RELEASE_MUST_BE_DISABLED');
 const c=structuredClone(catalog),r=structuredClone(registry);
 const changed=[];
 for(const [key,training] of Object.entries(TRAINING_PATCH)){
  const expected=EXPECTED[key],row=r.native_widget_bindings?.[key];
  const lot=c.lots?.find(x=>x.lot===expected.lot);
  if(!row||!lot||expected.pairs[0][1]!==training||
   row.offer_id!==expected.offer_id||row.widget_id!==expected.widget_id||
   row.product_id!==expected.pairs[0][0]||
   lot.offer_id!==expected.offer_id||lot.product_id!==expected.pairs[0][0]||
   lot.widget_id!==expected.widget_id)fail('R124_STAGE_IDENTITY_PRECONDITION_FAILED');
  if(![null,undefined,training].includes(row.training_id)||
     ![null,undefined,training].includes(lot.training_id))
   fail('R124_STAGE_EXISTING_TRAINING_CONFLICT');
  if(row.training_id!==training||lot.training_id!==training)changed.push(key);
  row.training_id=training;lot.training_id=training;
 }
 const plan=createSiteEngineerPlan({catalog:c,registry:r});
 if(plan.total_existing_form_bindings!==10||plan.needs_training_metadata!==0||
    plan.needs_multi_product_metadata!==0||
    plan.forms.some(f=>!['MAPPING_COMPLETE_QA_ONLY','SERVICE_NO_TRAINING_QA_ONLY'].includes(f.status))||
    plan.public_release_allowed!==false)fail('R124_STAGE_MAPPING_NOT_COMPLETE');
 // Copy-on-read only, no disk writes; no public sale binding ever added.
 if(Object.keys(r.checkout_forms||{}).length!==0)fail('R124_STAGE_PUBLIC_CHECKOUT_FORMS_EXIST');
 return Object.freeze({
  catalog:c,registry:r,plan,
  source_training_patches:changed,
  effective_training_ids:TRAINING_PATCH,
  stage_only:true,
  public_release_allowed:false,
  checkout_url:null
 });
}
module.exports={TRAINING_PATCH,stageMetadata};
