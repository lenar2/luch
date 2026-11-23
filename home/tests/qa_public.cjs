const fs=require('fs'),{chromium}=require('playwright-core'),crypto=require('crypto');
const DOMAIN='https://luch.lenarsalimov.ru',BASE=DOMAIN+'/home/';
const qaName=(prefix)=>prefix+crypto.randomBytes(5).toString('hex');
const checks=[],screens=[];
const info=(message,detail={})=>checks.push({message,...detail});
(async()=>{
 let browser=null;let a=null,b=null;let userA="",userB="";
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  a=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:'en-US'});
  const p=await a.newPage();
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  let response=await p.goto(BASE,{waitUntil:'domcontentloaded',timeout:25000});
  if(response.status()!==200)throw Error('PUBLIC_HTTPS_BAD_STATUS '+response.status());
  await p.locator('#register-form').waitFor({state:'visible',timeout:15000});
  if((await p.locator('h1').first().textContent()).includes('скрыт'))throw Error('GUEST_COPY_INVALID');
  await p.screenshot({path:'/out/r7-public-mobile-guest.png',fullPage:false});
  let website=await p.goto(DOMAIN+'/en/',{waitUntil:'domcontentloaded',timeout:18000});
  if(website.status()!==200||await p.locator('a[href="/home/"]').count()<1)throw Error('MARKETING_HOME_LINK_MISSING');
  info('PUBLIC_MARKETING_INTEGRATED',{http:website.status()});
  await p.goto(BASE,{waitUntil:'domcontentloaded',timeout:18000});
  await p.locator('#register-form').waitFor({state:'visible'});
  userA=qaName('r7a');
  const passwordA='Generated-QA-Only-'+crypto.randomBytes(16).toString('hex');
  await p.fill('#register-username',userA);
  await p.fill('#register-password',passwordA);
  await p.locator('#register-form button[type="submit"]').click();
  await p.locator('#workspace').waitFor({state:'visible',timeout:20000});
  if((await p.locator('#user-chip').textContent())!==userA)throw Error('USER_A_ACCOUNT_MISMATCH');
  info('USER_A_SIGNUP_ACTUAL_PUBLIC');
  await p.screenshot({path:'/out/r7-public-mobile-home.png',fullPage:false});
  await p.locator('[data-go="check"]').first().click();
  await p.locator('#grant-form').waitFor({state:'visible'});
  await p.fill('#website-url','https://example.com');
  await p.check('#consent-box');
  await p.locator('#grant-form button[type=submit]').click();
  await p.locator('#granted').waitFor({state:'visible',timeout:15000});
  info('ORIGIN_SCOPED_CONSENT_ACTUAL_PUBLIC');
  await p.locator('#run-check').click();
  await p.locator('#site-result').waitFor({state:'visible',timeout:26000});
  const http=(await p.locator('#result-http').textContent()).trim();
  const title=(await p.locator('#result-title').textContent()).trim();
  if(http!=='200'||title!=='Example Domain')throw Error('WRONG_REAL_SOURCE_RESULT '+http+' '+title);
  const dataA=await p.evaluate(async()=>await (await fetch('/home/api/state',{credentials:'same-origin'})).json());
  if(dataA.checks?.length!==1||dataA.checks[0].result.sha256_prefix.length!==24)throw Error('NO_DURABLE_REAL_RECEIPT');
  info('REAL_REMOTE_HTTPS_CHECK',{http:Number(http),page_title:title,sha256_prefix:dataA.checks[0].result.sha256_prefix});
  await p.screenshot({path:'/out/r7-public-mobile-result.png',fullPage:false});
  // Independent user B: no access to A's result or grant.
  b=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:'en-US'});
  const pb=await b.newPage();userB=qaName('r7b');
  await pb.goto(BASE,{waitUntil:'domcontentloaded',timeout:18000});
  await pb.fill('#register-username',userB);
  await pb.fill('#register-password','Another-QA-Only-'+crypto.randomBytes(14).toString('hex'));
  await pb.locator('#register-form button[type=submit]').click();
  await pb.locator('#workspace').waitFor({state:'visible',timeout:20000});
  const dataB=await pb.evaluate(async()=>await (await fetch('/home/api/state',{credentials:'same-origin'})).json());
  if(dataB.checks?.length!==0||dataB.grant!==null)throw Error('CROSS_USER_DATA_EXPOSURE');
  info('ISOLATED_USER_B',{own_checks:dataB.checks?.length});
  // Revoke A, then attempt exact same check with correct CSRF, expect a real authorization failure.
  await p.locator('[data-go="permissions"]').first().click();
  p.once('dialog',dialog=>dialog.accept());
  await p.locator('#revoke-grant').click();
  await p.locator('#revoke-grant').waitFor({state:'hidden',timeout:14000});
  const deny=await p.evaluate(async()=>{
   const state=await (await fetch('/home/api/state',{credentials:'same-origin'})).json();
   const x=await fetch('/home/api/check',{method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json','X-LUCH-CSRF':state.csrf},body:'{}'});
   return {status:x.status,data:await x.json()};
  });
  if(deny.status!==403)throw Error('REVOKED_USER_CAN_STILL_CHECK '+deny.status);
  info('REVOKED_GRANT_DENIED',{status:deny.status});
  await p.locator('[data-go="activity"]').first().click();
  if((await p.locator('#activity-list').textContent()).indexOf('Website check')===-1)throw Error('HISTORY_NOT_VISIBLE');
  await p.locator('[data-language]').first().click();
  if(await p.evaluate(()=>document.documentElement.lang)!=='ru')throw Error('RU_SWITCH_BROKEN');
  await p.screenshot({path:'/out/r7-public-mobile-ru.png',fullPage:false});
  if(await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth))
    throw Error('MOBILE_HORIZONTAL_OVERFLOW');
  info('REAL_IPHONE_WIDTH_RU_EN_QA',{viewport:390});
  // Delete BOTH disposable public QA accounts, cascaded session/grants/checks/events.
  await p.locator('[data-go="permissions"]').first().click();
  let dialogs=0;
  p.on('dialog',async dialog=>{
   dialogs++;
   if(dialog.type()==='prompt')await dialog.accept(userA);else await dialog.accept();
  });
  await p.locator('#delete-account').click();
  await p.locator('#guest').waitFor({state:'visible',timeout:17000});
  if(dialogs<2)throw Error('A_DELETE_CONFIRMATIONS_MISSING');
  info('USER_A_FULL_ACCOUNT_DELETE');
  await pb.locator('[data-go="permissions"]').first().click();
  pb.on('dialog',async dialog=>{if(dialog.type()==='prompt')await dialog.accept(userB);else await dialog.accept()});
  await pb.locator('#delete-account').click();
  await pb.locator('#guest').waitFor({state:'visible',timeout:14000});
  info('USER_B_FULL_ACCOUNT_DELETE');
  if(errors.length)throw Error('FRONTEND_PAGE_ERRORS '+errors.join(' | '));
  // Additional desktop render under HTTPS, not mock.
  const desktop=await browser.newContext({viewport:{width:1440,height:900}});
  const pg=await desktop.newPage();response=await pg.goto(BASE,{waitUntil:'domcontentloaded',timeout:18000});
  if(response.status()!==200)throw Error('DESKTOP_BAD_HTTP');
  if(await pg.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth))
   throw Error('DESKTOP_OVERFLOW');
  await pg.screenshot({path:'/out/r7-public-desktop-guest.png',fullPage:false});
  info('REAL_PUBLIC_DESKTOP_RENDER',{width:1440});
  await desktop.close();
  fs.writeFileSync('/out/live-e2e-result.json',JSON.stringify({status:'PASS',tests:checks,source:'ACTUAL_CANONICAL_PUBLIC_HTTPS',mocked:false,ai_called:false,users_deleted:true},null,2));
  console.log(JSON.stringify({status:'PASS',tested:checks.length,tests:checks.map(x=>x.message),users_deleted:true}));
 }catch(e){
  const error={status:'HOLD',error:String(e.stack||e).slice(0,1500),tests:checks,users_may_remain:!!userA||!!userB};
  fs.writeFileSync('/out/live-e2e-result.json',JSON.stringify(error,null,2));
  console.log(JSON.stringify(error));
  process.exitCode=1;
 }finally{if(a)await a.close();if(b)await b.close();if(browser)await browser.close()}
})();