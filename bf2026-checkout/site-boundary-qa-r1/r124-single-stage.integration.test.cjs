'use strict';
/**
 * R124 LIVE LOOPBACK HTTP + REAL STAGING POSTGRES INTEGRATION.
 * No synthetic payment/receipt/grant proof, no GetCourse calls.
 * Requests target the actual isolated site server at 127.0.0.1:18769.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const {EXPECTED}=require('./r123-single-widget-adapter.cjs');
const enabled=process.env.BF2026_STAGE_ONLY==='1'&&process.env.BF2026_R124_STAGE_PORT==='18769'&&
 !!process.env.BF2026_STAGE_PG_POOL_MODULE;
const base='http://127.0.0.1:18769';
const qaKeyPath='/srv/factory-scratch/bf2026-r118-relay-stage-20261119/private-widget-qa.secret';
const newKey=()=>crypto.randomBytes(16).toString('hex');
const consent=()=>({oferta_custom_field_id:22204810,oferta_checkbox_checked:true,marketing_checkbox_checked:false});
function selection(key){
 const e=EXPECTED[key];
 assert.ok(e,'exact verified R123 key');
 const s={kind:'single',lot:e.lot??9};
 if(key.startsWith('single:source:'))s.variant=key.slice(-1);
 return s;
}
test('R124 actual isolated site HTTP + PostgreSQL: all existing single forms, consent contract and idempotency',
 {skip:!enabled},async t=>{
 const pg=require(process.env.BF2026_STAGE_PG_POOL_MODULE).pool;
 assert.equal(pg.options.host,'127.0.0.1');assert.equal(Number(pg.options.port),55439);
 assert.equal(pg.options.database,'bfstage');
 const qaKey=fs.readFileSync(qaKeyPath,'utf8').trim();
 const keys=[];
 t.after(async()=>{
  if(keys.length)await pg.query('DELETE FROM bf2026_single_checkout_qa_intents WHERE request_key=ANY($1::text[])',[keys]);
  await pg.end();
 });
 async function request(path,{method='GET',authorized=true,origin,body,id,contentType='application/json'}={}){
  const headers={};
  if(authorized)headers['x-bf2026-qa-key']=qaKey;
  if(id)headers['x-bf2026-idempotency-key']=id;
  if(origin!==undefined)headers.origin=origin;
  let data;
  if(body!==undefined){
   headers['content-type']=contentType;
   data=JSON.stringify(body);
  }
  const res=await fetch(base+path,{method,headers,body:data,redirect:'error'});
  const json=await res.json();
  return {code:res.status,data:json};
 }
 const root='/api/checkout/_qa/single-form/';
 function key(){const k=newKey();keys.push(k);return k}
 async function prepare(route,id,patch={}){return request(root+'prepare',{method:'POST',id,
  body:{selection:selection(route),consent:consent(),...patch}})}
 await t.test('R124 route requires existing QA auth and actual PG migration',async()=>{
  const anon=await request(root+'status',{authorized:false});
  assert.equal(anon.code,404);
  const x=await request(root+'status');
  assert.equal(x.code,200,JSON.stringify(x.data));
  assert.equal(x.data.existing_native_forms,10);
  assert.equal(x.data.mapping_complete,true);assert.equal(x.data.postgres_ready,true);
  assert.equal(x.data.public_release_allowed,false);
  assert.equal(x.data.fiscal_receipt_verified,false);assert.equal(x.data.actual_grants_verified,false);
  const forged=await request(root+'status',{origin:'https://attacker.example'});
  assert.equal(forged.code,403);
 });
 await t.test('actual site inspect returns exact 10 Offer/Widget/Price/Training pairs without checkout',async()=>{
  for(const [route,e] of Object.entries(EXPECTED)){
   const r=await request(root+'inspect?route='+encodeURIComponent(route));
   assert.equal(r.code,200,route+' '+JSON.stringify(r.data));
   assert.equal(r.data.key,route);assert.equal(r.data.offer_id,e.offer_id);
   assert.equal(r.data.widget_id,e.widget_id);assert.equal(r.data.price_rub,e.price);
   const want=e.pairs.map(([product_id,training_id])=>({product_id,training_id:training_id||null}));
   assert.deepEqual(r.data.product_training_pairs,want,route);
   assert.equal(r.data.checkout_url,null);assert.equal(r.data.public_release_allowed,false);
   assert.equal(r.data.fiscal_receipt_verified,false);assert.equal(r.data.actual_grants_verified,false);
  }
  const bad=await request(root+'inspect?route='+encodeURIComponent('single:trainer'));
  assert.equal(bad.code,404);
  const extra=await request(root+'inspect?route=single%3Arejection&offer_id=123');
  assert.equal(extra.code,422);
 });
 await t.test('real public site routes still do not expose individual checkout links',async()=>{
  for(const [route] of Object.entries(EXPECTED)){
   const form=await request('/api/checkout/form?route='+encodeURIComponent(route),{authorized:false});
   assert.equal(form.code,404,route);
   const start=await request('/api/checkout/start',{method:'POST',authorized:false,body:selection(route)});
   assert.equal(start.code,503,route+' '+JSON.stringify(start.data));
   assert.equal(start.data.code,'GETCOURSE_OFFER_NOT_READY');
   assert.equal('checkout_url' in start.data,false);
  }
  const status=await request('/api/checkout/status',{authorized:false});
  assert.equal(status.code,200);
  assert.equal(status.data.sales_ready,false);assert.equal(status.data.verified_sale_routes,0);
  assert.equal(status.data.sets_released,0);
 });
 await t.test('missing, false or forged consent; marketing opt-in; wrong origin and caller-supplied receipt fail before DB writes',async()=>{
  const route='single:rejection';
  const attempts=[
   [null,{selection:selection(route),consent:consent()},422],
   [key(),{selection:selection(route),consent:{...consent(),oferta_checkbox_checked:false}},422],
   [key(),{selection:selection(route),consent:{...consent(),marketing_checkbox_checked:true}},422],
   [key(),{selection:selection(route),consent:{...consent(),oferta_custom_field_id:999}},422],
   [key(),{selection:selection(route),consent:{...consent(),native_receipt_verified:true}},422],
   [key(),{selection:selection(route),consent:consent(),paid:true},422],
   [key(),{selection:selection(route),consent:consent(),price_rub:12990},422],
   [key(),{selection:{kind:'single',lot:1,offer_id:8934973},consent:consent()},422],
   [key(),{selection:{kind:'set',items:['rejection_program','union']},consent:consent()},422]
  ];
  for(const [id,body,status] of attempts){
   const r=await request(root+'prepare',{method:'POST',id,body});
   assert.equal(r.code,status,JSON.stringify(r.data));
   assert.equal(r.data.public_release_allowed,false);
  }
  const spoof=await request(root+'prepare',{method:'POST',id:key(),
   body:{selection:selection(route),consent:consent()},origin:'https://evil.example'});
  assert.equal(spoof.code,403);
  const anon=await request(root+'prepare',{method:'POST',authorized:false,id:key(),
   body:{selection:selection(route),consent:consent()}});
  assert.equal(anon.code,404);
  const rows=await pg.query('SELECT count(*)::int n FROM bf2026_single_checkout_qa_intents WHERE request_key=ANY($1::text[])',[keys]);
  assert.equal(rows.rows[0].n,0,'invalid inputs did not persist or create customer records');
 });
 await t.test('all 10 native forms create only stage HOLD receipts/contracts; 0 paid/checkout',async()=>{
  for(const [route,e] of Object.entries(EXPECTED)){
   const id=key(),r=await prepare(route,id);
   assert.equal(r.code,202,route+' '+JSON.stringify(r.data));
   assert.equal(r.data.duplicate,false);
   assert.equal(r.data.route_key,route);
   assert.equal(r.data.widget_id,e.widget_id);assert.equal(r.data.offer_id,e.offer_id);
   assert.equal(r.data.price_rub,e.price);
   assert.equal(r.data.consent_input_checked,true);
   assert.equal(r.data.provider_side_consent_enforcement_verified,false);
   assert.equal(r.data.legal_negative_submit_verified,false);
   assert.equal(r.data.receipt_contract,'PROVIDER_FISCAL_RECEIPT_REQUIRED');
   assert.equal(r.data.fiscal_receipt_verified,false);
   assert.equal(r.data.actual_grants_verified,false);
   assert.equal(r.data.charge_writes,0);assert.equal(r.data.orders_created,0);
   assert.equal(r.data.grant_writes,0);assert.equal(r.data.checkout_url,null);
   assert.equal(r.data.public_release_allowed,false);
   if(route==='single:personal_zoom')assert.equal(r.data.rights_contract,'THREE_ZOOM_BOOKINGS_REQUIRED');
   else assert.equal(r.data.rights_contract,'NATIVE_PURCHASE_TRAINING_READBACK_REQUIRED');
   const row=await pg.query('SELECT route_key,offer_id,widget_id,quote_rub,state FROM bf2026_single_checkout_qa_intents WHERE request_key=$1',[id]);
   assert.equal(row.rowCount,1);assert.equal(row.rows[0].route_key,route);
   assert.equal(Number(row.rows[0].offer_id),e.offer_id);
   assert.equal(row.rows[0].state,'HOLD_PROVIDER_CONSENT_RECEIPT_AND_ENTITLEMENTS');
  }
 });
 await t.test('concurrent exact replay deduplicated; same key wrong selection returns 409',async()=>{
  const id=key(),selectionKey='single:source:2';
  const [a,b]=await Promise.all([prepare(selectionKey,id),prepare(selectionKey,id)]);
  assert.equal(a.code,202);assert.equal(b.code,202);
  assert.equal([a.data.duplicate,b.data.duplicate].filter(Boolean).length,1,
   'one new staging quote-intent and one replay');
  const changed=await prepare('single:rejection',id);
  assert.equal(changed.code,409);assert.equal(changed.data.code,'R124_IDEMPOTENCY_PAYLOAD_CONFLICT');
  const row=await pg.query('SELECT count(*)::int n FROM bf2026_single_checkout_qa_intents WHERE request_key=$1',[id]);
  assert.equal(row.rows[0].n,1);
 });
 await t.test('stage evidence does not invent GetCourse payment, receipt or access',async()=>{
  const ledger=await pg.query('SELECT count(*)::int n FROM bf2026_native_bundle_verification');
  assert.equal(ledger.rows[0].n,0);
  const callback=await pg.query('SELECT count(*)::int n FROM bf2026_getcourse_callback_hints');
  assert.equal(callback.rows[0].n,0);
  const records=await pg.query('SELECT payload_sha256,state FROM bf2026_single_checkout_qa_intents WHERE request_key=ANY($1::text[])',[keys]);
  assert.equal(records.rows.length,11);
  for(const row of records.rows){
   assert.match(row.payload_sha256,/^[a-f0-9]{64}$/);
   assert.equal(row.state,'HOLD_PROVIDER_CONSENT_RECEIPT_AND_ENTITLEMENTS');
  }
 });
});
