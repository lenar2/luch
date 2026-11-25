'use strict';
// Isolated browser E2E against original Home server.py. No production requests,
// no mocked auth/consent/result. Local TLS ingress maps canonical host to loopback.
// The app itself performs real TLS-verified public HTTPS checks.
const {chromium}=require('playwright-core');
const {spawn,execFileSync}=require('child_process');
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),https=require('https'),crypto=require('crypto');
const OUT='/out', BASE='https://luch.lenarsalimov.ru/home/';
const work=fs.mkdtempSync(path.join(os.tmpdir(),'luch-r82-'));
const db=path.join(work,'test.sqlite'), records=[], apiLog=[], errors=[];
let app,edge,browser;
const assert=(condition,msg)=>{if(!condition)throw Error(msg)};
const pass=(step,extra={})=>{records.push({step,ok:true,...extra});console.log('PASS '+step)};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const state=page=>page.evaluate(async()=>await (await fetch('/home/api/state',{credentials:'same-origin'})).json());
const post=async(page,endpoint,body={})=>page.evaluate(async({endpoint,body})=>{
 const s=await(await fetch('/home/api/state')).json();
 const r=await fetch('/home/api/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-LUCH-CSRF':s.csrf||''},body:JSON.stringify(body)});
 return {status:r.status,body:await r.json()};
},{endpoint,body});
const username=()=> 'r82'+crypto.randomBytes(6).toString('hex');
const pw=()=> 'Stage-Only-'+crypto.randomBytes(24).toString('hex');
async function open(page,url=BASE){
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:16000});assert(response.status()===200,'guest http not 200');
 await page.locator('#guest-website-url').waitFor({state:'visible',timeout:10000});
}
async function choose(page,site){
 await page.locator('#guest-website-url').fill(site);
 await page.locator('#guest-website-intent button[type=submit]').click();
 await page.locator('#register-form').waitFor({state:'visible',timeout:7000});
}
async function signup(page,user,password){
 await page.locator('#register-username').fill(user);await page.locator('#register-password').fill(password);
 await page.locator('#terms-agreement').check();
 await page.locator('#register-form button[type=submit]').click();
 await page.locator('#recovery-dialog').waitFor({state:'visible',timeout:10000});
 assert((await page.locator('#recovery-code-display').textContent()).trim().length>=40,'missing genuine recovery code');
 assert(!(await page.locator('#close-recovery').isEnabled()),'recovery confirmation bypass');
 await page.locator('#recovery-saved').check();await page.locator('#close-recovery').click();
 await page.locator('#workspace').waitFor({state:'visible',timeout:10000});
}
async function grant(page,expected){
 assert(await page.locator('#website-url').inputValue()===expected,'wrong site in form');
 assert(!(await page.locator('#consent-box').isChecked()),'consent prechecked');
 await page.locator('#consent-box').check();
 await page.locator('#grant-form button[type=submit]').click();
 await page.locator('#granted').waitFor({state:'visible',timeout:12000});
 const s=await state(page);assert(s.grant?.origin===expected,'incorrect active origin');
}
async function check(page,site){
 await page.locator('#run-check').click();
 await page.locator('#site-result').waitFor({state:'visible',timeout:20000});
 const s=await state(page);
 const result=s.checks.find(c=>c.origin===site)?.result;
 assert(result?.http_status===200&&result.page_title==='Example Domain'&&result.origin===site&&/^[0-9a-f]{24}$/.test(result.sha256_prefix),'not real expected source result');
 assert(await page.locator('#result-origin').textContent()===site,'visible result from wrong source');
 return {origin:site,http_status:result.http_status,page_title:result.page_title,sha256_prefix:result.sha256_prefix,bytes_examined:result.bytes_examined,elapsed_ms:result.elapsed_ms};
}
(async()=>{
 const source_files=['frontend/index.html','frontend/app.js','frontend/app.css','app/server.py','tests/qa_hea_r82_real_stage.cjs'];
 const source_sha256=Object.fromEntries(source_files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('/src/'+f)).digest('hex')]));
 const report={source_sha256,schema:'luch.home.r82.real-stage-e2e.v1',status:'FAIL',tests:records,real_home_api:true,real_external_https:true,production_changed:false,physical_iphone:false,model_connected:false,author_only:true,stage_network:'isolated container with unmodified Home backend and local TLS reverse proxy; browser DNS maps canonical host to loopback'};
 try{
  execFileSync('openssl',['req','-x509','-nodes','-newkey','rsa:2048','-days','1','-subj','/CN=luch.lenarsalimov.ru','-addext','subjectAltName=DNS:luch.lenarsalimov.ru','-keyout',path.join(work,'key.pem'),'-out',path.join(work,'cert.pem')],{stdio:'ignore'});
  app=spawn('python3',['/src/app/server.py'],{env:{...process.env,PORT:'18882',LUCH_HOME_DB:db,LUCH_HOME_SELF_EDGE:''},stdio:['ignore','ignore','ignore']});
  let live=false;for(let i=0;i<30;i++){try{const r=await fetch('http://127.0.0.1:18882/healthz');if(r.ok){live=true;break}}catch{}await delay(200)}
  assert(live,'stage backend not healthy');
  edge=https.createServer({key:fs.readFileSync(path.join(work,'key.pem')),cert:fs.readFileSync(path.join(work,'cert.pem'))},(req,res)=>{
   if(!req.url.startsWith('/home/')||req.headers.host!=='luch.lenarsalimov.ru'){res.writeHead(404);res.end();return}
   const target=req.url.replace(/^\/home/,'')||'/';
   const upstream=http.request({hostname:'127.0.0.1',port:18882,path:target,method:req.method,headers:req.headers},r=>{
    if(target.startsWith('/api/'))apiLog.push({method:req.method,path:target.split('?')[0],status:r.statusCode});
    res.writeHead(r.statusCode,r.headers);r.pipe(res)
   });
   upstream.on('error',()=>{res.writeHead(502);res.end()});req.pipe(upstream);
  });
  await new Promise((ok,fail)=>{edge.once('error',fail);edge.listen(443,'127.0.0.1',ok)});
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-proxy-server','--host-resolver-rules=MAP luch.lenarsalimov.ru 127.0.0.1, EXCLUDE localhost']});
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,ignoreHTTPSErrors:true,isMobile:true,hasTouch:true});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await open(page);
  assert(!(await page.locator('#auth-card').isVisible()),'auth dominates first screen');
  assert(await page.locator('#pre-auth-panel').isVisible(),'illustrative result missing');
  await page.screenshot({path:OUT+'/r82-guest-mobile.png',fullPage:true});
  const a=username(), password=pw();
  await choose(page,'example.com');
  assert(await page.locator('#website-url').inputValue()==='https://example.com','bare domain not carried');
  assert(apiLog.filter(x=>x.method==='POST').length===0,'guest choice executed POST');
  pass('GUEST_TASK_BARE_DOMAIN_NO_NETWORK_ACTION');
  await signup(page,a,password);
  await page.locator('[data-page=check]').waitFor({state:'visible',timeout:7000});
  let s=await state(page);assert(s.authenticated&&s.grant===null&&s.checks.length===0,'signup granted or executed automatically');
  assert(await page.locator('#website-url').inputValue()==='https://example.com','task lost on actual signup');
  assert(!apiLog.some(x=>x.path==='/api/check'||x.path==='/api/consent'),'signup triggered check/consent');
  pass('REAL_REGISTRATION_RECOVERY_AND_TASK_CONTINUITY');
  let denied=await post(page,'check');assert(denied.status===403,'check before consent allowed');pass('PRE_CONSENT_REAL_API_DENY',{http:403});
  await grant(page,'https://example.com');assert((await state(page)).checks.length===0,'grant ran request');
  pass('EXPLICIT_SCOPED_CONSENT_NO_AUTO_CHECK');
  let result=await check(page,'https://example.com');pass('REAL_PUBLIC_TLS_RESULT',result);
  await page.screenshot({path:OUT+'/r82-real-result-mobile.png',fullPage:true});
  await page.locator('[data-go=activity]:visible').first().click();
  await page.locator('#activity-list').waitFor({state:'visible'});
  assert((await page.locator('#activity-list').textContent()).includes('https://example.com'),'history did not show result');
  pass('USER_VISIBLE_PERSISTED_HISTORY');
  await page.locator('#logout').click();await page.locator('#guest-website-url').waitFor({state:'visible'});
  assert(await page.locator('#pre-auth-panel').isVisible(),'guest preview missing after logout');
  assert((await page.locator('#result-origin').textContent())===''&&(await page.locator('#saved-results').textContent())==='','signed-out DOM retains prior results');
  pass('SIGNOUT_CLEARS_PRIVATE_RESULT_DOM');
  await choose(page,'https://example.org');
  await page.locator('#show-login').click();
  await page.locator('#login-username').fill(a);await page.locator('#login-password').fill(password);
  await page.locator('#login-form button[type=submit]').click();
  await page.locator('[data-page=check]').waitFor({state:'visible',timeout:10000});
  assert(await page.locator('#no-grant').isVisible()&&await page.locator('#replace-grant-note').isVisible(),'old grant hides new selected site');
  assert(await page.locator('#website-url').inputValue()==='https://example.org','new target lost');
  assert(!(await page.locator('#run-check').isVisible())&&!(await page.locator('#site-result').isVisible()),'old task or result shown as new');
  s=await state(page);assert(s.grant.origin==='https://example.com'&&s.checks.length===1,'login silently changed active scope or ran check');
  pass('RETURNING_USER_NEW_TASK_REQUIRES_REPLACEMENT_CONSENT');
  await page.screenshot({path:OUT+'/r82-replacement-consent.png',fullPage:true});
  await grant(page,'https://example.org');assert(!(await page.locator('#site-result').isVisible()),'stale result after changed grant');
  result=await check(page,'https://example.org');pass('SECOND_SITE_REAL_RESULT_AFTER_EXPLICIT_REPLACEMENT',result);
  await page.locator('[data-go=permissions]:visible').first().click();
  page.once('dialog',d=>d.accept());
  await page.locator('#revoke-grant').click();await page.locator('#revoke-grant').waitFor({state:'hidden',timeout:10000});
  denied=await post(page,'check');assert(denied.status===403,'run after revoke allowed');
  assert((await state(page)).grant===null,'revocation not persisted');pass('REVOKE_THEN_REAL_API_DENY',{http:403});
  await page.locator('[data-go=activity]:visible').first().click();
  assert(await page.locator('.saved-result').count()===2,'historical results missing after revoke');
  const postCount=apiLog.filter(x=>x.method==='POST'&&x.path==='/api/check').length;
  await page.locator('.saved-result').first().locator('summary').click();
  assert(await page.locator('.saved-result[open]').count()===1,'historical details not inspectable');
  assert((await page.locator('.saved-result[open] dl').textContent()).includes('Example Domain'),'historical title missing');
  assert(apiLog.filter(x=>x.method==='POST'&&x.path==='/api/check').length===postCount,'history triggered a new check');
  pass('HISTORICAL_RESULT_DETAILS_AVAILABLE_AFTER_REVOKE');
  await page.screenshot({path:OUT+'/r82-history-after-revoke.png',fullPage:true});
  const ctxB=await browser.newContext({viewport:{width:1440,height:900},ignoreHTTPSErrors:true});
  const bPage=await ctxB.newPage();bPage.on('pageerror',e=>errors.push(e.message));
  await open(bPage);await bPage.screenshot({path:OUT+'/r82-guest-desktop.png',fullPage:true});
  const b=username();await choose(bPage,'example.com');await signup(bPage,b,pw());
  s=await state(bPage);assert(s.username===b&&s.checks.length===0&&s.grant===null,'B sees A data');
  pass('TWO_REAL_ACCOUNTS_ISOLATED');
  const delB=await post(bPage,'delete-account',{username:b});assert(delB.status===200,'B cleanup failed');
  await ctxB.close();
  // Direct RU link and both directions; no screenshot of credentials/recovery code.
  await page.locator('[data-language]:visible').first().click();assert(await page.evaluate(()=>document.documentElement.lang)==='ru','RU switch failed');
  await page.locator('[data-language]:visible').first().click();assert(await page.evaluate(()=>document.documentElement.lang)==='en','EN switch failed');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile horizontal overflow');
  assert(errors.length===0,'browser JS exceptions');pass('BILINGUAL_AND_MOBILE_NO_JS_ERRORS');
  const delA=await post(page,'delete-account',{username:a});assert(delA.status===200,'A cleanup failed');
  await ctx.close();pass('TEST_ACCOUNTS_DELETED');
  const counts=JSON.parse(execFileSync('python3',['-c','import sqlite3,json,sys;c=sqlite3.connect(sys.argv[1]);print(json.dumps({t:c.execute("select count(*) from "+t).fetchone()[0] for t in ("users","sessions","grants","checks","activity")}))',db],{encoding:'utf8'}));
  assert(Object.values(counts).every(n=>n===0),'residual test DB entries');
  report.residual_db_rows=counts;pass('ZERO_RESIDUAL_TEST_RECORDS');
  report.status='PASS';
 }catch(e){report.error=String(e.message||e).slice(0,800);console.log('FAIL '+report.error);process.exitCode=1;}
 finally{
  report.api_request_summary=apiLog;report.js_errors=errors;
  fs.writeFileSync(OUT+'/r82-real-stage-e2e.json',JSON.stringify(report,null,2));
  if(browser)await browser.close().catch(()=>{});
  if(edge)edge.close();
  if(app){app.kill('SIGTERM');await delay(400);}
  fs.rmSync(work,{recursive:true,force:true});
  console.log(JSON.stringify({status:report.status,tests:records.length,error:report.error||null,residual:report.residual_db_rows||null}));
 }
})();
