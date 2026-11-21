const fs=require('node:fs/promises');
const {chromium}=require('playwright-core');
const base='/captures',out='/store';
const uri=(buffer,type='image/png')=>'data:'+type+';base64,'+Buffer.from(buffer).toString('base64');
const scenes=[
 {lang:'ru',kind:'read-approved',file:'chrome-01-ru-approved-1280x800.png',step:'01 / ЧТЕНИЕ РАЗРЕШЕНО',title:'ИИ видит только<br>выбранную вкладку.',desc:'Разрешили чтение — ИИ может изучить страницу. Доступ можно отозвать в один момент.',points:['Одна выбранная вкладка','Остальные страницы закрыты','Действия требуют отдельного разрешения']},
 {lang:'ru',kind:'paired-no-grant',file:'chrome-02-ru-before-consent-1280x800.png',step:'02 / ВЫ РЕШАЕТЕ',title:'Сначала —<br>ваше разрешение.',desc:'Вы выбираете страницу и решаете, сможет ли ИИ её прочитать.',points:['Открытая вкладка не передаётся сама','Кнопка «Разрешить чтение»','Можно оставить страницу закрытой']},
 {lang:'ru',kind:'interaction-approved',file:'chrome-03-ru-interaction-1280x800.png',step:'03 / ДЕЙСТВИЯ ОТДЕЛЬНО',title:'Чтение — не<br>разрешение действовать.',desc:'Клики и ввод текста требуют отдельного согласия на конкретную вкладку.',points:['Чтение и действия — разные уровни','Точный курсор — ещё одно разрешение','Кнопка отзыва всегда под рукой']},
 {lang:'en',kind:'read-approved',file:'chrome-01-en-approved-1280x800.png',step:'01 / READ APPROVED',title:'Your AI sees only<br>the tab you approve.',desc:'Allow reading to share a page with a compatible AI. You can revoke that access at any time.',points:['One chosen browser tab','Other pages stay private','Actions need separate permission']},
 {lang:'en',kind:'paired-no-grant',file:'chrome-02-en-before-consent-1280x800.png',step:'02 / YOUR DECISION',title:'Permission<br>comes first.',desc:'Choose a tab and decide whether your AI may read it. Open tabs are not shared automatically.',points:['No default access to other tabs','Explicit “Allow reading” button','Keep a tab private if you prefer']},
 {lang:'en',kind:'interaction-approved',file:'chrome-03-en-interaction-1280x800.png',step:'03 / INTERACTION IS SEPARATE',title:'Reading does not<br>mean acting.',desc:'Clicking, typing and precise pointer actions require additional per-tab approval.',points:['Read and interact are separate grants','Extra consent for precise pointer','Revoke access when done']}
];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath(),args:['--no-sandbox']});
 const logo=uri(await fs.readFile('/brand/luch-app-mark.svg'),'image/svg+xml');
 try{
  for(const v of scenes){
   const popup=uri(await fs.readFile(base+'/'+v.kind+'-'+v.lang+'.png'));
   const bullets=v.points.map(t=>'<li>'+t+'</li>').join('');
   const html=`<!doctype html><html lang="${v.lang}"><head><meta charset="UTF-8"><style>
   *{box-sizing:border-box}html,body{margin:0;width:1280px;height:800px;overflow:hidden}
   body{font-family:Arial,"Helvetica Neue",sans-serif;background:radial-gradient(ellipse at 78% 34%,#386A69 0,transparent 47%),linear-gradient(120deg,#082630 0%,#143B43 70%,#102F37 100%);color:#F9FAF6}
   .brand{position:absolute;left:72px;top:54px;display:flex;align-items:center;gap:15px}
   .brand img{width:58px;height:58px;border-radius:14px}.brand span{font-size:16px;font-weight:750;letter-spacing:0.17em;color:#DBB87D}
   .eyebrow{position:absolute;top:164px;left:75px;letter-spacing:0.16em;font-weight:750;color:#E3BC81;font-size:15px}
   h1{position:absolute;top:210px;left:72px;width:680px;margin:0;font-size:53px;line-height:1.08;letter-spacing:-.038em}
   .desc{position:absolute;left:75px;top:365px;width:605px;font-size:20px;color:#D5E7E1;line-height:1.43}
   ul{position:absolute;left:80px;top:510px;padding:0 0 0 18px;margin:0;color:#F2F8F1;font-size:17px;line-height:2.0}
   li::marker{color:#D8B479}
   .panel{position:absolute;left:802px;top:82px;width:388px;height:600px;overflow:hidden;border-radius:17px;background:#F7F6F0;box-shadow:0 27px 80px #001820bb;border:1px solid #C2D8D0}
   .panel img{width:388px;height:600px;object-fit:cover;object-position:top left;display:block}
   .spec{position:absolute;left:805px;top:55px;letter-spacing:.14em;font-size:12px;font-weight:800;color:#D8B479}
   .footer{position:absolute;bottom:43px;left:74px;width:1100px;font-size:13px;color:#B4CCC5;letter-spacing:.015em}
   </style></head><body>
   <div class="brand"><img src="${logo}"><span>LUCH / BROWSER COMPANION</span></div>
   <div class="eyebrow">${v.step}</div>
   <h1>${v.title}</h1><p class="desc">${v.desc}</p>
   <ul>${bullets}</ul>
   <div class="spec">REAL EXTENSION UI · SAFE TEST DATA · 0.7.0</div>
   <div class="panel"><img src="${popup}"></div>
   <div class="footer">${v.lang==='ru'?'Интерфейс настоящего расширения в тестовом состоянии · example.com · без данных пользователя':'Actual extension interface with fixture state · example.com · no personal user data'}</div>
   </body></html>`;
   const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
   await page.setContent(html,{waitUntil:'load'});
   await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
   await page.screenshot({path:out+'/'+v.file,fullPage:false});
   await page.screenshot({path:out+'/'+v.file.replace('.png','.jpg'),type:'jpeg',quality:81});
   await page.close();
   const stat=await fs.stat(out+'/'+v.file);
   console.log('SCREENSHOT',v.file,stat.size);
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
