'use strict';
/* Disposable localhost-only Chromium on the ACTUAL isolated Lot10 iframe.
 * No GetCourse login/UI or order/payment call. Tests the existing selection
 * widget, server-side quote, one-native-order line mapping and fail-closed UI.
 */
const assert=require('node:assert/strict');
const {chromium}=require('/app/node_modules/playwright-core');
const BASE='http://127.0.0.1:18777';
const CASES=[
 {items:['rejection','union'],expected:2},
 {items:['rejection','union','dnv'],expected:3},
 {items:['rejection_program','union','trainer','source'],expected:4,sourceVariant:'1'},
 {items:['rejection_program','union','trainer','source','dnv'],expected:5,sourceVariant:'2'}
];
const KEYS=['rejection','devaluation','self','guilt','rejection_program','dnv','union','trainer','source'];
async function run(){
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run',
   '--disable-extensions','--disable-background-networking']});
 const page=await browser.newPage({viewport:{width:1366,height:920},reducedMotion:'reduce'});
 const requests=[],external=[],navigation=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.url().endsWith('/api/checkout/set/plan'))requests.push(r.postData())});
 page.on('framenavigated',frame=>navigation.push(frame.url()));
 await page.route('**/*',route=>{
  const raw=route.request().url();let u;
  try{u=new URL(raw)}catch{return route.abort()}
  if(u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.port==='18777')
   return route.continue();
  external.push(raw);return route.abort();
 });
 const report={schema:'bf2026.r130.lot10.actual-iframe-browser-e2e.v1',
  origin:BASE,route_plans:[],actual_provider_requests:0,
  orders_created:0,payments_created:0,payment_redirects:0,pass:false};
 try{
  const r=await page.goto(BASE+'/',{waitUntil:'domcontentloaded',timeout:25000});
  assert.equal(r.status(),200);
  await page.waitForFunction(()=>document.querySelector('iframe#lot10-set-frame')?.contentDocument?.readyState==='complete',
   null,{timeout:14000});
  const frame=page.frames().find(f=>f.url().includes('/assets/lot10-set/index.html'));
  assert.ok(frame,'R130 iframe absent');
  await frame.waitForFunction(()=>window.BF2026SetQuote?.getSnapshot&&
   document.querySelector('#lot-10-set #submit'),null,{timeout:12000});
  const checkboxes=frame.locator('.choice input[type="checkbox"]');
  assert.equal(await checkboxes.count(),9);
  await frame.locator('#audio-choice-group summary').click();
  for(const scenario of CASES){
   // Explicitly reset the current selections between independent cases.
   for(let i=0;i<9;i++)if(await checkboxes.nth(i).isChecked())
    await frame.locator('.choice').nth(i).click();
   for(const key of scenario.items){
    const index=KEYS.indexOf(key);assert.ok(index>=0);
    await frame.locator('.choice').nth(index).click();
    assert.equal(await checkboxes.nth(index).isChecked(),true);
   }
   if(scenario.sourceVariant){
    await frame.locator('label.source-tariff').nth(Number(scenario.sourceVariant)-1).click();
   }
   const q=await frame.evaluate(()=>window.BF2026SetQuote.getSnapshot());
   assert.equal(q.count,scenario.expected);
   assert.equal(await frame.locator('#submit').isEnabled(),true);
   const old=requests.length;
   await frame.locator('#submit').click();
   await frame.waitForFunction(()=>document.querySelector('#hint')?.textContent.includes(
    'Сервер подтвердил:'),null,{timeout:10000});
   assert.equal(requests.length,old+1);
   const actual=JSON.parse(requests.at(-1));
   assert.deepEqual(actual.items,scenario.items);
   if(scenario.sourceVariant)assert.equal(actual.source_variant,scenario.sourceVariant);
   const response=await page.evaluate(async body=>{
    const r=await fetch('/api/checkout/set/plan',{method:'POST',
     headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    return {code:r.status,data:await r.json()}
   },actual);
   assert.equal(response.code,200);
   assert.equal(response.data.order.expected_single_order,true);
   assert.equal(response.data.order.expected_line_items.length,scenario.expected);
   assert.equal(response.data.order.expected_payment_total_rub,q.total_rub);
   assert.equal(response.data.order.expected_line_items.reduce((s,x)=>s+x.line_price_rub,0),q.total_rub);
   assert.equal(response.data.public_release_allowed,false);
   assert.equal(response.data.checkout_url,null);
   assert.match(await frame.locator('#hint').textContent(),/заказ не создан/i);
   report.route_plans.push({count:q.count,price_rub:q.total_rub,
    native_offer_ids:response.data.order.expected_line_items.map(x=>x.offer_id),
    one_order:true,payment_hold:true});
  }
  // Unsupported browser-controlled price/offer values cannot reach the quote.
  const attack=await page.evaluate(async()=>{
   const r=await fetch('/api/checkout/set/plan',{method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({kind:'set',items:['rejection','union'],
      offer_id:111,consent_checked:true,price_rub:1})});
   return {status:r.status,data:await r.json()};
  });
  assert.equal(attack.status,422);
  assert.equal(attack.data.public_release_allowed,false);
  report.invalid_offer_and_client_consent_rejected=true;
  const route=await page.evaluate(async()=>{
   const r=await fetch('/api/checkout/set/status');return await r.json();
  });
  assert.equal(route.live_provider_import_enabled,false);
  assert.equal(route.public_release_allowed,false);
  assert.equal(errors.length,0,errors.join(','));
  assert.ok(navigation.every(x=>x.startsWith(BASE)),JSON.stringify(navigation));
  report.external_requests_blocked=external.length;
  report.pass=true;
 }finally{
  await browser.close();
  console.log('R130_LOT10_CHROMIUM_E2E',JSON.stringify(report));
 }
}
run().catch(e=>{console.error('R130_LOT10_CHROMIUM_FAILURE',e.stack||e);process.exitCode=1});
