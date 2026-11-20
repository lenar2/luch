'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
function fail(code){const e=new Error(code);e.code=code;throw e}
const id=x=>Number.isSafeInteger(x)&&x>0;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const keys={1:'rejection',2:'devaluation',3:'self',4:'guilt',5:'rejection_program',6:'dnv',7:'union',8:'trainer'};
function normalize(lot,variant,cat,registry){
 if(lot.type==='set')return {kind:'DYNAMIC_SET',ready:false,reason:'NO_265_NATIVE_OFFERS'};
 if(lot.type==='application')return {kind:'APPLICATION_ONLY',ready:false,reason:'NO_NATIVE_CHARGE'};
 const key=lot.lot===9?'single:source:'+(variant||'1'):lot.lot===12?'single:personal_zoom':'single:'+keys[lot.lot];
 const source=lot.lot===9?(lot.variants?.[variant||'1']||lot):lot;
 const b=registry.native_widget_bindings?.[key]||null;
 const offer=source.offer_id,widget=source.widget_id,product=source.product_id;
 const products=source.product_ids?.length?source.product_ids.slice():id(product)?[product]:[];
 const trains=source.training_ids?.length?source.training_ids.slice():id(source.training_id)?[source.training_id]:[];
 const price=source.site_price_rub;
 if(lot.lot===9&&variant==='2'){
  if(offer!==8934987||widget!==1686774||!same(products,[4550889,4550891])||!same(trains,[934905122,934905123]))
   fail('SOURCE_I_II_MAPPING_CONFLICT');
 }
 if(lot.lot===12){
  if(offer!==8934993||widget!==1686776||!same(products,[4559058])||trains.length!==0)
   fail('ZOOM_SERVICE_MAPPING_CONFLICT');
 }
 if(!id(offer)||!id(widget)||!id(product))return {kind:'NATIVE_PENDING',
  key,offer_id:id(offer)?offer:null,widget_id:null,ready:false,reason:'NATIVE_FORM_NOT_READY'};
 const bProducts=b?.product_ids?.length?b.product_ids:(id(b?.product_id)?[b.product_id]:[]);
 const bTrains=b?.training_ids?.length?b.training_ids:(id(b?.training_id)?[b.training_id]:[]);
 if(b?.offer_id===offer&&bProducts.length&&!same(products,bProducts))fail('PRODUCT_REGISTRY_CONFLICT');
 if(b?.offer_id===offer&&bTrains.length&&!same(trains,bTrains))fail('TRAINING_REGISTRY_CONFLICT');
 const ev=cat.widget_evidence?.find(e=>e.widget_id===widget&&e.offer_id===offer&&e.price_rub===price);
 const registered=!!b&&b.widget_id===widget&&b.offer_id===offer&&b.expected_price_rub===price&&
  b.form_fields_verified===true&&ev?.observed_single_offer===true&&ev?.observed_exact_price===true;
 const service=lot.type==='service',nGrants=service?0:(source.grant_count_required||b?.grant_count_required||products.length);
 const trainingsComplete=service||trains.length===nGrants&&trains.every(id);
 const legal=ev?.oferta_field_required_observed===true&&ev?.legal_consent_e2e_verified===true;
 return {kind:service?'NATIVE_SERVICE_NO_TRAINING':'NATIVE_TRAINING',
  key,variant:variant||null,offer_id:offer,widget_id:widget,product_ids:products,training_ids:trains,
  grant_count_required:nGrants,price_rub:price,
  public_widget_url:'https://study.shkola-dnv.com/pl/lite/widget/widget?id='+widget,
  script_url:'https://study.shkola-dnv.com/pl/lite/widget/script?id='+widget,
  script_id:b?.script_id||null,registered,training_mapping_complete:trainingsComplete,
  legal_consent_verified:legal,paid_e2e_verified:b?.paid_e2e_verified===true&&ev?.paid_e2e===true,
  service_fulfillment:service?{zoom_sessions:3,booking_required_after_payment:true}:null,
  ready:false,reason:!registered?'FORM_NOT_REGISTERED':!trainingsComplete?
   'TRAINING_MAPPING_NUMERIC_ID_UNCONFIRMED':!legal?'OFFER_CONSENT_NEGATIVE_TEST_UNVERIFIED':
   'NATIVE_PAID_RECEIPT_ENTITLEMENT_QA_UNVERIFIED'};
}
function buildMatrix({catalog,registry}){
 if(!catalog||!registry||catalog.lot_count!==12||catalog.lots?.length!==12||!catalog.widget_evidence||!registry.native_widget_bindings)
  fail('CATALOG_REGISTRY_12_REQUIRED');
 const seen=new Set(),slots=[];
 for(const l of catalog.lots){
  if(!Number.isSafeInteger(l.lot)||l.lot<1||l.lot>12||seen.has(l.lot)||!l.title_on_site)
   fail('DUPLICATE_OR_UNKNOWN_SITE_LOT');
  seen.add(l.lot);
  const variants=l.lot===9?[normalize(l,'1',catalog,registry),normalize(l,'2',catalog,registry)]:
   [normalize(l,null,catalog,registry)];
  slots.push({lot:l.lot,title:l.title_on_site,type:l.type,variants,
   checkout_released:false,paid_e2e_verified:false});
 }
 slots.sort((a,b)=>a.lot-b.lot);
 const status={slots_total:12,registered_native_forms:slots.flatMap(x=>x.variants).filter(x=>x.registered).length,
  unregistered_slots:slots.filter(x=>x.variants.every(v=>!v.registered)).map(x=>x.lot),
  released_routes:0,source_ii_two_training_readback:true,zoom_has_training_grant:false};
 return {schema:'bf2026.native.slot.matrix.r115',source:'CURRENT_SITE_CATALOG_REGISTRY_READBACK',
  slots,status,forbidden_duplicate_ids:[1686766,8934988],
  no_customer_redirect_until_release:true,no_guessed_provider_ids:true};
}
function readMatrix(c,r){return buildMatrix({catalog:JSON.parse(fs.readFileSync(c)),registry:JSON.parse(fs.readFileSync(r))})}
function snapshot(c,r,o){
 const m=readMatrix(c,r),checksum=crypto.createHash('sha256').update(fs.readFileSync(c)).update(fs.readFileSync(r)).digest('hex');
 fs.writeFileSync(o,JSON.stringify({...m,input_sha256:checksum},null,2)+'\n',{mode:0o600});return m;
}
module.exports={buildMatrix,readMatrix,snapshot};
if(require.main===module){
 if(process.argv.length!==5)throw Error('usage: node native-slot-matrix.cjs catalog.json registry.json out.json');
 console.log(JSON.stringify(snapshot(process.argv[2],process.argv[3],process.argv[4]).status));
}
