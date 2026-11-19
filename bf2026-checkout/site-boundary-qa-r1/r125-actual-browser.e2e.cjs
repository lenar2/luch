'use strict';
/**
 * R125 actual Chromium DOM -> original R109 Buy button/cart -> R125 frontend
 * -> same-origin isolated HTTP proxy -> real R124 route -> PostgreSQL.
 *
 * Run only in ephemeral, isolated, HEADLESS Chromium Docker container with
 * localhost preview stage 18771 and all external URLs blocked.
 * Never reaches GetCourse, live checkout or the public site.
 */
const {chromium}=require('/app/node_modules/playwright-core');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const API='http://127.0.0.1:18771';
const OUTPUT='/r125-evidence/browser-e2e.json';
const BASE=['single:rejection','single:devaluation','single:self','single:guilt',
 'single:rejection_program','single:dnv','single:union','single:source:1','single:source:2','single:personal_zoom'];
const KEYS={1:'single:rejection',2:'single:devaluation',3:'single:self',4:'single:guilt',
 5:'single:rejection_program',6:'single:dnv',7:'single:union',12:'single:personal_zoom'};
async function run(){
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--disable-extensions']});
 const page=await browser.newPage({viewport:{width:1366,height:860},reducedMotion:'reduce'});
 const evidence={schema:'bf2026.r125.browser-e2e.v1',browser:'ephemeral_headless_chromium',
  preview:API,blocked_external_requests:0,getcourse_network_requests_sent:0,public_pay_navigation:0,
  cards_validated:[],prepared:[],negative_cases:[],qa_request_keys:[]};
 const backendRequests=[];
 page.on('request',request=>{
  if(request.url().includes('/api/checkout/_qa/single-form/prepare')){
   const k=request.headers()['x-bf2026-idempotency-key'];
   if(k&&!evidence.qa_request_keys.includes(k))evidence.qa_request_keys.push(k);
   backendRequests.push({url:request.url(),post:request.postData()});
  }
 });
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e.message)));
 await page.route('**/*',route=>{
  let u;try{u=new URL(route.request().url())}catch{return route.abort()}
  if(u.hostname==='127.0.0.1'&&u.port==='18771'&&u.protocol==='http:')
   return route.continue();
  evidence.blocked_external_requests++;return route.abort();
 });
 try{
  const response=await page.goto(API+'/',{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.BF2026R125Preview?.mode==='STAGE_ONLY_NO_PAYMENT',{timeout:12000});
  assert.equal(await page.locator('#r125-preview-review').count(),1);
  const originals=await page.locator('.lot-card button.buy-lot[data-r125-lot]').count();
  assert.equal(originals,10,'exact existing 10 CTA buttons from R109 patched in isolated copy');
  assert.equal(await page.locator('#cart-layer .cart-checkout').isDisabled(),true);
  assert.equal(await page.locator('#r125-oferta').getAttribute('required'),'');
  evidence.cards_validated.push({existing_buttons:originals,initial_public_pay_disabled:true});

  async function resetCart(){
   for(let i=0;i<12;i++){
    if((await page.evaluate(()=>window.BF2026Cart.getSnapshot().lines)).length===0)break;
    await page.locator('#cart-rows .cart-remove').first().click();
   }
   assert.equal((await page.evaluate(()=>window.BF2026Cart.getSnapshot().lines)).length,0);
   if(await page.locator('#cart-layer').isVisible())await page.locator('#cart-close').click();
   await page.waitForTimeout(25);
  }
  async function choose(lot,variant){
   await resetCart();
   if(lot===9){
    await page.locator('input[name="source-variant"][value="'+variant+'"]').check();
   }
   await page.locator('#lot-'+lot+' button.buy-lot').click();
   await page.waitForFunction(()=>window.BF2026R125Preview?.getStatus()?.inspected===true,{timeout:8000});
   const snap=await page.evaluate(()=>window.BF2026R125Preview.getStatus());
   assert.equal(snap.payment_button_disabled,true);
   assert.equal(snap.button_disabled,true,'unchecked oferta cannot enable review');
   assert.equal(snap.consent_checked,false);
   assert.equal(snap.marketing_checked,false);
   return snap;
  }

  const first=await choose(1);
  assert.equal(first.route,'single:rejection');
  const prior=backendRequests.length;
  assert.equal(await page.locator('#r125-review').isDisabled(),true);
  await page.locator('#r125-review').dispatchEvent('click');
  assert.equal(backendRequests.length,prior,'unchecked native consent must block browser POST');
  evidence.negative_cases.push('unchecked_browser_no_POST');

  // Direct, controlled malicious input against the SAME real R124 gateway
  // proves server-side refusal even when the browser's required check is bypassed.
  const malicious=await page.evaluate(async()=>{
   const endpoint='/api/checkout/_qa/single-form/prepare';
   const request=async(body)=>{
    const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
    const id=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
    const response=await fetch(endpoint,{method:'POST',credentials:'omit',cache:'no-store',
     headers:{'content-type':'application/json','x-bf2026-idempotency-key':id},
     body:JSON.stringify(body)});
    return {http:response.status,json:await response.json()};
   };
   const selection={kind:'single',lot:1},fixed={oferta_custom_field_id:22204810,
    oferta_checkbox_checked:true,marketing_checkbox_checked:false};
   return Promise.all([
    request({selection,consent:{...fixed,oferta_checkbox_checked:false}}),
    request({selection,consent:{...fixed,marketing_checkbox_checked:true}}),
    request({selection,consent:{...fixed,oferta_custom_field_id:1}}),
    request({selection,consent:fixed,paid:true}),
    request({selection:{...selection,offer_id:8934973},consent:fixed}),
   ]);
  });
  for(const m of malicious){
   assert.equal(m.http,422,JSON.stringify(m));
   assert.equal(m.json.public_release_allowed,false);
   assert.equal(m.json.checkout_url,null);
  }
  evidence.negative_cases.push('server_side_unchecked_and_marketing_and_wrong_field_and_forged_paid_and_extra_offer_422');

  await page.locator('#r125-oferta').check();
  await page.waitForFunction(()=>!document.getElementById('r125-review').disabled,{timeout:4000});
  await page.locator('#r125-marketing').check();
  assert.equal(await page.locator('#r125-review').isDisabled(),true);
  await page.locator('#r125-marketing').uncheck();
  assert.equal(await page.locator('#r125-review').isEnabled(),true);
  evidence.negative_cases.push('marketing_optin_blocks_preview_prepare');

  // Test a real user click on existing buy-lot, then QA-only consent review.
  const beforeValid=backendRequests.length;
  await page.locator('#r125-review').click();
  await page.waitForFunction(()=>document.getElementById('r125-review-status').textContent.includes('Состав и ввод согласия'),{timeout:7000});
  let prev=backendRequests.length;
  assert.equal(prev,beforeValid+1);
  await page.locator('#r125-review').click();
  await page.waitForFunction(()=>document.getElementById('r125-review-status').textContent.includes('Повтор подтверждён'),{timeout:7000});
  assert.equal(backendRequests.length,prev+1);
  evidence.prepared.push({route:first.route,exact_replay:true,idempotent:true});

  // REAL browser-cart and quote/widget inspection for every existing
  // separately purchasable native form variant (no money submitted).
  for(const [lot,route,variant] of [
   [2,'single:devaluation'],[3,'single:self'],[4,'single:guilt'],
   [5,'single:rejection_program'],[6,'single:dnv'],[7,'single:union'],
   [9,'single:source:1','1'],[9,'single:source:2','2'],
   [12,'single:personal_zoom']
  ]){
   const snap=await choose(lot,variant);
   assert.equal(snap.route,route);
   await page.locator('#r125-oferta').check();
   await page.waitForFunction(()=>!document.getElementById('r125-review').disabled,{timeout:4000});
   await page.locator('#r125-review').click();
   await page.waitForFunction(()=>document.getElementById('r125-review-status').textContent.includes('Состав и ввод согласия'),{timeout:7000});
   evidence.prepared.push({route,real_browser_DOM:true,http_post_to_staging:true,
    no_payment:true,public_checkout_url:null});
   assert.equal(await page.locator('#cart-layer .cart-checkout').isDisabled(),true);
  }
  assert.deepEqual(evidence.prepared.map(x=>x.route),BASE);

  // Trainer on 10th buy button is separate QA-only native candidate,
  // NOT one of the 10 supported Offer routes; do not substitute it.
  await resetCart();
  await page.locator('#lot-8 button.buy-lot').click();
  await page.waitForFunction(()=>document.getElementById('r125-route').textContent.includes('Тренер по отношениям'),{timeout:3000});
  assert.equal(await page.locator('#r125-review').isDisabled(),true);
  assert.equal(await page.locator('#cart-layer .cart-checkout').isDisabled(),true);
  evidence.negative_cases.push('trainer_QA_only_no_R124_route');

  // Anti-price-tamper: a changed card Offer must not become payable.
  await resetCart();
  await page.evaluate(()=>document.querySelector('#lot-1 .buy-lot').dataset.r125Offer='123');
  await page.locator('#lot-1 button.buy-lot').click();
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#r125-review').isDisabled(),true);
  evidence.negative_cases.push('frontend_offer_dataset_tamper_blocked');
  assert.equal(await page.locator('#cart-layer .cart-checkout').isDisabled(),true);
  assert.equal(page.url().startsWith(API),true);
  evidence.public_pay_navigation=0;
  // Internal page may have unrelated in-landing animations; no JS errors expected.
  assert.equal(errors.length,0,JSON.stringify(errors.slice(0,5)));
  evidence.pass=true;
 }catch(e){
  evidence.pass=false;evidence.error=String(e.stack||e);
  throw e;
 }finally{
  fs.writeFileSync(OUTPUT,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
  await browser.close();
  console.log('R125_ACTUAL_BROWSER_E2E_EVIDENCE',JSON.stringify({
   pass:evidence.pass,real_routes:evidence.prepared.map(x=>x.route),
   negatives:evidence.negative_cases,js_errors:errors.length,
   actual_getcourse_network_requests:evidence.getcourse_network_requests_sent,
   external_requests_blocked:evidence.blocked_external_requests,
   checkout_navigations:evidence.public_pay_navigation,request_keys:evidence.qa_request_keys.length
  }));
 }
}
run().catch(e=>{console.error('R125_BROWSER_FAILED',String(e.message));process.exitCode=1});
