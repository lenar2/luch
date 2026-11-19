'use strict';
/* R123 independent site engineer integration adapter.
 * Reconcile ALREADY EXISTING fixed GetCourse native forms and Product->Training
 * IDs with the actual BF2026 site catalog. No network requests or file writes.
 * Consent server-negative test and paid receipt/grants are not yet proven:
 * every result remains QA-only and MUST NOT create a checkout URL. */
const EXPECTED=Object.freeze({
 'single:rejection': Object.freeze({lot:1,widget_id:1686768,offer_id:8934973,price:3333,pairs:[[4555636,936016494]]}),
 'single:devaluation':Object.freeze({lot:2,widget_id:1686753,offer_id:8934925,price:3333,pairs:[[4555642,936016504]]}),
 'single:self':Object.freeze({lot:3,widget_id:1686770,offer_id:8934974,price:3333,pairs:[[4557112,936016509]]}),
 'single:guilt':Object.freeze({lot:4,widget_id:1686767,offer_id:8934979,price:3333,pairs:[[4557582,936016513]]}),
 'single:rejection_program':Object.freeze({lot:5,widget_id:1686693,offer_id:8933492,price:6990,pairs:[[4557988,936022301]]}),
 'single:dnv':Object.freeze({lot:6,widget_id:1686740,offer_id:8934207,price:7200,pairs:[[4550894,583995140]]}),
 'single:union':Object.freeze({lot:7,widget_id:1686738,offer_id:8919715,price:6000,pairs:[[4550895,933861292]]}),
 'single:source:1':Object.freeze({lot:9,widget_id:1686741,offer_id:8934262,price:6000,pairs:[[4550889,934905122]]}),
 'single:source:2':Object.freeze({lot:null,widget_id:1686774,offer_id:8934987,price:10000,pairs:[[4550889,934905122],[4550891,934905123]]}),
 'single:personal_zoom':Object.freeze({lot:12,widget_id:1686776,offer_id:8934993,price:80000,pairs:[[4559058,0]],service:true})
});
function fail(code){const e=new Error(code);e.code=code;throw e}
function exactInt(v){return Number.isSafeInteger(v)&&v>0}
function examineSingle({catalog,registry,key}={}){
 if(!catalog||catalog.schema!=='bf2026.checkout.catalog.v2'||!Array.isArray(catalog.lots)||
    !registry||registry.schema!=='bf2026.native.form.registry.v2')
  fail('R123_SITE_CATALOG_SCHEMA_INVALID');
 if(registry.rollout_enabled!==false)fail('R123_SITE_ROLLOUT_MUST_STAY_DISABLED');
 const expected=EXPECTED[key];
 if(!expected)fail('R123_UNSUPPORTED_OR_UNVERIFIED_WIDGET_KEY');
 const row=registry.native_widget_bindings?.[key];
 if(!row)fail('R123_WIDGET_BINDING_MISSING');
 if(row.public_release_allowed!==false||row.paid_e2e_verified!==false)
  fail('R123_PUBLIC_SALE_EVIDENCE_NOT_PROVEN');
 if(row.widget_id!==expected.widget_id||row.offer_id!==expected.offer_id||
   row.expected_price_rub!==expected.price)fail('R123_NATIVE_WIDGET_OFFER_PRICE_MISMATCH');
 const primary=expected.pairs[0][0],training=expected.pairs[0][1];
 if(row.product_id!==primary)fail('R123_PRIMARY_PRODUCT_MISMATCH');
 let catalogRow=null;
 if(expected.lot!==null){
  catalogRow=catalog.lots.find(x=>x.lot===expected.lot);
  if(!catalogRow||catalogRow.offer_id!==expected.offer_id||
    catalogRow.product_id!==primary||catalogRow.site_price_rub!==expected.price)
    fail('R123_SITE_LOT_CATALOG_MISMATCH');
  const widget=catalogRow.widget_id??catalogRow.widget_candidate_id;
  if(widget!==expected.widget_id)fail('R123_SITE_WIDGET_ID_MISMATCH');
  if(expected.lot===5&&catalogRow.title_on_site!=='Исцеление отвержения')
   fail('R123_LOT5_TITLE_REGRESSION');
 }
 if(expected.pairs.length===2){
  // The known Source II widget is ONE Offer with TWO Products. The current
  // registry only stores the first product, so it cannot attest the second.
  const productIds=Array.isArray(row.product_ids)?row.product_ids:[];
  const trainingIds=Array.isArray(row.training_ids)?row.training_ids:[];
  const exact=JSON.stringify(productIds)===JSON.stringify(expected.pairs.map(x=>x[0]))&&
   JSON.stringify(trainingIds)===JSON.stringify(expected.pairs.map(x=>x[1]));
  if(!exact)return Object.freeze({key,status:'MULTI_PRODUCT_METADATA_INCOMPLETE',
   widget_id:expected.widget_id,offer_id:expected.offer_id,price_rub:expected.price,
   verified_native_product_training_pairs:expected.pairs,
   suggested_registry_metadata:{product_ids:expected.pairs.map(x=>x[0]),
    training_ids:expected.pairs.map(x=>x[1])},
   public_release_allowed:false,payment_verified:false,fiscal_receipt_verified:false,
   actual_grants_verified:false,checkout_url:null});
  return Object.freeze({key,status:'MAPPING_COMPLETE_QA_ONLY',widget_id:expected.widget_id,
   offer_id:expected.offer_id,price_rub:expected.price,product_training_pairs:expected.pairs,
   public_release_allowed:false,payment_verified:false,fiscal_receipt_verified:false,
   actual_grants_verified:false,checkout_url:null});
 }
 const observed=row.training_id;
 const observedCatalog=catalogRow?.training_id;
 if(expected.service){
  if(observed!==null&&observed!==undefined&&observed!==0)fail('R123_ZOOM_HAS_UNVERIFIED_TRAINING');
  if(catalogRow&&observedCatalog!==null&&observedCatalog!==undefined&&observedCatalog!==0)
   fail('R123_ZOOM_HAS_UNVERIFIED_TRAINING');
  return Object.freeze({key,status:'SERVICE_NO_TRAINING_QA_ONLY',widget_id:expected.widget_id,
   offer_id:expected.offer_id,price_rub:expected.price,
   native_product_id:primary,native_training_id:null,
   public_release_allowed:false,payment_verified:false,fiscal_receipt_verified:false,
   actual_grants_verified:false,checkout_url:null});
 }
 for(const [value,label] of [[observed,'REGISTRY'],[observedCatalog,'CATALOG']]){
  if(value!==null&&value!==undefined&&value!==training)
   fail('R123_'+label+'_TRAINING_CONFLICT');
 }
 if((!exactInt(observed))||(!exactInt(observedCatalog))){
  return Object.freeze({key,status:'MISSING_VERIFIED_TRAINING_METADATA',
   lot:expected.lot,widget_id:expected.widget_id,offer_id:expected.offer_id,
   price_rub:expected.price,native_product_id:primary,verified_native_training_id:training,
   suggested_registry_training_id:training,suggested_catalog_training_id:training,
   public_release_allowed:false,payment_verified:false,fiscal_receipt_verified:false,
   actual_grants_verified:false,checkout_url:null});
 }
 return Object.freeze({key,status:'MAPPING_COMPLETE_QA_ONLY',lot:expected.lot,
  widget_id:expected.widget_id,offer_id:expected.offer_id,price_rub:expected.price,
  native_product_id:primary,native_training_id:training,
  public_release_allowed:false,payment_verified:false,fiscal_receipt_verified:false,
  actual_grants_verified:false,checkout_url:null});
}
function createSiteEngineerPlan({catalog,registry}={}){
 const forms=Object.keys(EXPECTED).map(key=>examineSingle({catalog,registry,key}));
 return Object.freeze({
  schema:'bf2026.r123.site.existing-native-forms-plan.v1',
  catalog_release_disabled:registry.rollout_enabled===false,
  total_existing_form_bindings:forms.length,
  needs_training_metadata:forms.filter(x=>x.status==='MISSING_VERIFIED_TRAINING_METADATA').length,
  needs_multi_product_metadata:forms.filter(x=>x.status==='MULTI_PRODUCT_METADATA_INCOMPLETE').length,
  forms,public_release_allowed:false,payment_verified:false,
  fiscal_receipt_verified:false,actual_grants_verified:false,
  checkout_url:null,
  note:'QA-only metadata reconciliation. Do not overwrite registry or enable sales without consent negative test and real paid E2E.'
 });
}
module.exports={EXPECTED,examineSingle,createSiteEngineerPlan};
