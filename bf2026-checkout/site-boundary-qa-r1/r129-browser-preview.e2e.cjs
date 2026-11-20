'use strict';
/* R129 isolated, disposable HEADLESS Chromium browser E2E.
 * Only 127.0.0.1:18775 is allowed. Never navigate to GetCourse or public site.
 * Real approved R109 HTML copy + ten existing Buy CTAs -> cart ->
 * R128 preview -> actual R129 HTTP bridge -> PostgreSQL16 HOLD.
 */
const {chromium}=require('/app/node_modules/playwright-core');
const assert=require('node:assert/strict');
const API='http://127.0.0.1:18775';
const CASES=[
 [1,'single:rejection',8934973],
 [2,'single:devaluation',8934925],
 [3,'single:self',8934974],
 [4,'single:guilt',8934979],
 [5,'single:rejection_program',8933492],
 [6,'single:dnv',8934207],
 [7,'single:union',8919715],
 [9,'single:source:1',8934262,'1'],
 [9,'single:source:2',8934987,'2'],
 [12,'single:personal_zoom',8934993]
];
async function run(){
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run',
   '--disable-extensions','--disable-background-networking']});
 const page=await browser.newPage({viewport:{width:1366,height:860},reducedMotion:'reduce'});
 const requests=[],errors=[],externalBlocked=[],navigation=[];
 page.on('request',req=>{
  const u=req.url();
  if(u.includes('/api/checkout/consent/challenge'))requests.push({url:u,post:req.postData()});
  if(u.includes('study.shkola-dnv.com'))throw Error('UNEXPECTED_GETCOURSE_REQUEST');
 });
 page.on('pageerror',err=>errors.push(String(err.message)));
 page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigation.push(frame.url())});
 await page.route('**/*',route=>{
  const raw=route.request().url();
  let u;try{u=new URL(raw)}catch{return route.abort()}
  if(u.hostname==='127.0.0.1'&&u.port==='18775'&&u.protocol==='http:')
   return route.continue();
  externalBlocked.push(raw);return route.abort();
 });
 const report={schema:'bf2026.r129.disposable-browser-consent-cta-e2e.v1',
  browser:'disposable_chromium_not_getcourse_ui',origin:API,
  native_provider_requests:0,orders_created:0,payments_created:0,
  validated_routes:[],negative_scenarios:[],pass:false};
 async function resetCart(){
  for(let i=0;i<12;i++){
   const rows=await page.evaluate(()=>window.BF2026Cart?.getSnapshot().lines.length);
   if(rows===0)break;
   await page.locator('#cart-rows .cart-remove').first().click();
  }
  assert.equal(await page.evaluate(()=>window.BF2026Cart.getSnapshot().lines.length),0);
  if(await page.locator('#cart-layer').isVisible())await page.locator('#cart-close').click();
 }
 try{
  const response=await page.goto(API+'/',{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.BF2026Cart?.getSnapshot&&
   document.getElementById('r128-consent-preview'),null,{timeout:18000});
  assert.equal(await page.locator('button.buy-lot[data-r128-lot]').count(),10);
  assert.equal(await page.locator('#cart-layer .cart-checkout').isDisabled(),true);
  for(const [lot,route,offer,variant] of CASES){
   await resetCart();
   if(lot===9)
    await page.locator('input[name="source-variant"][value="'+variant+'"]').check();
   await page.locator('#lot-'+lot+' button.buy-lot').click();
   await page.waitForFunction((expected)=>
    document.getElementById('r128-selection')?.textContent.includes(expected),
    route,{timeout:9000});
   const info=await page.locator('#r128-selection').textContent();
   assert.match(info,new RegExp('Offer '+offer+'\\b'));
   assert.equal(await page.locator('#r128-challenge').isEnabled(),true);
   const prior=requests.length;
   await page.locator('#r128-challenge').click();
   await page.waitForFunction(()=>
    document.getElementById('r128-result')?.textContent.includes(
     'R130_VERSIONED_MANIFEST_NOT_ACTIVE'),
    null,{timeout:9000});
   assert.equal(requests.length,prior+1);
   const p=JSON.parse(requests.at(-1).post);
   assert.equal(p.kind,'single');
   assert.equal(p.lot,lot);
   if(variant)assert.equal(p.variant,variant);
   assert.equal(Object.hasOwn(p,'consent_checked'),false);
   assert.equal(Object.hasOwn(p,'offer_id'),false);
   assert.equal(Object.hasOwn(p,'provider_consent_verified'),false);
   assert.equal(await page.locator('#cart-layer .cart-checkout').isDisabled(),true);
   report.validated_routes.push({route_key:route,offer_id:offer,
    status:'HOLD_R130_VERSIONED_MANIFEST_NOT_ACTIVE',challenge_http_posted:true,
    native_payment_opened:false});
  }
  assert.deepEqual(report.validated_routes.map(x=>x.route_key),CASES.map(x=>x[1]));
  await resetCart();
  await page.locator('#lot-8 button.buy-lot').click();
  await page.waitForFunction(()=>
    document.getElementById('r128-selection')?.textContent.includes('Тренер по отношениям'),
    null,{timeout:6000});
  assert.equal(await page.locator('#r128-challenge').isDisabled(),true);
  report.negative_scenarios.push('trainer_QA_only_not_silently_single_route');
  assert.equal(await page.locator('#cart-layer .cart-checkout').isDisabled(),true);
  const direct=await page.evaluate(async()=>{
   const response=await fetch('/api/checkout/_provider/getcourse/order-created',{method:'POST',
    headers:{'content-type':'application/json'},body:'{}'});
   return {status:response.status,text:await response.text()};
  });
  assert.equal(direct.status,405);
  report.negative_scenarios.push('preview_denies_provider_callback_proxy_METHOD_NOT_ALLOWED');
  assert.equal(errors.length,0,JSON.stringify(errors));
  assert.equal(navigation.every(x=>x.startsWith(API)),true);
  report.blocked_external_requests=externalBlocked.length;
  report.public_payment_navigations=0;
  report.pass=true;
 }finally{
  await browser.close();
  console.log('R129_DISPOSABLE_BROWSER_E2E',JSON.stringify(report));
 }
}
run().catch(e=>{console.error('R129_DISPOSABLE_BROWSER_FAIL',String(e.stack||e));process.exitCode=1});
