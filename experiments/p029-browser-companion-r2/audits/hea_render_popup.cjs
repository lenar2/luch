'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const puppeteer=require(process.env.LUCH_TEST_PUPPETEER_CORE||'puppeteer-core');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'audits','screens');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{
  const name=decodeURIComponent((req.url||'/popup.html').split('?')[0]).replace(/^\//,'');
  if(name.includes('..')){res.writeHead(400);res.end();return;}
  const file=path.join(root,'extension',name);
  let body;try{body=fs.readFileSync(file)}catch{res.writeHead(404);res.end();return}
  res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.js')?'application/javascript':name.endsWith('.svg')?'image/svg+xml':'text/html');
  res.end(body);
 });
 await new Promise(resolve=>server.listen(19496,'127.0.0.1',resolve));
 const browser=await puppeteer.launch({executablePath:process.env.LUCH_TEST_BROWSER_BIN||'/Applications/Opera.app/Contents/MacOS/Opera',headless:true,args:['--no-sandbox','--disable-extensions'],timeout:30000});
 const locale=process.env.LUCH_HEA_LOCALE==='en'?'en':'ru';
 const modes={
  pairing:{connected:false,online:false,fullMode:false,tab:null,granted:false,scope:null},
  permission:{connected:true,online:true,fullMode:false,tab:{title:'ChatGPT — моя работа',url:'https://chatgpt.com/'},granted:false,scope:null},
  ready:{connected:true,online:true,fullMode:true,tab:{title:'ChatGPT — моя работа',url:'https://chatgpt.com/'},granted:true,scope:'interact'},
  offline:{connected:true,online:false,fullMode:true,tab:{title:'ChatGPT — моя работа',url:'https://chatgpt.com/'},granted:true,scope:'interact'}
 };
 try{
  for(const [name,state] of Object.entries(modes)){
   const page=await browser.newPage();
   await page.setViewport({width:Number(process.env.LUCH_HEA_WIDTH||410),height:615,deviceScaleFactor:1});
   await page.evaluateOnNewDocument(({state,locale})=>{
    window.localStorage.setItem('luch_locale',locale);
    const storage={state};
    Object.defineProperty(window,'chrome',{value:{
     runtime:{sendMessage:async msg=>msg.op==='status'?{ok:true,...storage.state}:({ok:true,message:'LOCAL_HEA_FIXTURE'})},
     permissions:{request:async()=>false}
    },configurable:true});
   },{state,locale});
   const p='http://127.0.0.1:19496/popup.html';
   await page.goto(p,{waitUntil:'load'});
   await page.waitForFunction(expected=>document.querySelector('#status')?.textContent&&document.documentElement.lang===expected,{timeout:5000},locale);
   await page.evaluate(()=>document.fonts.ready);
   const issues=await page.evaluate(()=>{
    let x=document.querySelector('main').getBoundingClientRect();
    let main=document.querySelector('main');
    const visible=(id)=>{const n=document.getElementById(id)||document.querySelector('.'+id);let r=n.getBoundingClientRect();return {shown:!n.hidden&&getComputedStyle(n).display!=='none',top:Math.round(r.top),bottom:Math.round(r.bottom),height:Math.round(r.height)}};
    return {mainBottom:x.bottom,scrollHeight:main.scrollHeight,viewport:innerHeight,
     headline:document.querySelector('#headline').textContent,
     primary:visible(document.querySelector('#pairing').hidden?'interact':'pair'),
     permission:visible('permission-explainer'),ready:visible('ready-card'),
     offline:visible('offline-card'),image:visible('hero-illustration')};
   });
   if((name==='pairing'||name==='permission')&&(issues.primary.bottom>615||!issues.primary.shown))throw new Error('HEA_PRIMARY_CTA_BELOW_FOLD:'+name+':'+JSON.stringify(issues.primary));
   const screenshot=path.join(output,'R14_'+name+'_'+locale.toUpperCase()+(process.env.LUCH_HEA_WIDTH==='360'?'_NARROW':'')+'.png');
   await page.screenshot({path:screenshot,fullPage:true});
   console.log(name,JSON.stringify(issues),screenshot);
   await page.close();
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(err=>{console.error(err.stack);process.exitCode=1});