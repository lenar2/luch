const {webkit}=require('playwright-core'),crypto=require('crypto'),fs=require('fs');
const BASE='https://luch.lenarsalimov.ru/home/',records=[];let browser,context,page,user,deleted=false;
(async()=>{try{
browser=await webkit.launch({headless:true});
context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3,
 userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'});
page=await context.newPage();let errors=[];page.on('pageerror',e=>errors.push(e.message));
let r=await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:25000});
if(r.status()!==200)throw Error('WEBKIT_PUBLIC_STATUS_'+r.status());
records.push({step:'OPEN_PUBLIC_SAFARI_ENGINE',http:r.status()});
user='wkt'+crypto.randomBytes(5).toString('hex');
await page.fill('#register-username',user);
await page.fill('#register-password','Webkit-Test-Only-'+crypto.randomBytes(20).toString('hex'));
await page.check('#terms-agreement');
await page.locator('#register-form button[type=submit]').click();
await page.locator('#recovery-dialog').waitFor({state:'visible',timeout:17000});
const recoveryCode=(await page.locator('#recovery-code-display').textContent()).trim();
if(recoveryCode.length<40)throw Error('RECOVERY_CODE_MISSING_IN_PUBLIC');
if(await page.locator('#close-recovery').isEnabled())throw Error('RECOVERY_CODE_ACK_NOT_REQUIRED');
await page.check('#recovery-saved');
await page.locator('#close-recovery').click();
await page.locator('#workspace').waitFor({state:'visible',timeout:21000});
records.push({step:'R72_PUBLIC_SIGNUP_CONSENT_AND_CODE'});
await page.locator('[data-go="check"]').first().click();
await page.fill('#website-url','https://example.com');
await page.check('#consent-box');
await page.locator('#grant-form button[type=submit]').click();
await page.locator('#granted').waitFor({state:'visible',timeout:15000});
records.push({step:'WEBKIT_SCOPED_CONSENT'});
await page.locator('#run-check').click();
await page.locator('#site-result').waitFor({state:'visible',timeout:28000});
let http=(await page.locator('#result-http').textContent()).trim();
let title=(await page.locator('#result-title').textContent()).trim();
if(http!=='200'||title!=='Example Domain')throw Error('BAD_REAL_RESULT_'+http+'_'+title);
records.push({step:'WEBKIT_REAL_HTTPS_RESULT',http:200,title});
await page.screenshot({path:'/out/r72-public-webkit-iphone-full-result.png',fullPage:false});
await page.locator('[data-go="permissions"]').first().click();
page.once('dialog',dlg=>dlg.accept());
await page.locator('#revoke-grant').click();
await page.locator('#revoke-grant').waitFor({state:'hidden',timeout:15000});
const deny=await page.evaluate(async()=>{
 const s=await (await fetch('/home/api/state',{credentials:'same-origin'})).json();
 const r=await fetch('/home/api/check',{method:'POST',credentials:'same-origin',
  headers:{'Content-Type':'application/json','X-LUCH-CSRF':s.csrf},body:'{}'});
 return r.status;
});
if(deny!==403)throw Error('WEBKIT_REVOKE_FAILED_'+deny);
records.push({step:'WEBKIT_REVOKE_DENIED',http:403});
await page.locator('[data-language]').first().click();
const lang=await page.evaluate(()=>document.documentElement.lang);
if(lang!=='ru')throw Error('WEBKIT_RUSSIAN_SWITCH_FAILED');
records.push({step:'WEBKIT_RU_SWITCH'});
await page.screenshot({path:'/out/r72-public-webkit-iphone-russian-workspace.png',fullPage:false});
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
if(overflow>0)throw Error('WEBKIT_IPHONE_OVERFLOW_'+overflow);
page.on('dialog',async d=>{if(d.type()==='prompt')await d.accept(user);else await d.accept()});
await page.locator('#delete-account').click();
await page.locator('#guest').waitFor({state:'visible',timeout:17000});
deleted=true;records.push({step:'WEBKIT_ACCOUNT_AND_RECORDS_DELETED'});
if(errors.length)throw Error('WEBKIT_JS_ERRORS_'+errors.join('|'));
fs.writeFileSync('/out/r72-public-webkit-e2e.json',JSON.stringify({status:'PASS',tests:records,real_https:true,
 real_model_calls:false,physical_iphone:false,users_deleted:true},null,2));
console.log(JSON.stringify({status:'PASS',steps:records.map(x=>x.step),deleted}));
}catch(e){
let cleanup=false;
if(page&&user&&!deleted){try{
 const x=await page.evaluate(async(name)=>{
  const s=await (await fetch('/home/api/state',{credentials:'same-origin'})).json();
  if(!s.authenticated)return true;
  const r=await fetch('/home/api/delete-account',{method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json','X-LUCH-CSRF':s.csrf},body:JSON.stringify({username:name})});
  return r.ok;
 },user);cleanup=Boolean(x)
}catch(_){}} else cleanup=deleted;
const result={status:'HOLD',error:String(e.stack||e).slice(0,1100),steps:records.map(x=>x.step),cleanup};
fs.writeFileSync('/out/r72-public-webkit-e2e.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=1;
}finally{if(context)await context.close();if(browser)await browser.close()}
})();