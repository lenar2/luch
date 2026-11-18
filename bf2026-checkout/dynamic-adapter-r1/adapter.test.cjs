'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createAdapter,sha,REQUIRED_ROUTE_PROOFS}=require('./adapter.cjs');
const livePath=process.env.BF_R109_SERVER;
if(!livePath)throw Error('BF_R109_SERVER required: path to existing R109 server.js');
const {compute,manifest:liveManifest}=require(path.resolve(livePath));
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'pricing-r107.snapshot.json'),'utf8'));
assert.equal(sha(liveManifest),sha(manifest),'R109 catalog changed: STOP, recapture owner-approved snapshot');
const observations=JSON.parse(fs.readFileSync(path.join(__dirname,'native-mapping-observed.json'),'utf8'));
const observedAdapter=createAdapter({quoteFn:compute,manifest,observedMapping:observations.entries});
const audio=new Set(['rejection','devaluation','self','guilt']);
const keys=manifest.products.map(p=>p.key);
const byKey=Object.fromEntries(manifest.products.map(p=>[p.key,p]));
function independentOracle(sel,sourceVariant){
 const prices=sel.map(k=>k==='source'?byKey.source.variants.find(v=>v.key===sourceVariant)?.base_price_rub:byKey[k].base_price_rub);
 if(sel.length<2||sel.length>5||sel.filter(k=>audio.has(k)).length>2||
    (sel.includes('rejection_program')&&sel.some(k=>audio.has(k))))return null;
 const subtotal=prices.reduce((a,b)=>a+b,0);
 const pct={2:10,3:15,4:25,5:35}[sel.length];
 return {subtotal,total:Math.round(subtotal*(100-pct)/100/10)*10,pct};
}
const validSelections=[];
test('exhaustive 768 selections: 265 exact prices and 503 rejected against live R109',()=>{
 let valid=0,invalid=0;
 for(let mask=0;mask<1<<keys.length;mask++){
  const selected=keys.filter((_,i)=>mask&(1<<i));
  for(const variant of selected.includes('source')?['1','2']:[null]){
   const selection={kind:'set',items:selected,...(variant?{source_variant:variant}:{})};
   const oracle=independentOracle(selected,variant);
   if(oracle===null){assert.throws(()=>observedAdapter.plan(selection));invalid++;continue}
   const p=observedAdapter.plan(selection);
   assert.equal(p.quote.subtotal_rub,oracle.subtotal);
   assert.equal(p.quote.total_rub,oracle.total);
   assert.equal(p.quote.discount_percent,oracle.pct);
   assert.equal(p.quote.count,selected.length);
   assert.equal(p.quote.rounding,'nearest_10_rub_final_total');
   assert.equal(p.ready_for_native_binding,false,'observed mappings are NOT commercially verified');
   assert.ok(p.blockers.length>0);
   assert.ok(p.lines.every(x=>x.grant.trigger==='CONFIRMED_PAID_EVENT_ONLY'&&x.grant.duration_days===365));
   validSelections.push(selection);
   valid++;
  }
 }
 assert.equal(valid,265);assert.equal(invalid,503);
});
test('specific approved total, price authority, no browser override; audio base discrepancy',()=>{
 assert.equal(observedAdapter.plan({kind:'single',lot:1}).quote.total_rub,3333);
 assert.equal(observedAdapter.plan({kind:'set',items:['rejection','devaluation']}).quote.total_rub,6000);
 const duo=observedAdapter.plan({kind:'set',items:['union','rejection_program']});
 assert.equal(duo.quote.total_rub,11690);
 assert.equal(duo.selection_key,'set:rejection_program|union');
 assert.throws(()=>observedAdapter.plan({kind:'set',items:['union','dnv'],total_rub:1}),{code:'INVALID_SELECTION'});
 assert.throws(()=>observedAdapter.plan({kind:'set',items:['union','dnv'],offer_id:8933492}),{code:'INVALID_SELECTION'});
 assert.throws(()=>observedAdapter.plan({kind:'set',items:['source','union']}),{code:'INVALID_SELECTION'});
 assert.equal(observedAdapter.plan({kind:'single',lot:9,variant:'2'}).quote.total_rub,10000);
});
test('no native live routes; observed source I fixed but still inactive and training ID missing',()=>{
 const source=observedAdapter.plan({kind:'single',lot:9,variant:'1'});
 assert.deepEqual(source.lines[0].product_ids,[4550889]);
 assert.deepEqual(source.lines[0].offer_ids,[8934262]);
 assert.ok(source.blockers.some(x=>x.codes.includes('TRAINING_UNVERIFIED')));
 assert.ok(source.blockers.some(x=>x.codes.includes('NATIVE_NOT_ACTIVE_VERIFIED')));
 assert.throws(()=>observedAdapter.seal({kind:'single',lot:5},{secret:Buffer.alloc(32,1)}),/NATIVE_MAPPING_HOLD/);
});
function syntheticMapping(){
 const out={};
 for(const p of manifest.products)for(const v of p.key==='source'?['1','2']:[null]){
  const key=p.key+(v?':'+v:'');
  const idx=Object.keys(out).length;
  out[key]={offer_ids:[99000000+idx],product_ids:[98000000+idx],
   training_ids:[97000000+idx],native_price_rub:v?p.variants.find(x=>x.key===v).base_price_rub:p.base_price_rub,
   access_days:365,release_status:'ACTIVE_VERIFIED',
   native_readback_ref:'SYNTHETIC_NATIVE_TEST_'+idx,grant_readback_ref:'SYNTHETIC_GRANT_TEST_'+idx};
 }
 return out;
}
const synthetic=createAdapter({quoteFn:compute,manifest,observedMapping:syntheticMapping()});
const secret=Buffer.alloc(32,113);
test('synthetic-only: all 265 signable priced selections, exact distinct offers/grants/365d, no real checkout',()=>{
 let count=0;
 for(const selection of validSelections){
  const p=synthetic.plan(selection);
  assert.equal(p.ready_for_native_binding,true);
  assert.equal(p.blockers.length,0);
  const token=synthetic.seal(selection,{secret,now:1000000,nonce:(++count).toString(16).padStart(32,'0')});
  const v=synthetic.verify(token,{secret,now:1000001});
  assert.equal(v.plan.quote.total_rub,compute(selection).total_rub);
  assert.deepEqual(v.plan.lines.map(l=>l.line_key),p.lines.map(l=>l.line_key));
  assert.ok(v.plan.lines.every(l=>l.grant.duration_days===365&&l.grant.trigger==='CONFIRMED_PAID_EVENT_ONLY'));
  assert.throws(()=>synthetic.resolve(token,{secret,now:1000001,nativeBindings:{},idempotencyStore:{consume:()=>true}}),/NATIVE_ROUTE_HOLD/);
 }
 assert.equal(count,265);
});
test('HMAC / expiry / stale mapping / price tamper are rejected',()=>{
 const sel={kind:'set',items:['rejection_program','union']};
 const token=synthetic.seal(sel,{secret,now:1000000,nonce:'a'.repeat(32)});
 assert.throws(()=>synthetic.verify(token.slice(0,-1)+'x',{secret,now:1000001}),/TAMPERED_INTENT/);
 assert.throws(()=>synthetic.verify(token,{secret,now:1000300}),/EXPIRED_OR_INVALID_INTENT/);
 assert.throws(()=>synthetic.verify(token,{secret:Buffer.alloc(32,11),now:1000001}),/TAMPERED_INTENT/);
 const modified=syntheticMapping();modified.union.training_ids=[99999999];
 const changed=createAdapter({quoteFn:compute,manifest,observedMapping:modified});
 assert.throws(()=>changed.verify(token,{secret,now:1000001}),/STALE_CATALOG_OR_GRANTS/);
 assert.throws(()=>observedAdapter.verify(token,{secret,now:1000001}),/NATIVE_MAPPING_HOLD/);
});
function fakeRoute(p,url='https://study.shkola-dnv.com/sales/form/qa-synthetic'){
 const r={status:'ACTIVE',selection_key:p.selection_key,verified_provider_selection_key:p.selection_key,
  expected_total_rub:p.quote.total_rub,line_binding_sha256:p.provenance.line_binding_sha256,
  native_public_form_url:url,evidence_refs:{}};
 for(const k of REQUIRED_ROUTE_PROOFS){r[k]=true;r.evidence_refs[k]='SYNTHETIC_TEST_ONLY_'+k}
 return r;
}
test('synthetic-only exact route: rejects wrong sum, missing selection proof, untrusted host and replay',()=>{
 const sel={kind:'set',items:['rejection_program','union']};
 const token=synthetic.seal(sel,{secret,now:1000000,nonce:'b'.repeat(32)});
 const p=synthetic.plan(sel);
 const store={seen:new Set(),consume(k){if(this.seen.has(k))return false;this.seen.add(k);return true}};
 const base=fakeRoute(p),bindings={[p.selection_key]:base};
 assert.throws(()=>synthetic.resolve(token,{secret,now:1000001,nativeBindings:{[p.selection_key]:{...base,expected_total_rub:11691}},idempotencyStore:store}),/NATIVE_ROUTE_HOLD/);
 assert.throws(()=>synthetic.resolve(token,{secret,now:1000001,nativeBindings:{[p.selection_key]:{...base,verified_provider_selection_key:'set:union'}},idempotencyStore:store}),/PROVIDER_SELECTION_UNPROVEN/);
 assert.throws(()=>synthetic.resolve(token,{secret,now:1000001,nativeBindings:{[p.selection_key]:fakeRoute(p,'https://evil.example/pay')},idempotencyStore:store}),/NATIVE_ROUTE_HOLD/);
 const ok=synthetic.resolve(token,{secret,now:1000001,nativeBindings:bindings,idempotencyStore:store});
 assert.equal(ok.total_rub,11690);
 assert.equal(ok.provider_order_status,'NOT_CREATED_BY_THIS_ADAPTER');
 assert.equal(ok.required_grants.length,2);
 assert.throws(()=>synthetic.resolve(token,{secret,now:1000001,nativeBindings:bindings,idempotencyStore:store}),/INTENT_ALREADY_CONSUMED/);
});

