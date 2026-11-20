'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {
 SCHEMA,ISSUER,SCOPE,ENTRY_KEYS,ROUTE_SET,NATIVE_MAP_SHA256,
 signFixture,verifyVersionedManifest
}=require('./r130-versioned-manifest.cjs');
const {signRevisionManifest,verifySignedRevisionManifest,
 SCHEMA:R127_SCHEMA,ISSUER:R127_ISSUER}=require('./r127-signed-revision-manifest.cjs');
const {ENTRIES}=require('./r128-native-cta-map.cjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function fixture(now=Date.now()){
 const pair=crypto.generateKeyPairSync('ed25519');
 const readbackAt=new Date(now-2000).toISOString();
 const r127Offers={};
 for(const key of ROUTE_SET){
  const e=ENTRIES[key];
  r127Offers[key]={offer_id:e.offer_id,
   revision_sha256:sha('R130_TEST_REVISION:'+key),
   native_readback_verified:true,readback_at:readbackAt,
   readback_evidence_sha256:sha('R130_TEST_NATIVE_READBACK:'+key)};
 }
 const r127Payload={schema:R127_SCHEMA,source:R127_ISSUER,
  issued_at:new Date(now-1000).toISOString(),
  expires_at:new Date(now+86400000).toISOString(),offers:r127Offers};
 const r127Envelope=signRevisionManifest(r127Payload,pair.privateKey);
 const routeRevisionManifest=verifySignedRevisionManifest(r127Envelope,{
  publicKey:pair.publicKey,now
 });
 const entries={};
 for(const key of ENTRY_KEYS){
  const e=ENTRIES[key],r=r127Offers[key];
  entries[key]={
   site_entry_key:key,route_key:e.route_key??null,site_lot:e.site_lot??null,
   variant:e.variant??null,widget_id:e.widget_id,offer_id:e.offer_id,
   amount_rub:e.amount_rub,
   product_training_pairs:e.product_training_pairs.map(p=>({
    product_id:p.product_id,training_id:p.training_id??null
   })),
   fulfillment:e.fulfillment??null,customer_title:e.customer_title??null,
   route_status:e.route_status,
   revision_sha256:r?.revision_sha256||sha('R130_TEST_REVISION:'+key),
   native_readback_verified:true,readback_at:readbackAt,
   readback_evidence_sha256:r?.readback_evidence_sha256||sha('R130_TEST_NATIVE_READBACK:'+key)
  };
 }
 const payload={schema:SCHEMA,source:ISSUER,registry_scope:SCOPE,
  version:1,previous_manifest_sha256:null,native_map_sha256:NATIVE_MAP_SHA256,
  route_keys:ROUTE_SET,issued_at:new Date(now-500).toISOString(),
  expires_at:new Date(now+86400000).toISOString(),entries};
 return {pair,r127Envelope,routeRevisionManifest,payload,
  envelope:signFixture(payload,pair.privateKey),now};
}
test('R130 binds exactly 12 existing site entries and 10 exact CTA routes to R128 native map',()=>{
 const f=fixture(),v=verifyVersionedManifest(f.envelope,{
  publicKey:f.pair.publicKey,scope:SCOPE,
  routeRevisionManifest:f.routeRevisionManifest,now:f.now
 });
 assert.equal(v.signature_verified,true);
 assert.equal(v.site_entry_count,12);
 assert.equal(v.individual_route_count,10);
 assert.equal(v.qa_only_entry_count,2);
 assert.deepEqual(v.route_keys,ROUTE_SET);
 assert.equal(v.native_map_sha256,NATIVE_MAP_SHA256);
 assert.equal(v.entries['single:rejection_program'].customer_title,'Исцеление отвержения');
 assert.equal(v.entries.trainer_qa_only.product_training_pairs[0].training_id,935051957);
 assert.deepEqual(v.entries.bundle_qa_only.product_training_pairs,[
  {product_id:4557988,training_id:936022301},
  {product_id:4550895,training_id:933861292}
 ]);
 assert.equal(v.public_release_allowed,false);
});
test('R130 rejects wrong product/training, Offer, Widget, route, price and missing site entry even if re-signed',()=>{
 const f=fixture(),bad=[];
 for(const mutate of [
  p=>{p.entries['single:rejection'].product_training_pairs[0].product_id=4555642},
  p=>{p.entries['single:rejection'].product_training_pairs[0].training_id=936016504},
  p=>{p.entries['single:rejection'].offer_id=8934925},
  p=>{p.entries['single:rejection'].widget_id=1686753},
  p=>{p.entries['single:rejection'].amount_rub=1},
  p=>{p.entries['single:source:2'].product_training_pairs.pop()},
  p=>{delete p.entries.bundle_qa_only},
  p=>{p.route_keys.pop()}
 ]){
  const p=structuredClone(f.payload);mutate(p);
  bad.push(signFixture(p,f.pair.privateKey));
 }
 for(const envelope of bad)assert.throws(()=>verifyVersionedManifest(envelope,{
  publicKey:f.pair.publicKey,scope:SCOPE,
  routeRevisionManifest:f.routeRevisionManifest,now:f.now
 }));
});
test('R130 rejects revision SHA mismatch against signed R127 ten-route manifest',()=>{
 const f=fixture(),p=structuredClone(f.payload);
 p.entries['single:rejection'].revision_sha256='a'.repeat(64);
 assert.throws(()=>verifyVersionedManifest(signFixture(p,f.pair.privateKey),{
  publicKey:f.pair.publicKey,scope:SCOPE,
  routeRevisionManifest:f.routeRevisionManifest,now:f.now
 }),/R130_R127_ROUTE_REVISION_OR_EVIDENCE_MISMATCH/);
});
test('R130 rejects unsigned, tampered, wrong-key, expired and stale-readback manifests',()=>{
 const f=fixture();
 assert.throws(()=>verifyVersionedManifest({...f.envelope,signature:null},{
  publicKey:f.pair.publicKey,scope:SCOPE,
  routeRevisionManifest:f.routeRevisionManifest,now:f.now
 }));
 assert.throws(()=>verifyVersionedManifest({...f.envelope,signature:f.envelope.signature.slice(0,-4)+'AAAA'},{
  publicKey:f.pair.publicKey,scope:SCOPE,
  routeRevisionManifest:f.routeRevisionManifest,now:f.now
 }));
 const other=crypto.generateKeyPairSync('ed25519');
 assert.throws(()=>verifyVersionedManifest(f.envelope,{
  publicKey:other.publicKey,scope:SCOPE,
  routeRevisionManifest:f.routeRevisionManifest,now:f.now
 }));
 const expired=structuredClone(f.payload);expired.expires_at=new Date(f.now-1000).toISOString();
 assert.throws(()=>verifyVersionedManifest(signFixture(expired,f.pair.privateKey),{
  publicKey:f.pair.publicKey,scope:SCOPE,
  routeRevisionManifest:f.routeRevisionManifest,now:f.now
 }));
 const stale=structuredClone(f.payload);
 for(const row of Object.values(stale.entries))row.readback_at=new Date(f.now-31*86400000).toISOString();
 assert.throws(()=>verifyVersionedManifest(signFixture(stale,f.pair.privateKey),{
  publicKey:f.pair.publicKey,scope:SCOPE,
  routeRevisionManifest:f.routeRevisionManifest,now:f.now
 }));
});
test('R130 rejects wrong registry scope, stale route manifest and native map version drift',()=>{
 const f=fixture();
 assert.throws(()=>verifyVersionedManifest(f.envelope,{
  publicKey:f.pair.publicKey,scope:'BF2026_R130_TEST',
  routeRevisionManifest:f.routeRevisionManifest,now:f.now
 }));
 assert.throws(()=>verifyVersionedManifest(f.envelope,{
  publicKey:f.pair.publicKey,scope:SCOPE,
  routeRevisionManifest:null,now:f.now
 }));
 const p=structuredClone(f.payload);p.native_map_sha256='f'.repeat(64);
 assert.throws(()=>verifyVersionedManifest(signFixture(p,f.pair.privateKey),{
  publicKey:f.pair.publicKey,scope:SCOPE,
  routeRevisionManifest:f.routeRevisionManifest,now:f.now
 }));
});
module.exports={fixture};
