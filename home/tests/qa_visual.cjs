const fs=require('fs'),path=require('path'),http=require('http'),{chromium}=require('playwright-core');
const ROOT='/work/frontend', OUT='/out',reports=[];
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{try{
 let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(pathname.startsWith('/home/'))pathname=pathname.slice('/home/'.length);
 const f=path.resolve(ROOT,pathname||'index.html');
 if(!f.startsWith(ROOT+'/')){res.writeHead(403);return res.end()}
 const b=fs.readFileSync(f);res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(b)
}catch(e){res.writeHead(404);res.end('not found')}}).listen(18778,'127.0.0.1');
const fixture={
 ok:true,authenticated:true,username:'iPhoneUser',csrf:'fixture-not-real',
 grant:{id:'g1',origin:'https://luch.lenarsalimov.ru',created:1795200000},
 checks:[{id:'c1',at:1795200020,origin:'https://luch.lenarsalimov.ru',result:{
 origin:'https://luch.lenarsalimov.ru',checked_at:1795200020,http_status:200,
 page_title:'LUCH — bring your AI into the work',mobile_viewport:true,elapsed_ms:135,
 sha256_prefix:'123456abcdef789012345678',observations:['Website responded successfully.']}}],
 events:[{event:'WEBSITE_CHECK',detail:'https://luch.lenarsalimov.ru · HTTP 200',at:1795200020}],
 ai_connected:false
};
(async()=>{
 let browser;
 try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const tests=[];
 for(const lang of ['en','ru']){
 for(const width of [320,390,768,1440]){
  for(const mode of ['guest','account']){
   if(mode==='guest'&&width===768)continue;
   let pg=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
   let errors=[],api=[],status=mode==='account'?fixture:{ok:true,authenticated:false,public_signup:true,ai_connected:false};
   pg.on('pageerror',e=>errors.push(e.message));
   await pg.route('**/home/api/**',route=>{
    api.push({path:route.request().url(),method:route.request().method()});
    let p=new URL(route.request().url()).pathname;
    let data=p.endsWith('/state')?status:{ok:true};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
   });
   const url='http://127.0.0.1:18778/home/'+(lang==='ru'?'?lang=ru':'');
   let response=await pg.goto(url,{waitUntil:'load',timeout:15000});
   await pg.waitForTimeout(160);
   let info=await pg.evaluate(()=>{
    let img=document.querySelector('.brand img');
    return {view:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
      locale:document.documentElement.lang,logo:img.complete&&img.naturalWidth>0,
      guestShown:!document.getElementById('guest').hidden,
      workspaceShown:!document.getElementById('workspace').hidden,
      signedIn:document.body.classList.contains('signed-in'),
      visibleTitle:document.querySelector('main h1:not([hidden])')?.textContent?.slice(0,120),
      aiNotConnected:document.querySelector('[data-page="assistants"]')?.textContent?.includes('SO 6.2'),
      languageControls:document.querySelectorAll('[data-language]').length,
      sidebarLinks:[...document.querySelectorAll('.nav-link')].filter(n=>getComputedStyle(n).display!=='none').length,
      founderLink:!!document.querySelector('a[href*="chatgpt.com/c/"]')};
   });
   if(width===390||width===1440){await pg.screenshot({path:OUT+'/'+lang+'-'+mode+'-'+width+'.png',fullPage:false})}
   if(mode==='account'&&width===390){
    for(let dest of ['check','permissions','activity','assistants']){
     if(dest==='assistants'){await pg.locator('[data-go="overview"]').first().click();await pg.locator('.summary-card[data-go="assistants"]').click()}else{await pg.locator('[data-go="'+dest+'"]').first().click()}
     await pg.waitForTimeout(55);
     const r=await pg.evaluate(()=>{
      let page=[...document.querySelectorAll('[data-page]')].find(n=>!n.hidden);
      return {name:page?.dataset.page,view:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth};
     });
     tests.push(r);
    }
   }
   reports.push({lang,width,mode,http:response.status(),...info,errors,api:api.map(x=>x.method)});
   await pg.close();
  }
 }
 }
 reports.push({navigation:tests});
 }catch(e){reports.push({fatal:String(e.stack||e).slice(0,1450)})}
 finally{if(browser)await browser.close();server.close();fs.writeFileSync(OUT+'/visual.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports))}
})();