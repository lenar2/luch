'use strict';
/* BF2026 R154: independent server source of truth for visible Lot 12.
 * Display selector remains data-lot=10. Never trust client subtotal, offers or price.
 * Historical R107 routes and the inactive R145 shame gift are NOT modified.
 */
const crypto=require('node:crypto');
const {EXPECTED}=require('./r123-single-widget-adapter.cjs');
const {TRAINER,allocateRubles}=require('./r130-set-lines.cjs');
const VERSION='BF2026_LOT12_CUSTOM_SET_R153';
const TIERS=Object.freeze({2:10,3:15,4:25,5:35,6:40,7:45});
const AUDIO=new Set(['rejection','devaluation','self','guilt']);
const ITEMS=Object.freeze([
 ['rejection',1,3333,'single:rejection'],
 ['devaluation',2,3333,'single:devaluation'],
 ['self',3,3333,'single:self'],
 ['guilt',4,3333,'single:guilt'],
 ['rejection_program',5,6990,'single:rejection_program'],
 ['dnv',6,7200,'single:dnv'],
 ['union',7,6000,'single:union'],
 ['trainer',8,28000,'trainer'],
 ['source',9,6000,'source'],
 ['dgs2',7,7000,'dgs2'],
 ['knopochka',8,5990,'knopochka']
]);
const EXTRA=Object.freeze({
 dgs2:Object.freeze({offer_id:8937776,price:7000,pairs:[[4550902,549791334]],
  widget_id:1687317,form_id:2263523651,source:'NATIVE_UI_READBACK_7012233764'}),
 knopochka:Object.freeze({offer_id:8937784,price:5990,pairs:[[4550899,316213861]],
  widget_id:1687346,form_id:2263526444,source:'NATIVE_UI_READBACK_7012233764'})
});
const CATALOG=Object.freeze(ITEMS.map(([key,site_lot,price,route])=>{
 const e=EXTRA[key]|| (route==='trainer'?TRAINER:
  route==='source'?EXPECTED['single:source:1']:EXPECTED[route]);
 if(!e||!Number.isSafeInteger(e.offer_id)||e.offer_id<1||e.price!==price||
  !Array.isArray(e.pairs)||e.pairs.length<1)throw Error('R154_INCORRECT_CATALOG_'+key);
 return Object.freeze({key,site_lot,base_price_rub:price,offer_id:e.offer_id,
  pairs:Object.freeze(e.pairs.map(p=>Object.freeze([...p]))),
  widget_id:e.widget_id??null,form_id:e.form_id??null});
}));
const BY_KEY=new Map(CATALOG.map(x=>[x.key,x]));
function fail(code){const e=Error(code);e.code=code;throw e}
function normalize(selection){
 if(!selection||typeof selection!=='object'||Array.isArray(selection)||
  Object.keys(selection).some(k=>!['kind','items','source_variant'].includes(k))||
  selection.kind!=='set'||!Array.isArray(selection.items)||
  selection.items.length<2||selection.items.length>7)
  fail('R154_SELECTION_SHAPE_OR_COUNT');
 const values=selection.items;
 if(values.some(k=>typeof k!=='string'||!BY_KEY.has(k))||
  new Set(values).size!==values.length)fail('R154_UNKNOWN_OR_DUPLICATE_CHOICE');
 const audios=values.filter(k=>AUDIO.has(k));
 if(audios.length>2)fail('R154_MAX_TWO_AUDIO');
 if(values.includes('rejection_program')&&audios.length)
  fail('R154_REJECTION_PROGRAM_AUDIO_OVERLAP');
 const source=values.includes('source');
 const variant=source?(selection.source_variant===undefined?'1':selection.source_variant):null;
 if(source&&!['1','2'].includes(variant))fail('R154_SOURCE_VARIANT_INVALID');
 if(!source&&selection.source_variant!==undefined)
  fail('R154_SOURCE_VARIANT_WITHOUT_SOURCE');
 return Object.freeze({kind:'set',items:Object.freeze(CATALOG.filter(x=>
  values.includes(x.key)).map(x=>x.key)),source_variant:variant});
}
function quoteSetR154(selection){
 const s=normalize(selection);
 const components=s.items.map(key=>{
  const e=BY_KEY.get(key);
  const variant=key==='source'?s.source_variant:null;
  const base=key==='source'&&variant==='2'?10000:e.base_price_rub;
  return Object.freeze({key,site_lot:e.site_lot,variant,base_price_rub:base});
 });
 const subtotal=components.reduce((v,x)=>v+x.base_price_rub,0);
 const percent=TIERS[components.length];
 if(!Number.isSafeInteger(subtotal)||!percent)fail('R154_SUBTOTAL_INVALID');
 // Identical to the public R153 implementation: round the FINAL total once.
 const total=Math.round(subtotal*(100-percent)/100/10)*10;
 if(!Number.isSafeInteger(total)||total<1)fail('R154_TOTAL_INVALID');
 return Object.freeze({kind:'set',currency:'RUB',pricing_version:VERSION,
  count:components.length,items:Object.freeze(components),components:Object.freeze(components),
  subtotal_rub:subtotal,discount_percent:percent,total_rub:total,
  savings_rub:subtotal-total,rounding:'NEAREST_10_FINAL_TOTAL_ONCE'});
}
function buildLot12SetPlan({selection}={}){
 const q=quoteSetR154(selection);
 const allocated=allocateRubles(q);
 const lines=q.items.map((item,i)=>{
  const entry=BY_KEY.get(item.key);
  const native=item.key==='source'&&item.variant==='2'?
   EXPECTED['single:source:2']:entry;
  if(!native||!Number.isSafeInteger(native.offer_id)||
   !Array.isArray(native.pairs)||!native.pairs.length||
   native.price!==undefined&&native.price!==item.base_price_rub)
   fail('R154_NATIVE_OFFER_AND_BF_PRICE_MISMATCH');
  const access=native.pairs.map(([product_id,training_id])=>{
   if(!Number.isSafeInteger(product_id)||product_id<1||
    !Number.isSafeInteger(training_id)||training_id<1)
    fail('R154_NATIVE_PRODUCT_TRAINING_INVALID');
   return Object.freeze({product_id,training_id,access_days_after_pay:365});
  });
  if(item.key==='trainer'&&access[0].training_id!==935051957)
   fail('R154_TRAINER_MUST_USE_FULL_TRAINING');
  return Object.freeze({key:item.key,variant:item.variant,site_lot:item.site_lot,
   offer_id:native.offer_id,quantity:1,full_price_rub:item.base_price_rub,
   discounted_line_price_rub:allocated[i],access:Object.freeze(access)});
 });
 if(new Set(lines.map(x=>x.offer_id)).size!==lines.length)
  fail('R154_DUPLICATE_NATIVE_OFFER');
 if(lines.some(l=>l.discounted_line_price_rub<1)||
  lines.reduce((s,l)=>s+l.discounted_line_price_rub,0)!==q.total_rub)
  fail('R154_NATIVE_LINES_TOTAL_INVALID');
 const canonical=JSON.stringify({v:VERSION,lines:lines.map(x=>
  [x.key,x.variant,x.offer_id,x.discounted_line_price_rub]),total:q.total_rub});
 return Object.freeze({schema:'bf2026.r154.lot12.one-deal.plan.v1',
  lot:12,legacy_selector_lot:10,kind:'set',
  pricing_version:VERSION,items_count:lines.length,
  provider_writes_required:lines.length,desired_order_total_rub:q.total_rub,
  subtotal_rub:q.subtotal_rub,discount_percent:q.discount_percent,
  lines:Object.freeze(lines),
  plan_sha256:crypto.createHash('sha256').update(canonical).digest('hex'),
  all_product_training_pairs:Object.freeze([...new Map(lines.flatMap(x=>x.access)
   .map(a=>[a.product_id+':'+a.training_id,a])).values()]),
  uses_existing_offers_only:true,per_combination_offers_created:0,
  needs_multiple_import_api_requests:true,provider_order_verified:false,
  fiscal_receipt_verified:false,grants_verified:false,
  payment_link_released:false,public_sales_enabled:false});
}
module.exports={VERSION,TIERS,CATALOG,EXTRA,normalize,quoteSetR154,buildLot12SetPlan};
