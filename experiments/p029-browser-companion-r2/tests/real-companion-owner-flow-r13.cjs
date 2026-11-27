'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const fsp=fs.promises;
const puppeteer=require(process.env.LUCH_TEST_PUPPETEER_CORE||'puppeteer-core');
const ROOT=path.resolve(__dirname,'..');
const report={scenario:'R13 one-click enable/pause after host/debugger/download permissions already approved at installation',start:new Date().toISOString()};
let browser;
const server=http.createServer((req,res)=>{
 if(req.url.startsWith('/luch/browser/')){
  res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,paired:true,jobs:[]}));return;
 }
 res.setHeader('content-type','text/html');res.end('<!doctype html><html lang="en"><title>One-click QA</title><body><h1>Permission test</h1><input id="field" /></body></html>');
});
(async()=>{
 const tmp=await fsp.mkdtemp(path.join(os.tmpdir(),'luch-owner-flow-'));
 try{
  await new Promise(resolve=>server.listen(19499,'127.0.0.1',resolve));
  const ext=path.join(tmp,'ext');
  await fsp.cp(path.join(ROOT,'extension'),ext,{recursive:true});
  const manifestPath=path.join(ext,'manifest.json'),bgPath=path.join(ext,'background.js');
  const manifest=JSON.parse(await fsp.readFile(manifestPath,'utf8'));
  manifest.permissions=[...new Set([...manifest.permissions,'tabs','debugger','downloads'])];
  manifest.host_permissions=['http://127.0.0.1/*','http://*/*','https://*/*'];
  // Isolated test ONLY: simulate Chrome permissions granted at extension install.
  await fsp.writeFile(manifestPath,JSON.stringify(manifest,null,2));
  let bg=await fsp.readFile(bgPath,'utf8');
  bg=bg.replace("const BASE='https://api.lenarsalimov.ru/luch/browser'","const BASE='http://127.0.0.1:19499/luch/browser'");
  await fsp.writeFile(bgPath,bg);
  browser=await puppeteer.launch({executablePath:process.env.LUCH_TEST_BROWSER_BIN||'/Applications/Opera.app/Contents/MacOS/Opera',headless:true,userDataDir:path.join(tmp,'profile'),ignoreDefaultArgs:['--disable-extensions'],args:['--disable-extensions-except='+ext,'--load-extension='+ext,'--no-first-run','--no-default-browser-check','--no-sandbox'],timeout:30000});
  const target=await browser.waitForTarget(t=>t.type()==='service_worker'&&t.url().endsWith('background.js'),{timeout:20000});
  const worker=await target.worker();
  report.workerLoaded=true;report.extVersion=await worker.evaluate(()=>chrome.runtime.getManifest().version);
  const tab=await browser.newPage();await tab.goto('http://127.0.0.1:19499/page');
  await worker.evaluate(()=>chrome.storage.local.set({auth:{token:'LOCAL_OWNER_FLOW_TEST'}}));
  const popup=await browser.newPage();await popup.goto('chrome-extension://'+target.url().split('/')[2]+'/popup.html');
  await popup.waitForSelector('#interact');
  await popup.waitForFunction(()=>!document.querySelector('#interact').hidden,{timeout:10000});
  report.before=await worker.evaluate(async()=>({permissions:await chrome.permissions.getAll(),fullMode:(await chrome.storage.local.get('fullMode')).fullMode||false}));
  await popup.click('#interact');
  await new Promise(resolve=>setTimeout(resolve,2500));
  report.feedback=await popup.$eval('#feedback',el=>el.textContent);
  report.after=await worker.evaluate(async()=>({permissions:await chrome.permissions.getAll(),fullMode:(await chrome.storage.local.get('fullMode')).fullMode||false,grantCount:Object.keys((await chrome.storage.session.get('grants')).grants||{}).length}));
  if(report.after.fullMode){
   const tabs=await worker.evaluate(()=>chrome.tabs.query({}));
   const id=tabs.find(x=>x.url==='http://127.0.0.1:19499/page').id;
   const grant=await worker.evaluate(id=>(chrome.storage.session.get('grants')).then(x=>x.grants?.[id]),id);
   report.execution=await worker.evaluate(async targetId=>performJob({op:'get_document_info',targetId,args:{}}),'ext:'+id+':'+grant.grantId);
   await popup.click('#revoke');
   await new Promise(resolve=>setTimeout(resolve,500));
   report.pause=await worker.evaluate(async()=>({fullMode:(await chrome.storage.local.get('fullMode')).fullMode||false,grantCount:Object.keys((await chrome.storage.session.get('grants')).grants||{}).length}));
  }
  console.log('PERMISSION_FLOW',JSON.stringify(report).slice(0,3500));
 }catch(e){report.error=String(e.stack||e);console.log('FLOW_FAIL',report.error.slice(0,1000))}
 finally{
  if(browser)await browser.close().catch(()=>{});
  await fsp.rm(tmp,{recursive:true,force:true}).catch(()=>{});
  await new Promise(resolve=>server.close(resolve));
  report.end=new Date().toISOString();
  await fsp.writeFile(ROOT+'/QA_R13_PREAPPROVED_PERMISSION_FLOW_20261127.json',JSON.stringify(report,null,2)+'\n');
 }
})().catch(e=>{console.error(e);process.exitCode=1});