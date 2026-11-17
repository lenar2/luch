import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const captures=path.join(root,'dist','store-captures');
const output=path.join(root,'dist','store-assets');
await fs.mkdir(output,{recursive:true});

const read=async file=>fs.readFile(path.join(here,file),'utf8');
const imageData=async file=>{
 const bytes=await fs.readFile(file);
 const ext=path.extname(file).toLowerCase();
 const mime=ext==='.svg'?'image/svg+xml':ext==='.jpg'||ext==='.jpeg'?'image/jpeg':'image/png';
 return 'data:'+mime+';base64,'+bytes.toString('base64');
};
const requiredCaptures=[
 'popup-before-pair.png',
 'popup-before-pair.png',
 'popup-paired.png',
 'popup-read-approved.png',
 'popup-interaction-approved.png',
 'popup-revoked.png',
 'fixture-page-before-action.png',
 'fixture-page-after-action.png'
];
for(const file of requiredCaptures){
 try{await fs.access(path.join(captures,file))}
 catch{throw new Error('Missing real Chromium E2E capture: '+file+'; run the headed browser test first')}
}

const appSvg=await read('luch-app-mark.svg');
const appUri='data:image/svg+xml;base64,'+Buffer.from(appSvg).toString('base64');
const iconSvg=await read('extension-icon-ray-candidate.svg');
const smallSvg=(await read('chrome-small-promo.svg')).replaceAll('href="luch-app-mark.svg"','href="'+appUri+'"');
const marqueeSvg=(await read('chrome-marquee.svg')).replaceAll('href="luch-app-mark.svg"','href="'+appUri+'"');

