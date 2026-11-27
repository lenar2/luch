'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const fsp=fs.promises;
const puppeteer=require(process.env.LUCH_TEST_PUPPETEER_CORE||'puppeteer-core');
const ROOT=path.resolve(__dirname,'..');
const START=Date.now(),report={browser:'Opera Chromium / isolated Mac profile',version:'0.8.2',base:'candidate-v0.8.2',tests:[],startedAt:new Date().toISOString(),isolation:'isolated temp profile + local HTTP fixture + fake local broker; extension loaded and actual Chrome API used; Chrome permission prompt not exercised'};
let currentOp='';
const server=http.createServer((req,res)=>{
 if(req.url?.startsWith('/luch/browser/')){
  res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,jobs:[],paired:true}));return;
 }
 if(req.url==='/file'){res.writeHead(200,{'content-type':'text/plain','content-disposition':'attachment'});res.end('LUCH R13 local download test\n');return}
 if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return}
 const french=req.url?.startsWith('/fr');
 const html='<!doctype html><html lang="'+(french?'fr':'en')+'"><head><title>LUCH R13 Test</title></head><body><h1>Local QA</h1><input id="field" value=""><button id="submit" onclick="window.clicked=1">Submit</button><div id="state">ready</div></body></html>';
 res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);
});
async function serverListen(){await new Promise((resolve,reject)=>server.listen(19498,'127.0.0.1',err=>err?reject(err):resolve()))}
async function run(){
 const tmp=await fsp.mkdtemp(path.join(os.tmpdir(),'luch-r13-e2e-')),ext=path.join(tmp,'extension'),profile=path.join(tmp,'profile');
 let browser;
 try{
  await fsp.cp(path.join(ROOT,'extension'),ext,{recursive:true});
  const mPath=path.join(ext,'manifest.json'),bPath=path.join(ext,'background.js');
  const m=JSON.parse(await fsp.readFile(mPath,'utf8'));
  m.permissions=[...new Set([...m.permissions,'tabs','debugger','downloads'])]; // simulate pre-approved install permission; explicitly disclosed in report
  m.host_permissions=['http://127.0.0.1/*'];
  m.optional_permissions=[];
  m.optional_host_permissions=[];
  await fsp.writeFile(mPath,JSON.stringify(m,null,2));
  let bg=await fsp.readFile(bPath,'utf8');
  assert.match(bg,/const BASE='https:\/\/api\.lenarsalimov\.ru\/luch\/browser'/);
  bg=bg.replace("const BASE='https://api.lenarsalimov.ru/luch/browser'","const BASE='http://127.0.0.1:19498/luch/browser'");
  await fsp.writeFile(bPath,bg);
  browser=await puppeteer.launch({executablePath:process.env.LUCH_TEST_BROWSER_BIN||'/Applications/Opera.app/Contents/MacOS/Opera',headless:true,userDataDir:profile,ignoreDefaultArgs:['--disable-extensions'],args:['--disable-extensions-except='+ext,'--load-extension='+ext,'--no-first-run','--no-default-browser-check','--no-sandbox'],timeout:30000});
  report.browserVersion=await browser.version();
  let target=await browser.waitForTarget(t=>t.type()==='service_worker'&&t.url().endsWith('/background.js'),{timeout:20000});
  const worker=await target.worker();
  report.extensionId=target.url().split('/')[2];
  const page=await browser.newPage();await page.goto('http://127.0.0.1:19498/page',{waitUntil:'load'});
  const tabs=await worker.evaluate(()=>chrome.tabs.query({}));
  let tab=tabs.find(t=>t.url==='http://127.0.0.1:19498/page');assert.ok(tab,JSON.stringify(tabs));
  const downloadDir=path.join(tmp,'downloads');await fsp.mkdir(downloadDir,{recursive:true});
  const browserSession=await browser.target().createCDPSession();
  await browserSession.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  const grantId='b'.repeat(24);let targetId='ext:'+tab.id+':'+grantId;
  const uniqueDownload='luch-r13-e2e-'+process.pid+'.txt';
  await worker.evaluate(async({tab,grantId})=>{
   await chrome.storage.local.set({auth:{token:'LOCAL_QA_TEST_ONLY'}});
   await chrome.storage.session.set({grants:{[tab.id]:{tabId:tab.id,grantId,origin:'http://127.0.0.1:19498',url:tab.url,scope:'interact',title:'QA',preciseCursor:true}},ownedTabs:[]});
  },{tab,grantId});
  const action=async(op,args={})=>{
   currentOp=op;const before=Date.now();
   try{
    const result=await worker.evaluate(async({targetId,op,args})=>performJob({targetId,op,args}),{targetId,op,args});
    if(!result?.ok)throw new Error(JSON.stringify(result));
    const data=result.data||{};
    const currentTab=async()=>worker.evaluate(id=>chrome.tabs.get(id),tab.id);
    // Verify observable browser state, not just worker's {ok:true} response.
    if(op==='get_browser_capabilities')assert.equal(data.operations,100);
    if(op==='list_windows')assert.ok(Array.isArray(data)&&data.length>0);
    if(op==='get_tab_details')assert.equal(data.id,tab.id);
    if(op==='get_tab_language')assert.equal(data.language,'en');
    if(op==='get_zoom')assert.ok(Number.isFinite(data.factor)&&data.factor>0);
    if(op==='set_zoom')assert.equal(await worker.evaluate(id=>chrome.tabs.getZoom(id),tab.id),1.25);
    if(op==='duplicate_tab')assert.equal((await worker.evaluate(id=>chrome.tabs.get(id),data.tabId)).url,tab.url);
    if(op==='pin_tab')assert.equal((await currentTab()).pinned,true);
    if(op==='unpin_tab')assert.equal((await currentTab()).pinned,false);
    if(op==='mute_tab')assert.equal((await currentTab()).mutedInfo?.muted,true);
    if(op==='unmute_tab')assert.equal((await currentTab()).mutedInfo?.muted,false);
    if(op==='move_tab')assert.equal((await currentTab()).index,1);
    if(op==='wait_for_load')assert.equal(data.loaded,true);
    if(op==='wait_for_url')assert.equal(data.matched,true);
    if(op==='downloads_list')assert.ok(Array.isArray(data));
    if(op==='download_url'){
     assert.equal(data.started,true);
     let entries=[];
     for(let i=0;i<30;i++){
      entries=await worker.evaluate(id=>chrome.downloads.search({id}),data.downloadId);
      if(entries[0]?.state==='complete')break;
      await new Promise(resolve=>setTimeout(resolve,200));
     }
     assert.equal(entries[0]?.state,'complete','Chrome must finish actual download');
     const downloaded=entries[0].filename;
     assert.equal(await fsp.readFile(downloaded,'utf8'),'LUCH R13 local download test\n');
     report.downloadFilename={requested:uniqueDownload,actual:path.basename(downloaded),honored:path.basename(downloaded)===uniqueDownload};
     // Delete only the unique file created in this test, after validating
     // content and verifying its very recent modification time.
     const stat=await fsp.stat(downloaded);
     assert.ok(stat.mtimeMs>=START-1500,'Downloaded file must be newly created');
     await fsp.unlink(downloaded);
    }
    if(op==='press_key')assert.equal(await page.$eval('#field',el=>el.value),'a');
    if(op==='key_chord'){
     const keys=await page.evaluate(()=>window._keys||[]);
     assert.ok(keys.some(e=>e.key==='a'&&e.meta===true),'Meta+A key event must reach document');
     report.chordObserved=keys.at(-1);
     report.chordSelection=await page.$eval('#field',el=>({start:el.selectionStart,end:el.selectionEnd}));
    }
    if(op==='discard_tab'){
     assert.equal(data.discarded,true);
     const tabs=await worker.evaluate(()=>chrome.tabs.query({}));
     report.discardTabState={originalId:tab.id,returnedId:data.tabId,remaining:tabs.filter(t=>t.url?.includes('/discard')).map(t=>({id:t.id,discarded:t.discarded,status:t.status}))};
     assert.ok(tabs.some(t=>t.id===data.tabId&&t.discarded===true),'Discard must preserve the browser tab, possibly under the returned new ID');
    }
    report.tests.push({op,status:'PASS',durationMs:Date.now()-before,dataSummary:JSON.stringify(result.data||{}).slice(0,320)});
    console.log('PASS',op);
    return result.data;
   }catch(e){report.tests.push({op,status:'FAIL',durationMs:Date.now()-before,error:String(e.message||e).slice(0,400)});console.log('FAIL',op,String(e.message||e).slice(0,190));return null;}
  };
  await action('get_browser_capabilities');
  await action('list_windows');
  await action('get_tab_details');
  await action('get_tab_language');
  await action('get_zoom');
  await action('set_zoom',{factor:1.25});
  await action('duplicate_tab');
  await action('pin_tab');
  await action('unpin_tab');
  await action('mute_tab');
  await action('unmute_tab');
  await action('move_tab',{index:1});
  await action('wait_for_load',{timeoutMs:1000});
  await action('wait_for_url',{url:'http://127.0.0.1:19498/page',timeoutMs:1000});
  await action('downloads_list');
  await action('download_url',{url:'http://127.0.0.1:19498/file',filename:uniqueDownload});
  await page.bringToFront().catch(()=>{});
  await page.evaluate(()=>{window._keys=[];addEventListener('keydown',e=>window._keys.push({key:e.key,meta:e.metaKey,ctrl:e.ctrlKey}),true)});
  await page.focus('#field').catch(()=>{});
  await action('press_key',{key:'a'});
  report.fieldAfterPressKey=await page.$eval('#field',e=>e.value).catch(()=>null);
  await action('key_chord',{key:'a',modifiers:4});
  report.fieldAfterChord=await page.$eval('#field',e=>e.value).catch(()=>null);
  const extra=await browser.newPage();await extra.goto('http://127.0.0.1:19498/page2',{waitUntil:'load'});
  // Discard a non-active, uninspected tab (not the Puppeteer-owned target).
  const spare=await worker.evaluate(()=>chrome.tabs.create({url:'http://127.0.0.1:19498/discard',active:false}));
  for(let i=0;i<30;i++){const t=await worker.evaluate(id=>chrome.tabs.get(id),spare.id);if(t.status==='complete')break;await new Promise(r=>setTimeout(r,150))}
  const spareGrant='c'.repeat(24);
  await worker.evaluate(async ({spare,spareGrant})=>{
   const record=(await chrome.storage.session.get('grants')).grants||{};
   record[spare.id]={tabId:spare.id,grantId:spareGrant,url:spare.url,origin:'http://127.0.0.1:19498',title:'Discard QA',scope:'interact',preciseCursor:true};
   await chrome.storage.session.set({grants:record});
  },{spare,spareGrant});
  tab=spare;targetId='ext:'+spare.id+':'+spareGrant;
  await action('discard_tab');
  report.summary={pass:report.tests.filter(t=>t.status==='PASS').length,fail:report.tests.filter(t=>t.status==='FAIL').length,total:report.tests.length};
 }finally{
  if(browser)await browser.close().catch(()=>{});
  await fsp.rm(tmp,{recursive:true,force:true}).catch(()=>{});
 }
}
(async()=>{
 try{await serverListen();await run();}catch(e){report.fatal=String(e.stack||e);console.error('FATAL',report.fatal)}finally{
  report.finishedAt=new Date().toISOString();report.durationMs=Date.now()-START;
  const out=path.join(ROOT,'QA_R13_19_REAL_OPS_20261127.json');
  await fsp.writeFile(out,JSON.stringify(report,null,2)+'\n');
  console.log('REPORT',out,JSON.stringify(report.summary||{}));
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error(e);process.exitCode=1});