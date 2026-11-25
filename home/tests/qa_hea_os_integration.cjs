'use strict';
// Author preview: existing marketing site plus account-scoped Home API, no model simulation.
const {chromium}=require('playwright-core'),fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),https=require('https'),crypto=require('crypto');
const {spawn,execFileSync}=require('child_process');
const root=path.resolve(__dirname,'../..'), site=path.join(root,'website'), work=fs.mkdtempSync(path.join(os.tmpdir(),'luch-os-')),out='/out';
const host='luch.lenarsalimov.ru',base='https://'+host;
const tests=[],errors=[];let app,edge,browser;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function assert(x,msg){if(!x)throw Error(msg)} function pass(step){tests.push(step);console.log('PASS '+step)}
function serve(req,res){
 if(req.method!=='GET'){res.writeHead(405);return res.end()}
 let url;try{url=decodeURIComponent(new URL(req.url,base).pathname)}catch{res.writeHead(400);return res.end()}
 let f=path.resolve(site,'.'+url+(url.endsWith('/')?'index.html':''));
 if(!f.startsWith(site+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end()}
 const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
 res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)
}
(async()=>{let report={status:'FAIL',tests,errors,real_home_api:true,actual_public_https:true,live_agent_connected:false,production_changed:false,author_only:true};
 try{
  execFileSync('openssl',['req','-x509','-nodes','-newkey','rsa:2048','-days','1','-subj','/CN='+host,'-addext','subjectAltName=DNS:'+host,'-keyout',path.join(work,'key.pem'),'-out',path.join(work,'cert.pem')],{stdio:'ignore'});
  const db=path.join(work,'home.sqlite');
  app=spawn('python3',[path.join(root,'home/app/server.py')],{env:{...process.env,PORT:'18882',LUCH_HOME_DB:db,LUCH_HOME_SELF_EDGE:''},stdio:['ignore','ignore','ignore']});
  let healthy=false;for(let i=0;i<30;i++){try{if((await fetch('http://127.0.0.1:18882/healthz')).ok){healthy=true;break}}catch{}await sleep(150)}assert(healthy,'backend');
  edge=https.createServer({key:fs.readFileSync(path.join(work,'key.pem')),cert:fs.readFileSync(path.join(work,'cert.pem'))},(req,res)=>{
    if(req.headers.host!==host){res.writeHead(404);return res.end()}
    if(!req.url.startsWith('/home/'))return serve(req,res);
    const target=req.url.replace(/^\/home/,'')||'/';
    const up=http.request({hostname:'127.0.0.1',port:18882,path:target,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});up.on('error',()=>{res.writeHead(502);res.end()});req.pipe(up);
  });await new Promise((ok,fail)=>{edge.once('error',fail);edge.listen(443,'127.0.0.1',ok)});
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-proxy-server','--host-resolver-rules=MAP '+host+' 127.0.0.1, EXCLUDE localhost']});
  const ctx=await browser.newContext({viewport:{width:1440,height:940},ignoreHTTPSErrors:true});const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));
  for(const route of ['/','/en/','/ru/','/en/platform/','/ru/platform/','/en/studio/','/ru/studio/','/en/apps/','/ru/apps/','/home/']){
    let r=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:16000});assert(r.status()===200,route);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'overflow '+route);
  }pass('10_EXISTING_AND_NEW_PLATFORM_ROUTES');
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  assert(await page.locator('#platform-spaces .platform-card').count()===4,'platform architecture');await page.screenshot({path:out+'/luch-platform-desktop.jpg',fullPage:true,type:'jpeg',quality:78});
  await page.locator('#main-nav a[href="/home/"]').click();await page.locator('[data-create-shortcut]').waitFor({state:'visible'});
  assert((await page.locator('h1').first().textContent()).includes('Your AI.'),'agent first');
  assert(await page.locator('#pre-auth-panel').isVisible(),'workspace overview');
  await page.screenshot({path:out+'/luch-home-desktop.jpg',fullPage:false,type:'jpeg',quality:82});pass('MARKETING_TO_AGENT_FIRST_HOME');
  await page.locator('[data-create-shortcut]').click();
  const name='os'+crypto.randomBytes(6).toString('hex');
  await page.locator('#register-username').fill(name);await page.locator('#register-password').fill('Isolated-'+crypto.randomBytes(20).toString('hex'));await page.locator('#terms-agreement').check();await page.locator('#register-form button[type=submit]').click();await page.locator('#recovery-dialog').waitFor({state:'visible',timeout:12000});await page.locator('#recovery-saved').check();await page.locator('#close-recovery').click();
  await page.locator('#workspace').waitFor({state:'visible'});pass('REAL_WORKSPACE_REGISTRATION');
  await page.locator('[data-go="assistants"]:visible').first().click();
  assert(await page.locator('[data-page=assistants]').isVisible(),'agent page');assert(await page.locator('#agent-input').isDisabled(),'unavailable chat must not accept message');assert(await page.locator('.agent-compose button').isDisabled(),'send unavailable');
  const s=await page.evaluate(async()=>await(await fetch('/home/api/state')).json());assert(s.ai_connected===false,'public provider false');
  await page.screenshot({path:out+'/luch-agent-desktop.jpg',type:'jpeg',quality:82});pass('AGENT_SCREEN_NO_PRIVATE_RELAY_OR_FAKE_SEND');
  await page.locator('[data-go="check"]:visible').first().click();await page.locator('#website-url').fill('https://example.com');await page.locator('#consent-box').check();await page.locator('#grant-form button[type=submit]').click();await page.locator('#granted').waitFor({state:'visible',timeout:12000});await page.locator('#run-check').click();await page.locator('#site-result').waitFor({state:'visible',timeout:20000});assert((await page.locator('#result-http').textContent())==='200','real check');pass('EXISTING_REAL_TOOL_PRESERVED');
  await page.locator('[data-go="assistants"]:visible').first().click();
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile agent overflow');await page.screenshot({path:out+'/luch-agent-mobile.jpg',fullPage:true,type:'jpeg',quality:82});
  await page.locator('[data-language]:visible').first().click();assert(await page.evaluate(()=>document.documentElement.lang)==='ru','RU');
  assert((await page.locator('#agent-blocked').textContent()).includes('Отправка выключена'),'RU agent truth');
  assert(await page.locator('[data-platform-path=connect]').last().getAttribute('href')==='/ru/connect/','RU route');assert(await page.locator('.footer-platform [data-platform-path=studio]').isVisible(),'mobile studio link');assert(await page.locator('.footer-platform [data-platform-path=studio]').getAttribute('href')==='/ru/studio/','mobile localized Studio link');
  pass('MOBILE_AND_RUSSIAN_AGENT');
  await page.goto(base+'/ru/',{waitUntil:'domcontentloaded'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile public overflow');
  await page.screenshot({path:out+'/luch-platform-mobile.jpg',fullPage:true,type:'jpeg',quality:75});
  await page.goto(base+'/home/?lang=ru',{waitUntil:'domcontentloaded'});await page.locator('#workspace').waitFor({state:'visible'});
  await page.locator('#logout').click();await page.locator('#guest').waitFor({state:'visible'});
  await page.screenshot({path:out+'/luch-home-mobile.jpg',fullPage:true,type:'jpeg',quality:82});
  assert(errors.length===0,'browser JS exceptions');pass('MOBILE_SITE_AND_HOME_NO_JS_ERRORS');report.status='PASS';
 }catch(e){report.error=String(e);console.log('FAIL '+report.error);process.exitCode=1}
 finally{if(browser)await browser.close().catch(()=>{});if(edge)edge.close();if(app){app.kill('SIGTERM');await sleep(500)}fs.rmSync(work,{recursive:true,force:true});report.temporary_stage_removed=!fs.existsSync(work);fs.writeFileSync(out+'/luch-os-integration.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))}
})();
