const fs=require('fs'),http=require('http'),path=require('path');
const {firefox,chromium}=require('playwright-core');
const base='/preview-source',out='/out';
let loggedIn=false,registered=false;
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const target=(req.url||'').split('?')[0];
 if(target.startsWith('/home/api/')){
  res.setHeader('Content-Type','application/json');
  if(target==='/home/api/state'){res.end(JSON.stringify(loggedIn?{authenticated:true,username:'demo_user',csrf:'simulated',grant:null,checks:[],events:[]}:{authenticated:false}));return;}
  if(target==='/home/api/register'){loggedIn=true;registered=true;res.end(JSON.stringify({authenticated:true}));return;}
  res.writeHead(404);res.end(JSON.stringify({error:'Not mocked'}));return;
 }
 const filename=target==='/home/'?'index.html':target.replace(/^\/home\//,'');
 if(!['index.html','app.css','app.js','mark.svg','brand-wordmark.svg'].includes(filename)){res.writeHead(404);res.end();return}
 const name=path.join(base,filename);
 try{res.setHeader('Content-Type',mime[path.extname(name)]||'text/plain');res.end(fs.readFileSync(name))}
 catch{res.writeHead(404);res.end()}
});
async function main(){
 await new Promise(ok=>server.listen(18887,'127.0.0.1',ok));
 const report={tests:[],screenshots:[],mock_api:true,network:'isolated_loopback',production_changed:false};
 for(const [engine,browserType,width,height] of [['firefox',firefox,390,844],['chromium',chromium,1440,900]]){
  let browser;
  try{
   browser=await browserType.launch({headless:true,args:engine==='firefox'?[]:['--no-sandbox']});
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   loggedIn=false;registered=false;
   await page.goto('http://127.0.0.1:18887/home/',{waitUntil:'domcontentloaded'});
   await page.locator('#guest-website-url').waitFor();
   const hero=await page.locator('h1').first().innerText();
   const first=path.join(out,'hea-r8-'+engine+'-'+width+'-guest.png');
   await page.screenshot({path:first,fullPage:true});report.screenshots.push(first);
   report.tests.push({engine,test:'task-first visible',ok:hero.includes('Your website.')});
   await page.locator('#guest-website-url').fill('https://example.com');
   await page.locator('#guest-website-intent button[type="submit"]').click();
   const prepared=await page.locator('#website-url').inputValue();
   const authVisible=await page.locator('#register-form').isVisible();
   report.tests.push({engine,test:'intent preserved without remote check',ok:prepared==='https://example.com'&&authVisible&&!registered});
   if(engine==='firefox'){
    await page.locator('#register-username').fill('demo_user');
    await page.locator('#register-password').fill('strong-password-for-demo');
    await page.locator('#terms-agreement').check();
    await page.locator('#register-form button[type=submit]').click();
    await page.locator('[data-page=check]').waitFor({state:'visible',timeout:8000});
    const after=await page.locator('#website-url').inputValue();
    report.tests.push({engine,test:'mock signup routes to permission UI',ok:after==='https://example.com'&&await page.locator('#consent-box').isVisible()});
    const second=path.join(out,'hea-r8-'+engine+'-after-mock-signup.png');
    await page.screenshot({path:second,fullPage:true});report.screenshots.push(second);
   }
   report.tests.push({engine,test:'no JS exceptions',ok:errors.length===0,errors});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
   report.tests.push({engine,test:'no horizontal overflow',ok:!overflow});
   await browser.close();
  }catch(e){report.tests.push({engine,test:'render harness',ok:false,error:String(e).slice(0,400)});if(browser)await browser.close().catch(()=>{})}
 }
 report.status=report.tests.every(x=>x.ok)?'PASS':'FAIL';
 fs.writeFileSync(path.join(out,'hea-r8-visual-test.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));server.close();
}
main().catch(e=>{console.error(e);server.close();process.exit(1)});
