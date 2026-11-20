'use strict';
/* R128: exact native CTA map. Client guard block IDs are browser-only evidence. */
const fs=require('node:fs');
const path=require('node:path');
const {EXPECTED}=require('./r123-single-widget-adapter.cjs');
const FILE=path.join(__dirname,'r128-native-cta-map.json');
const raw=JSON.parse(fs.readFileSync(FILE,'utf8'));
function fail(code){const e=Error(code);e.code=code;throw e}
function freeze(value){
 if(value&&typeof value==='object'&&!Object.isFrozen(value)){
  Object.freeze(value);for(const v of Object.values(value))freeze(v);
 }
 return value;
}
function samePairs(actual,expected){
 return Array.isArray(actual)&&actual.length===expected.length&&
  actual.every((p,i)=>p&&p.product_id===expected[i][0]&&
   (p.training_id??null)===(expected[i][1]||null));
}
function validateMap(data=raw){
 if(!data||data.schema!=='bf2026.r128.native-cta-map.v1'||
  !data.entries||typeof data.entries!=='object'||Array.isArray(data.entries))
  fail('R128_CTA_MAP_SCHEMA_INVALID');
 if(data.consent?.client_field_id!==22204810||
  data.consent?.client_field_scope!=='USER'||
  data.consent?.client_guard_is_provider_proof!==false||
  data.consent?.provider_side_negative_test_verified!==false||
  data.consent?.public_release_allowed!==false)
  fail('R128_CLIENT_CONSENT_EVIDENCE_MUST_REMAIN_UNTRUSTED');
 if(data.order_fields?.consent_nonce_field_id!==null||
  data.order_fields?.offer_revision_sha256_field_id!==null||
  data.order_fields?.native_order_field_readback_verified!==false)
  fail('R128_ORDER_FIELD_IDS_MUST_NOT_BE_INVENTED');
 const routeEntries=Object.values(data.entries).filter(x=>x.route_key);
 if(routeEntries.length!==Object.keys(EXPECTED).length||
  new Set(routeEntries.map(x=>x.route_key)).size!==routeEntries.length||
  routeEntries.some(x=>!Object.hasOwn(EXPECTED,x.route_key)))
  fail('R128_INDIVIDUAL_ROUTE_SET_MISMATCH');
 for(const [key,e] of Object.entries(EXPECTED)){
  const row=data.entries[key];
  if(!row||row.route_key!==key||row.widget_id!==e.widget_id||
   row.offer_id!==e.offer_id||row.amount_rub!==e.price||
   !samePairs(row.product_training_pairs,e.pairs)||
   !Number.isSafeInteger(row.client_guard_block_id)||row.client_guard_block_id<=0||
   row.route_status!=='INDIVIDUAL_QA_ONLY')
   fail('R128_NATIVE_CTA_MAPPING_MISMATCH_'+key);
  if(key==='single:source:2'&&(row.site_lot!==9||row.variant!=='2'))
   fail('R128_SOURCE_VARIANT_2_MAPPING_MISMATCH');
  if(key==='single:source:1'&&(row.site_lot!==9||row.variant!=='1'))
   fail('R128_SOURCE_VARIANT_1_MAPPING_MISMATCH');
  if(key==='single:personal_zoom'&&row.fulfillment!=='3_ZOOM_SESSIONS_NO_TRAINING')
   fail('R128_ZOOM_FULFILLMENT_MISMATCH');
 }
 const trainer=data.entries.trainer_qa_only,bundle=data.entries.bundle_qa_only;
 if(!trainer||trainer.route_key!==null||trainer.site_lot!==8||
  trainer.widget_id!==1686781||trainer.offer_id!==8934247||
  trainer.amount_rub!==28000||trainer.product_training_pairs?.[0]?.product_id!==4550897||
  trainer.product_training_pairs?.[0]?.training_id!==935051957||
  trainer.route_status!=='QA_ONLY_NOT_IN_R123_SINGLE_ALLOWLIST')
  fail('R128_TRAINER_QA_ONLY_MAPPING_INVALID');
 if(!bundle||bundle.route_key!==null||bundle.widget_id!==1686790||
  bundle.offer_id!==8935004||bundle.amount_rub!==11690||
  !samePairs(bundle.product_training_pairs,[[4557988,936022301],[4550895,933861292]])||
  bundle.route_status!=='QA_ONLY_NOT_IN_R123_SINGLE_ALLOWLIST')
  fail('R128_BUNDLE_QA_ONLY_MAPPING_INVALID');
 const blocks=Object.values(data.entries).map(x=>x.client_guard_block_id);
 const widgets=Object.values(data.entries).map(x=>x.widget_id);
 if(new Set(blocks).size!==blocks.length||new Set(widgets).size!==widgets.length||
  blocks.some(x=>!Number.isSafeInteger(x)||x<=0))
  fail('R128_NATIVE_WIDGET_OR_GUARD_DUPLICATE');
 return true;
}
validateMap(raw);
const ENTRIES=freeze(raw.entries);
const ROUTE_KEYS=Object.freeze(Object.keys(EXPECTED));
function byRoute(key){return ENTRIES[key]||null}
function resolveSelection(selection){
 if(!selection||typeof selection!=='object'||Array.isArray(selection)||
  selection.kind!=='single'||!Number.isInteger(selection.lot))return null;
 if(selection.lot===9){
  if(!['1','2'].includes(String(selection.variant)))return null;
  return byRoute('single:source:'+String(selection.variant));
 }
 if(selection.variant!==undefined)return null;
 const row=Object.values(ENTRIES).find(x=>x.site_lot===selection.lot&&x.route_key);
 if(row)return row;
 const held=Object.values(ENTRIES).find(x=>x.site_lot===selection.lot&&x.route_key===null);
 return held?Object.freeze({...held,not_routable:true}):null;
}
function all(){return Object.values(ENTRIES)}
module.exports={FILE,ENTRIES,ROUTE_KEYS,validateMap,byRoute,resolveSelection,all};
