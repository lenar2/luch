const {chromium}=require('playwright-core'),fs=require('fs'); const info=[];
(async()=>{
 let b;
 try{
  b=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const lang of ['en','ru']){
   const page=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
   let errors=[];page.on('pageerror',e=>errors.push(e.message));
   const response=await page.goto('https://luch.lenarsalimov.ru/home/'+(lang==='ru'?'?lang=ru':''),{waitUntil:'domcontentloaded',timeout:20000});
   await page.locator('#register-form').waitFor({state:'visible',timeout:18000});
   const q=await page.evaluate(()=>({
    language:document.documentElement.lang,
    scrollWidth:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,
    title:document.querySelector('#guest h1')?.textContent?.trim(),
    logo:(()=>{let x=document.querySelector('.hero-wordmark img');return x.complete&&x.naturalWidth>0})(),
    navigation:document.querySelectorAll('.side-nav [data-go]').length,
    aiNotConnected:document.querySelector('[data-page="assistants"]').textContent.includes('SO 6.2'),
    ownerChatExposed:!!document.querySelector('a[href*="chatgpt.com/c/"]')
   }));
   await page.screenshot({path:'/out/r7-public-desktop-'+lang+'-final.png',fullPage:false});
   info.push({lang,http:response.status(),...q,errors});
   await page.close();
  }
 }catch(e){info.push({error:String(e.stack||e).slice(0,1000)});process.exitCode=1}
 finally{if(b)await b.close();fs.writeFileSync('/out/desktop-final.json',JSON.stringify(info,null,2));console.log(JSON.stringify(info))}
})();