const browser=await chromium.launch({headless:true});
async function renderSvg(name,svg,width,height,transparent=false){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
 const uri='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
 await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;width:'+width+'px;height:'+height+'px;overflow:hidden"><img src="'+uri+'" style="display:block;width:'+width+'px;height:'+height+'px"></body></html>',{waitUntil:'load'});
 await page.locator('img').evaluate(img=>img.decode());
 await page.screenshot({path:path.join(output,name),fullPage:false,omitBackground:transparent});
 await page.close();
}
async function compose(name,width,height,{heading,caption,popup,page}) {
 const [popupUri,pageUri]=await Promise.all([
  imageData(path.join(captures,popup)),
  imageData(path.join(captures,page))
 ]);
 const compact=width<800;
 const html='<!doctype html><html><head><meta charset="utf-8"><style>'+
 '*{box-sizing:border-box}html,body{margin:0;width:'+width+'px;height:'+height+'px;overflow:hidden}body{font-family:Arial,Helvetica,sans-serif;background:#f7f6f0;color:#102f34}'+
 '.canvas{width:100%;height:100%;padding:'+(compact?'22px':'48px 58px')+';background:radial-gradient(ellipse at 75% 8%,#e5eee8 0%,#f7f6f0 58%,#f0ede4 100%)}'+
 '.brand{display:flex;align-items:center;gap:'+(compact?'9px':'14px')+';color:#143c43;font-size:'+(compact?'10px':'15px')+';font-weight:800;letter-spacing:.16em}.brand img{width:'+(compact?'36px':'58px')+';height:'+(compact?'36px':'58px')+';border-radius:8px}'+
 '.eyebrow{margin:'+(compact?'13px':'24px')+' 0 5px;color:#718a83;font-size:'+(compact?'8px':'12px')+';font-weight:800;letter-spacing:.18em}h1{margin:0;font-size:'+(compact?'24px':'46px')+';line-height:1.05;letter-spacing:-.045em;color:#102f34}.caption{margin:'+(compact?'7px':'12px')+' 0 0;color:#5b6b68;font-size:'+(compact?'11px':'18px')+';line-height:1.35}'+
 '.visual{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,.8fr);gap:'+(compact?'12px':'28px')+';align-items:center;margin-top:'+(compact?'15px':'28px')+';height:'+(compact?'210px':'455px')+'}'+
 '.page,.popup{min-width:0;max-height:100%;overflow:hidden;border:1px solid #d8dfda;border-radius:0;background:#fff;box-shadow:none}.page img{display:block;width:100%;height:'+(compact?'210px':'455px')+';object-fit:cover;object-position:top center}.popup{display:flex;justify-content:center;padding:'+(compact?'4px':'8px')+';background:#e9eee9}.popup img{display:block;width:100%;max-height:'+(compact?'202px':'438px')+';object-fit:contain;object-position:top center;border-radius:8px}'+
 '.footer{margin-top:'+(compact?'9px':'16px')+';color:#71817b;font-size:'+(compact?'8px':'12px')+';letter-spacing:.02em}'+
 '</style></head><body><main class="canvas"><div class="brand"><img src="'+appUri+'"><span>LUCH / BROWSER COMPANION</span></div><p class="eyebrow">YOUR TAB · YOUR PERMISSION</p><h1>'+heading+'</h1><p class="caption">'+caption+'</p><section class="visual"><div class="page"><img src="'+pageUri+'"></div><div class="popup"><img src="'+popupUri+'"></div></section><p class="footer">A local test fixture demonstrates the current candidate UI. Only a tab you approve is shared.</p></main></body></html>';
 const view=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
 await view.setContent(html,{waitUntil:'load'});
 await view.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
 await view.screenshot({path:path.join(output,name),fullPage:false});
 await view.close();
}
try{
 await renderSvg('chrome-small-promo-440x280.png',smallSvg,440,280);
 await renderSvg('chrome-marquee-1400x560.png',marqueeSvg,1400,560);
 const captures=[
  {suffix:'01-connect-browser',heading:'Connect your browser to LUCH',caption:'A supported local Companion and an authorized LUCH account are required.',popup:'popup-before-pair.png',page:'fixture-page-before-action.png'},
  {suffix:'02-read-first',heading:'Start with reading',caption:'Reading access is separate from permission to interact.',popup:'popup-read-approved.png',page:'fixture-page-before-action.png'},
  {suffix:'03-interaction',heading:'Allow interaction separately',caption:'Supported page actions require your additional approval.',popup:'popup-interaction-approved.png',page:'fixture-page-after-action.png'},
  {suffix:'04-revoke',heading:'Revoke access whenever you want',caption:'Close the tab, change website origin or revoke the grant.',popup:'popup-revoked.png',page:'fixture-page-after-action.png'}
 ];
 for(const item of captures){
  await compose('chrome-screenshot-'+item.suffix+'-1280x800.png',1280,800,item);
  await compose('opera-preview-'+item.suffix+'-612x408.png',612,408,item);
 }
 const iconInner=iconSvg.slice(iconSvg.indexOf('>')+1,iconSvg.lastIndexOf('</svg>'));
 const chromeIconSvg='<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><svg x="16" y="16" width="96" height="96" viewBox="0 0 128 128">'+iconInner+'</svg></svg>';
 await renderSvg('icon-ray-candidate-chrome-128.png',chromeIconSvg,128,128,true);
 await renderSvg('icon-ray-candidate-opera-128.png',iconSvg,128,128);
 for(const size of [48,32,16])await renderSvg('icon-ray-candidate-'+size+'.png',iconSvg,size,size);
 const manifest={
  candidate:'0.5.2',
  status:'DRAFT_HOLD',
  generatedAt:'CI runtime',
  sourceCaptures:requiredCaptures,
  chrome:{
   screenshots:captures.map(x=>'chrome-screenshot-'+x.suffix+'-1280x800.png'),
   smallPromo:'chrome-small-promo-440x280.png',
   marquee:'chrome-marquee-1400x560.png'
  },
  opera:{
   previewsOnly:captures.map(x=>'opera-preview-'+x.suffix+'-612x408.png'),
   runtimeVerified:false
  },
  iconCandidate:{
   svg:'extension-icon-ray-candidate.svg',
   pngSizes:[128,48,32,16],
   approved:false,
   includedInExtensionManifest:false
  }
 };
 await fs.writeFile(path.join(output,'assets-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 const names=(await fs.readdir(output)).sort();
 for(const name of names){
  const stat=await fs.stat(path.join(output,name));
  if(stat.isFile())console.log(name+' '+stat.size+' bytes');
 }
}finally{await browser.close()}
