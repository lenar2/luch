const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright-core');
const root='/store-source',cap='/captures',out=cap+'/store-export';
const uri=(data,type)=>'data:'+type+';base64,'+Buffer.from(data).toString('base64');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath(),args:['--no-sandbox']});
 try{
  const logo=uri(await fs.readFile(path.join(root,'store-assets/luch-app-mark.svg')),'image/svg+xml');
  const marquee=(await fs.readFile(path.join(root,'store-assets/chrome-marquee.svg'),'utf8'))
    .replace('href="luch-app-mark.svg"','href="'+logo+'"')
    .replace('Bring the page','Your AI. Your tab.')
    .replace('into your work.','Your permission.')
    .replace('Share one tab. Read first. Allow interaction only when you choose.','Understand the page. Act only when you allow.');
  const small=(await fs.readFile(path.join(root,'store-assets/chrome-small-promo.svg'),'utf8'))
    .replace('href="luch-app-mark.svg"','href="'+logo+'"')
    .replace('Share a tab.','Share a tab.')
    .replace('Keep control.','Keep control.');
  async function svg(name,content,w,h){
   const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
   await page.setContent('<html><body style="margin:0"><img style="display:block;width:'+w+'px;height:'+h+'px" src="'+uri(content,'image/svg+xml')+'"></body></html>');
   await page.locator('img').evaluate(img=>img.decode());
   await page.screenshot({path:out+'/'+name,fullPage:false});
   if(name.startsWith('chrome-promo-marquee')) await page.screenshot({path:out+'/chrome-promo-marquee-1400x560.jpg',type:'jpeg',quality:88});
   await page.close();
  }
  await svg('chrome-promo-small-440x280.png',small,440,280);
  await svg('chrome-promo-marquee-1400x560.png',marquee,1400,560);

  const popup=uri(await fs.readFile(cap+'/chrome-popup-unpaired-real.png'),'image/png');
  const example=uri(await fs.readFile(cap+'/chrome-example-real.png'),'image/png');
  const html=`<!doctype html><html><head><meta charset="utf-8"><style>
   *{box-sizing:border-box}html,body{margin:0;width:1280px;height:800px;overflow:hidden;font-family:Arial, sans-serif}
   body{background:radial-gradient(ellipse at 80% 12%,#315E65,transparent 47%),linear-gradient(125deg,#0A2732 10%,#153C45 100%);color:#F7F9F2}
   .brand{display:flex;align-items:center;gap:17px;margin:33px 60px}.brand img{width:56px;height:56px}
   .brand span{letter-spacing:.18em;font-size:15px;font-weight:700;color:#D8BE8E}
   .title{position:absolute;left:65px;top:160px;font-size:50px;font-weight:700;line-height:1.08;max-width:630px}
   .desc{position:absolute;left:68px;top:310px;font-size:20px;color:#D7E8E1;line-height:1.36;max-width:550px}
   .tab{position:absolute;left:67px;top:400px;width:590px;height:286px;overflow:hidden;border-radius:16px;background:white;box-shadow:0 19px 65px #02182390}
   .top{height:37px;background:#E8F0ED;display:flex;align-items:center;padding:0 17px;gap:8px}.dot{width:8px;height:8px;border-radius:50%;background:#A6BEB9}.addr{margin-left:15px;border-radius:10px;background:white;padding:4px 11px;font-size:12px;color:#53645D}
   .tab img{object-fit:cover;width:100%;height:249px;object-position:center center;transform:scale(1.06)}
   .popup{position:absolute;left:770px;top:88px;width:388px;height:677px;overflow:hidden;box-shadow:0 24px 70px #00191D90;border-radius:15px;border:1px solid #BFCFC8;background:#F9F9F5}
   .popup img{display:block;width:100%;height:auto}
   .label{position:absolute;left:68px;bottom:41px;color:#BED5CB;font-size:13px;letter-spacing:.06em}
   .real{position:absolute;left:774px;top:60px;color:#D8BE8E;font-size:12px;letter-spacing:.16em;font-weight:700}
  </style></head><body>
   <div class="brand"><img src="${logo}" alt=""><span>LUCH / BROWSER COMPANION</span></div>
   <div class="title">Your AI.<br>Your browser.</div>
   <div class="desc">Connect a compatible AI, pair the extension and approve<br>only the Chrome tab you want to share.</div>
   <div class="tab"><div class="top"><i class="dot"></i><i class="dot"></i><i class="dot"></i><span class="addr">example.com · harmless test page</span></div><img src="${example}" alt=""></div>
   <div class="real">REAL EXTENSION INTERFACE · 0.7.0</div>
   <div class="popup"><img src="${popup}" alt=""></div>
   <div class="label">Actual Chrome first-use capture and harmless example.com page · no user data</div>
  </body></html>`;
  const view=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  await view.setContent(html);
  await view.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(x=>x.decode())));
  await view.screenshot({path:out+'/chrome-screenshot-01-real-onboarding-1280x800.png'});
  await view.screenshot({path:out+'/chrome-screenshot-01-real-preview.jpg',type:'jpeg',quality:73});
  await view.screenshot({path:out+'/chrome-screenshot-01-real-onboarding-1280x800.jpg',type:'jpeg',quality:88});
  await view.close();
  for(const name of await fs.readdir(out)){
   const stat=await fs.stat(out+'/'+name);
   console.log('RENDERED',name,stat.size);
  }
 } finally {await browser.close()}
})().catch(e=>{console.error('RENDER_FAIL',String(e));process.exitCode=1});
