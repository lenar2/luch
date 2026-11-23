const fs=require('fs'),{webkit,chromium}=require('playwright-core');
const out=[];
const SITE='https://luch.lenarsalimov.ru';
const STAGE='http://luch-home-r72-stage:8080';
(async()=>{let browser;try{
 browser=await webkit.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await context.route('https://luch.lenarsalimov.ru/home/**',async route=>{
   let u=new URL(route.request().url()),path=u.pathname.replace(/^\/home/,'')||'/';
   let headers={...route.request().headers(),host:'luch-home-r72-stage'};
   if(route.request().method()==='POST'){headers.origin=SITE;headers['sec-fetch-site']='same-origin'}
   try{
    let response=await route.fetch({url:STAGE+path+u.search,headers,maxRedirects:0});
    await route.fulfill({response});
   }catch(e){console.log('ROUTE_ERROR',String(e));await route.abort()}
 });
 const page=await context.newPage();let errors=[];page.on('pageerror',e=>errors.push(e.message));
 let r=await page.goto(SITE+'/home/?lang=ru',{waitUntil:'domcontentloaded',timeout:20000});
 await page.locator('#register-form').waitFor({state:'visible',timeout:12000});
 out.push({step:'STAGE_PROXY_GUEST',http:r.status(),lang:await page.evaluate(()=>document.documentElement.lang),title:await page.locator('h1').first().innerText(),errors});
}catch(e){out.push({fatal:String(e.stack||e).slice(0,1200)})}finally{if(browser)await browser.close();fs.writeFileSync('/out/r72-stage-canary.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out))}})();
