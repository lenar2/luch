(async()=>{
const {createBroker}=await import('/qa/broker/server.mjs');
const { chromium }=require('/app/node_modules/playwright-core');

const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const results=[],pass=(name,data={})=>{results.push({name,...data});console.log('PASS',name,JSON.stringify(data))};
const bridgeToken=crypto.randomBytes(32).toString('hex'),pairingCode='51826394';
const broker=createBroker({bridgeToken,pairingCode,port:9248,host:'127.0.0.1'});
let fx,fx2,ctx;
const request=async(method,url,body)=>{const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),12500);try{const r=await fetch('http://127.0.0.1:9248'+url,{method,headers:{'x-browser-bridge-token':bridgeToken,...(body!==undefined?{'content-type':'application/json'}:{})},body:body!==undefined?JSON.stringify(body):undefined,signal:ctl.signal});return {status:r.status,data:await r.json()}}finally{clearTimeout(t)}};
const listen=(s,port)=>new Promise((resolve,reject)=>s.listen(port,'127.0.0.1',resolve).on('error',reject));
try{
 broker.server.on('request',(req)=>{if(req.url.startsWith('/extension/')||req.url.startsWith('/pair'))console.log('BROKER_REQ',req.method,req.url,'ORIGIN',req.headers.origin||'ABSENT','HAS_AUTH',!!req.headers.authorization)});await broker.listen();
 const serve=(text)=>http.createServer((req,res)=>{const body='<!doctype html><html><head><title>LUCH synthetic test</title></head><body><main><h1>Granted QA page</h1><p>'+text+'</p><a href="/subpage">Test only</a></main></body></html>';res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(body)});
 fx=serve('AUTHORIZED_TEXT_42');fx2=serve('UNAUTHORIZED_PAGE_93');
 await Promise.all([listen(fx,10011),listen(fx2,10012)]);
 const ext='/qa/extension-test-'+process.pid;
 fs.cpSync('/qa/extension',ext,{recursive:true});
 const manifestPath=path.join(ext,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 manifest.commands={'_execute_action':{'suggested_key':{'default':'Ctrl+Shift+Y'},'description':'Open Browser Companion for approved tab'}};
 fs.writeFileSync(manifestPath,JSON.stringify(manifest));
 ctx=await chromium.launchPersistentContext('/qa/profile-e2e-'+process.pid,{headless:false,executablePath:chromium.executablePath(),args:['--no-sandbox','--disable-extensions-except='+ext,'--load-extension='+ext],timeout:23000});
 let worker=ctx.serviceWorkers()[0];if(!worker)worker=await ctx.waitForEvent('serviceworker',{timeout:12000});
 const workerUrl=worker.url();assert.match(workerUrl,/^chrome-extension:\/\/[a-p]{32}\/background\.js$/);
 const extensionId=workerUrl.split('/')[2];
 pass('real_mv3_worker',{chrome:ctx.browser()?.version(),extensionId});
 const popup=await ctx.newPage();
 await popup.goto('chrome-extension://'+extensionId+'/popup.html',{waitUntil:'domcontentloaded'});
 await popup.locator('#pairCode').fill(pairingCode);
 await popup.locator('#pair').click();
 await popup.waitForTimeout(1200);
 console.log('POPUP_STATE',await popup.evaluate(()=>({status:document.querySelector('#status')?.textContent,feedback:document.querySelector('#feedback')?.textContent,pairingHidden:document.querySelector('#pairing')?.hidden,controlsHidden:document.querySelector('#controls')?.hidden})));
 console.log('BROKER_HEALTH',await (await fetch('http://127.0.0.1:9248/health')).json());
 await popup.screenshot({path:'/qa/qa-popup-pair-debug.png'});
 await popup.waitForFunction(()=>document.querySelector('#status')?.textContent==='Подключено',undefined,{timeout:6500});
 pass('popup_pair_via_real_button');
 await popup.close();
 const page=await ctx.newPage();await page.goto('http://127.0.0.1:10011/',{waitUntil:'domcontentloaded'});
 await page.bringToFront();
 // No host access exists before a physical Chrome action. Keyboard shortcut is QA-only manifest shortcut.
 let deniedBefore=false;
 try{const preGrant=await worker.evaluate('grantActive()');console.log('PRE_GESTURE_UNEXPECTED_GRANT',preGrant)}catch(e){console.log('PRE_GESTURE_REJECTION',String(e.message).slice(0,350));deniedBefore=/Cannot access|not allowed|permission|host|Откройте обычную веб-страницу/i.test(String(e.message));}
 assert.ok(deniedBefore,'activeTab must not be granted by default');
 pass('ungranted_user_tab_is_inaccessible');
 const send=require('node:child_process').spawnSync('python3',['/qa/send-shortcut.py'],{encoding:'utf8',timeout:6000,env:process.env});
 assert.equal(send.status,0,send.stderr);
 await new Promise(r=>setTimeout(r,600));
 const popupOpened=ctx.pages().find(p=>p.url().startsWith('chrome-extension://'+extensionId+'/popup.html'));
 let grant;
 if(popupOpened){
  console.log('EXTENSION_POPUP_OPENED_BY_BROWSER_ACTION');
  await popupOpened.locator('#grant').click();
  await popupOpened.waitForTimeout(250);
  const fb=await popupOpened.locator('#feedback').innerText();
  console.log('GRANT_FEEDBACK',fb.slice(0,170));
  assert.match(fb,/15 минут/);
  grant={message:fb};
 }else{
  // The browser still recorded a real extension action, which grants activeTab.
  grant=await worker.evaluate('grantActive()');
 }
 assert.match(grant.message,/15 минут/);
 pass('real_browser_action_grants_active_tab',{popupInteractive:!!popupOpened});
 const list=await request('GET','/v1/tabs');
 assert.equal(list.status,200);assert.equal(list.data.tabs.length,1);
 const target=list.data.tabs[0];
 assert.equal(target.profileKind,'USER_CONSENTED_TAB');assert.match(target.url,/10011/);
 pass('only_approved_tab_listed');
 const other=await ctx.newPage();await other.goto('http://127.0.0.1:10012/');
 const afterOther=await request('GET','/v1/tabs');assert.equal(afterOther.data.tabs.length,1);
 pass('ungranted_tab_not_listed');
 const denied=await request('POST','/v1/text',{targetId:'ext:999:aaaaaaaaaaaaaaaaaaaaaaaa',selector:'body'});
 assert.equal(denied.status,403);pass('ungranted_tab_read_denied');
 const readPromise=request('POST','/v1/text',{targetId:target.id,selector:'body'});
 await new Promise(r=>setTimeout(r,200));
 await worker.evaluate('poll()');
 const read=await readPromise;
 assert.equal(read.status,200);assert.equal(read.data.ok,true);
 assert.match(read.data.text,/AUTHORIZED_TEXT_42/);
 assert.doesNotMatch(read.data.text,/UNAUTHORIZED_PAGE_93/);
 pass('authorized_dom_read_through_broker',{characters:read.data.text.length});
 await page.bringToFront();await worker.evaluate('revokeActive()');
 const empty=await request('GET','/v1/tabs');assert.equal(empty.data.tabs.length,0);
 const afterRevoke=await request('POST','/v1/text',{targetId:target.id,selector:'body'});
 assert.equal(afterRevoke.status,403);pass('revoke_blocks_future_reads');
 await worker.evaluate('grantActive()');
 const refresh=await request('GET','/v1/tabs');assert.equal(refresh.data.tabs.length,1);
 await page.goto('http://127.0.0.1:10012/',{waitUntil:'domcontentloaded'});
 await new Promise(r=>setTimeout(r,300));await worker.evaluate('poll()');
 const revokedByOrigin=await request('GET','/v1/tabs');assert.equal(revokedByOrigin.data.tabs.length,0);
 pass('origin_change_auto_revoke');
 await page.screenshot({path:'/qa/qa-approved-r1.png'});
 fs.writeFileSync('/qa/QA_BROWSER_R1_PASS.json',JSON.stringify({status:'PASS_ISOLATED_CHROMIUM',browser:ctx.browser()?.version(),tests:results,limitations:['Real browser action invoked through test-only shortcut in temporary manifest; grant button in native popup not independently clicked','No production LUCH route switched','No signed-in user Chrome tested']},null,2));
 console.log('FINAL',results.length,'ISOLATED_E2E_PASS');
}catch(e){console.error('R1_E2E_FAIL',e.stack||e);process.exitCode=1}
finally{
 if(ctx)await ctx.close().catch(()=>{});
 if(fx)await new Promise(r=>fx.close(r));
 if(fx2)await new Promise(r=>fx2.close(r));
 await broker.close().catch(()=>{});
}

})().catch(e=>{console.error(e);process.exit(1)});
