'use strict';
const fs=require('node:fs');
const path=require('node:path');
const child=require('node:child_process');
const puppeteer=require(process.env.LUCH_TEST_PUPPETEER_CORE||'puppeteer-core');
const root=path.resolve(__dirname,'..'),asset=path.join(root,'extension','assets');
const svg=path.join(asset,'luch-brand-r22.svg'),mark=path.join(asset,'luch-ray-mark.svg');
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.LUCH_TEST_BROWSER_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-first-run'],timeout:30000});
 try{
  const page=await browser.newPage();
  await page.setViewport({width:512,height:512,deviceScaleFactor:1});
  await page.goto('file://'+svg,{waitUntil:'load'});
  const dims=await page.evaluate(()=>({width:document.documentElement.clientWidth,height:document.documentElement.clientHeight}));
  console.log('SOURCE_RENDER',JSON.stringify(dims));
  const master=path.join(asset,'luch-master-r22-512.png');
  await page.screenshot({path:master,fullPage:false,omitBackground:false});
  for(const size of [16,32,48,128]){
   if(size===16){const small=fs.readFileSync(mark,'utf8').replace('width="128" height="128"','width="512" height="512"');await page.setContent('<html><head><style>body{margin:0}</style></head><body>'+small+'</body></html>');await page.screenshot({path:master,fullPage:false,omitBackground:false})}
   if(size===48){await page.goto('file://'+svg,{waitUntil:'load'});await page.screenshot({path:master,fullPage:false,omitBackground:false})}
   const file=path.join(asset,'icon-'+size+'.png');
   fs.copyFileSync(master,file);
   child.execFileSync('/usr/bin/sips',['--resampleHeightWidth',String(size),String(size),file],{stdio:'ignore'});
   console.log('ICON_FROM_OFFICIAL_SOURCE',size,fs.statSync(file).size);
  }
  fs.unlinkSync(master);
 }finally{await browser.close()}
})().catch(err=>{console.error(err.stack);process.exitCode=1});