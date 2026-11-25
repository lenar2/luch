'use strict';
// Facilitator-only local launcher, not a public deployment or a human-result generator.
// Requires Node >=18, Python3, openssl and local playwright-core/Chromium.
const {chromium}=require('playwright-core'),fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),https=require('https'),crypto=require('crypto');
const {spawn,execFileSync}=require('child_process');
const root=path.resolve(__dirname,'../../..'), home=path.join(root,'home'), site=path.join(root,'website');
const args=process.argv.slice(2), smoke=args.includes('--smoke'), arm=args[0], set=args[1];
if(!smoke&&(!['browser','luch'].includes(arm)||!['A','B'].includes(set)))throw Error('Usage: node run_trial.cjs browser|luch A|B OR --smoke');
const targets={A:['example.com','iana.org'],B:['example.org','wikipedia.org']};
const host='luch.lenarsalimov.ru',base='https://'+host+'/home/', work=fs.mkdtempSync(path.join(os.tmpdir(),'luch-r84-'));
const db=path.join(work,'study.sqlite'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
let app,edge,browser,closing=false;
async function cleanup(){
 if(closing)return;closing=true;
 if(browser)await browser.close().catch(()=>{});
 if(edge)await new Promise(r=>edge.close(r));
 if(app){app.kill('SIGTERM');await sleep(500);}
 fs.rmSync(work,{recursive:true,force:true});
}
process.once('SIGINT',async()=>{await cleanup();process.exit(130)});
process.once('SIGTERM',async()=>{await cleanup();process.exit(143)});
function staticSite(req,res){
 // Exact repository public legal pages/assets, local only. Never forward to production.
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'https://'+host).pathname)}catch{res.writeHead(400);res.end();return}
 const permitted=/^\/(?:en\/|ru\/)?(?:privacy|terms)(?:\/|$)/.test(pathname)||/^\/assets\//.test(pathname);
 if(!permitted){res.writeHead(404);res.end('Local study: only Home and its legal pages are available.');return}
 const file=path.resolve(site,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
 if(!file.startsWith(site+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return}
 const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
}
(async()=>{
 try{
  if(!smoke&&arm==='browser'){
   browser=await chromium.launch({headless:false});
   const ctx=await browser.newContext();
   const page=await ctx.newPage();
   console.log('Browser arm. Addresses: '+targets[set].join(', ')+'. No AI. Start observer stopwatch before task instructions. Close browser when done.');
   await page.goto('about:blank');await new Promise(r=>browser.once('disconnected',r));return;
  }
  const frontendPort=18443,backendPort=18884;
  execFileSync('openssl',['req','-x509','-nodes','-newkey','rsa:2048','-days','1','-subj','/CN='+host,'-addext','subjectAltName=DNS:'+host,'-keyout',path.join(work,'key.pem'),'-out',path.join(work,'cert.pem')],{stdio:'ignore'});
  // The original handler, DB initialization and HTTPS checker are used verbatim.
  // Bind only to loopback instead of the production main's 0.0.0.0.
  const bootstrap='import sys,importlib.util,os; spec=importlib.util.spec_from_file_location("luch_home",sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); m.initialize(); m.BoundedServer(("127.0.0.1",int(os.environ["PORT"])),m.Handler).serve_forever()';
  app=spawn('python3',['-c',bootstrap,path.join(home,'app/server.py')],{env:{...process.env,PORT:String(backendPort),LUCH_HOME_DB:db,LUCH_HOME_SELF_EDGE:''},stdio:['ignore','ignore','ignore']});
  let healthy=false;for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:'+backendPort+'/healthz')).ok){healthy=true;break}}catch{}await sleep(150)}
  if(!healthy)throw Error('isolated backend unhealthy');
  edge=https.createServer({key:fs.readFileSync(path.join(work,'key.pem')),cert:fs.readFileSync(path.join(work,'cert.pem'))},(req,res)=>{
   if(req.headers.host!==host){res.writeHead(404);res.end();return}
   if(!req.url.startsWith('/home/'))return staticSite(req,res);
   const target=req.url.replace(/^\/home/,'')||'/';
   const upstream=http.request({hostname:'127.0.0.1',port:backendPort,path:target,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});
   upstream.on('error',()=>{res.writeHead(502);res.end()});req.pipe(upstream);
  });
  await new Promise((ok,fail)=>{edge.once('error',fail);edge.listen(frontendPort,'127.0.0.1',ok)});
  browser=await chromium.launch({headless:smoke,args:['--disable-dev-shm-usage','--no-proxy-server','--host-resolver-rules=MAP '+host+' 127.0.0.1:'+frontendPort+', EXCLUDE localhost']});
  const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1280,height:900}});
  const page=await ctx.newPage();
  const res=await page.goto(base,{waitUntil:'domcontentloaded',timeout:15000});
  if(res.status()!==200)throw Error('stage response '+res.status());
  if(!smoke){
   console.log('LUCH arm (private local test account only). Addresses: '+targets[set].join(', ')+'. Do not reuse a password or recovery code. Start observer stopwatch before task instructions; include signup and both tasks. Close browser when done. Study data deleted on close.');
   await new Promise(r=>browser.once('disconnected',r));return;
  }
  await page.locator('#guest-website-url').fill('iana.org');
  await page.locator('#guest-website-intent button[type=submit]').click();
  await page.locator('#register-form').waitFor({state:'visible'});
  const name='r84'+crypto.randomBytes(6).toString('hex');
  await page.locator('#register-username').fill(name);
  await page.locator('#register-password').fill('TrialOnly-'+crypto.randomBytes(16).toString('hex'));
  await page.locator('#terms-agreement').check();
  await page.locator('#register-form button[type=submit]').click();
  await page.locator('#recovery-dialog').waitFor({state:'visible',timeout:12000});
  await page.locator('#recovery-saved').check();await page.locator('#close-recovery').click();
  await page.locator('[data-page=check]').waitFor({state:'visible'});
  await page.locator('#consent-box').check();
  await page.locator('#grant-form button[type=submit]').click();
  await page.locator('#granted').waitFor({state:'visible',timeout:12000});
  await page.locator('#run-check').click();
  await page.locator('#site-result').waitFor({state:'visible',timeout:20000});
  const observation=await page.evaluate(async()=>{const s=await(await fetch('/home/api/state')).json();return s.checks[0].result});
  if(observation.http_status!==301||observation.origin!=='https://iana.org')throw Error('case drift or wrong source');
  const legal=await ctx.newPage();const lr=await legal.goto('https://'+host+'/en/terms/',{timeout:15000});
  if(lr.status()!==200)throw Error('local legal page missing');
  console.log(JSON.stringify({status:'PASS',mode:'automated_facilitator_smoke_only',human_observations:0,real_backend:true,actual_redirect:observation.http_status,origin:observation.origin,local_legal_page:true,private_loopback:true,production_changed:false}));
 }catch(e){console.error(String(e));process.exitCode=1}
 finally{await cleanup()}
})();
