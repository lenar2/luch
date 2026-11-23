const fs=require('fs'),path=require('path'),http=require('http'),{chromium,webkit}=require('playwright-core');
const ROOT='/work/home/frontend',OUT='/out',results=[];
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const srv=http.createServer((req,res)=>{try{
 let u=new URL(req.url,'http://localhost'),p=u.pathname.startsWith('/home/')?u.pathname.slice(6):u.pathname.slice(1);
 if(!p)p='index.html';
 const file=path.resolve(ROOT,p);
 if(!file.startsWith(ROOT+'/')){res.writeHead(403);return res.end()}
 const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain'});res.end(data)
}catch(e){res.writeHead(404);res.end('404')}}).listen(18971,'127.0.0.1');
(async()=>{for(const engine of ['webkit','chromium']){
 let browser;
 try{
 browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 for(const lang of ['en','ru'])for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:width===1440?900:844},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let authenticated=false;
  await page.route('**/home/api/**',route=>{
   const u=new URL(route.request().url());
   const json=u.pathname.endsWith('state')?
    (authenticated?{ok:true,authenticated:true,username:'alice',csrf:'fixture',grant:null,checks:[],events:[]}:{ok:true,authenticated:false}):
    u.pathname.endsWith('register')?(authenticated=true,{ok:true,authenticated:true,username:'alice',recovery_code:'VISUAL-FIXTURE-SECRET-NEVER-USE-PROD'}):
    {ok:true};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(json)});
  });
  const res=await page.goto('http://127.0.0.1:18971/home/'+(lang==='ru'?'?lang=ru':''),{waitUntil:'domcontentloaded',timeout:16000});
  await page.locator('#register-form').waitFor({state:'visible'});
  await page.waitForTimeout(40);
  const start=await page.evaluate(()=>{
   let b=document.querySelector('.hero-cta .button').getBoundingClientRect();
   return {heading:document.querySelector('#guest h1').textContent.trim().replace(/\s+/g,' '),
    heroCTA:{top:b.top,bottom:b.bottom},viewport:{w:innerWidth,h:innerHeight},
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
  });
  let translated=lang==='ru'?false:true;
  if(lang==='ru'){
    await page.locator('[data-language]:visible').first().click();
    translated=(await page.locator('#guest h1').innerText()).includes('Your task.');
  }
  if(lang==='en'){
    await page.locator('[data-language]:visible').first().click();
    translated=(await page.locator('#guest h1').innerText()).includes('Ваша задача');
  }
  await page.locator('[data-language]:visible').first().click();
  if(width===390){
    await page.screenshot({path:OUT+'/r72-'+engine+'-'+lang+'-guest.png',fullPage:false});
  }
  results.push({engine,lang,width,http:res.status(),...start,toggleCorrect:translated,errors});
  if(engine==='webkit'&&lang==='en'&&width===390){
   await page.fill('#register-username','alice');
   await page.fill('#register-password','ValidStrongPasswordRandom1234');
   await page.check('#terms-agreement');
   await page.locator('#register-form button[type="submit"]').click();
   await page.locator('#recovery-dialog').waitFor({state:'visible',timeout:10000});
   const r=await page.locator('#recovery-code-display').textContent();
   if(!r.startsWith('VISUAL-FIXTURE-SECRET'))throw Error('RECOVERY_DIALOG_BAD');
   if(await page.locator('#close-recovery').isEnabled())throw Error('RECOVERY_ACK_NOT_ENFORCED');
   await page.check('#recovery-saved');
   await page.locator('#close-recovery').click();
   await page.locator('#workspace').waitFor({state:'visible'});
   results.push({scenario:'RECOVERY_FIRST_LOGIN_DIALOG','pass':true});
  }
  await page.close();
 }
 }catch(e){results.push({engine,fatal:String(e.stack||e).slice(0,1400)})}
 finally{if(browser)await browser.close()}
}
srv.close();fs.writeFileSync(OUT+'/r72-visual.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results))})();
