const {chromium}=require('playwright-core');
const fs=require('node:fs');
const path='/captures';
(async()=>{
 const browser=await chromium.launchPersistentContext('/tmp/luch-r19-qa-profile',{
  headless:true,executablePath:chromium.executablePath(),
  args:['--no-sandbox','--disable-extensions-except=/extension','--load-extension=/extension'],
  viewport:{width:490,height:720}
 });
 try{
  const worker=browser.serviceWorkers()[0]||await browser.waitForEvent('serviceworker',{timeout:20000});
  if(!worker.url().endsWith('/background.js'))throw Error('WORKER_NOT_LOADED');
  const extId=worker.url().split('/')[2],origin='chrome-extension://'+extId+'/popup.html';
  const basic={connected:true,online:true,granted:true,scope:'read',preciseCursor:false,tabOverviewSharing:false,
   tab:{title:'Example Domain · test page',url:'https://example.com/'}};
  const cases=[
    {name:'unpaired-en',lang:'en',fixture:{connected:false,online:false,granted:false,tab:null}},
    {name:'unpaired-ru',lang:'ru',fixture:{connected:false,online:false,granted:false,tab:null}},
    {name:'paired-no-grant-ru',lang:'ru',fixture:{...basic,granted:false,scope:null}},
    {name:'paired-no-grant-en',lang:'en',fixture:{...basic,granted:false,scope:null}},
    {name:'read-approved-ru',lang:'ru',fixture:basic},
    {name:'read-approved-en',lang:'en',fixture:basic},
    {name:'interaction-approved-ru',lang:'ru',fixture:{...basic,scope:'interact'}},
    {name:'interaction-approved-en',lang:'en',fixture:{...basic,scope:'interact'}},
    {name:'temporary-outage-ru',lang:'ru',fixture:{...basic,online:false}},
  ];
  for(const c of cases){
   const p=await browser.newPage();
   const errors=[];p.on('pageerror',e=>errors.push(String(e)));
   await p.addInitScript(({fixture,lang})=>{
    localStorage.setItem('luch_locale',lang);
    Object.defineProperty(chrome.runtime,'sendMessage',{configurable:true,value:async message=>{
      if(message.op==='status')return {ok:true,...fixture};
      return {ok:false,error:'FIXTURE_BLOCKED_OPERATION'};
    }});
   },{fixture:c.fixture,lang:c.lang});
   await p.goto(origin,{waitUntil:'domcontentloaded'});
   await p.waitForTimeout(250);
   const current=await p.evaluate(()=>({
    status:document.getElementById('status').textContent,
    headline:document.getElementById('headline').textContent,
    granted:document.getElementById('shareStatus').textContent,
    pairingHidden:document.getElementById('pairing').hidden,
    controlsHidden:document.getElementById('controls').hidden,
    advancedClosed:!document.getElementById('advanced').open,
    grantHidden:document.getElementById('grant').hidden,
    interactHidden:document.getElementById('interact').hidden,
    canRevoke:!document.getElementById('revoke').hidden,
    codeLength:document.getElementById('pairCode').value.length
   }));
   const expectedOnline=c.fixture.connected&&c.fixture.online,shouldShowControls=c.fixture.connected;
   if(current.controlsHidden===shouldShowControls||current.pairingHidden!==shouldShowControls)
     throw Error('STATE_WRONG '+c.name+JSON.stringify(current));
   if(errors.length)throw Error('JS_ERRORS '+c.name+JSON.stringify(errors));
   if(c.fixture.granted&& !current.canRevoke)throw Error('REVOKE_NOT_VISIBLE '+c.name);
   if(!current.advancedClosed)throw Error('ADVANCED_NOT_COLLAPSED '+c.name);
   await p.locator('body').screenshot({path:path+'/'+c.name+'.png'});
   console.log('PASS',c.name,JSON.stringify(current));
   await p.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error('ERROR',e.stack||String(e));process.exitCode=1});
