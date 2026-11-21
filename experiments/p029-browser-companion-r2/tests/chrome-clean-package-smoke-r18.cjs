const {chromium}=require('playwright-core');
(async()=>{
 const ctx=await chromium.launchPersistentContext('/tmp/p029-r18-chrome',{
  headless:true,executablePath:chromium.executablePath(),
  args:['--no-sandbox','--disable-extensions-except=/extension','--load-extension=/extension'],
  viewport:{width:480,height:780}
 });
 try{
  const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker',{timeout:22000});
  if(!worker.url().endsWith('/background.js')) throw Error('NOT_COMPANION_SERVICE_WORKER');
  const extId=worker.url().split('/')[2];
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('chrome-extension://'+extId+'/popup.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(850);
  const ui=await page.evaluate(()=>({
   name:document.querySelector('#eyebrow')?.textContent||document.title,
   headline:document.querySelector('#headline')?.textContent,
   status:document.querySelector('#status')?.textContent,
   setup:document.querySelector('#local-setup')?.href,
   readButton:document.querySelector('#grant')?.textContent,
   lang:document.documentElement.lang,
   pairUI:!document.querySelector('#pairing')?.hidden
  }));
  await page.screenshot({path:'/captures/chrome-popup-unpaired-real.png',fullPage:true});
  if(!/Browser not paired|Браузер не подключён/.test(ui.status||''))throw Error('POPUP_STATUS_WRONG');
  if(!ui.pairUI) throw Error('PAIRING_FORM_NOT_VISIBLE');
  if(errors.length)throw Error('POPUP_JS_ERRORS_'+JSON.stringify(errors));
  const fixture=await ctx.newPage();await fixture.setViewportSize({width:900,height:600});await fixture.goto('https://example.com',{waitUntil:'domcontentloaded',timeout:12000});
  const title=await fixture.title();
  if(title!=='Example Domain')throw Error('EXAMPLE_ORIGIN_NOT_LOADED');
  await fixture.screenshot({path:'/captures/chrome-example-real.png',fullPage:false});
  console.log('CHROME_EXACT_ZIP_SMOKE_PASS',JSON.stringify({ui,title,errors,extIdRedacted:true}));
 }finally{await ctx.close()}
})().catch(e=>{console.error('CHROME_EXACT_ZIP_SMOKE_FAIL',String(e));process.exitCode=1});
