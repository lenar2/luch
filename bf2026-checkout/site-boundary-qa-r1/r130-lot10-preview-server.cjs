'use strict';
/* R130 separate preview server: only localhost assets and 1 read-only
 * dynamic Set-plan proxy. No GetCourse API or payment path exposed.
 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const ROOT='/srv/factory-scratch/bf2026-r130-lot10-frontend-20261119/www';
const UPSTREAM='http://127.0.0.1:18776';
const HOST='127.0.0.1',PORT=18777;
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png',
 '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
function send(res,status,body,headers={}){
 if(res.headersSent)return;
 res.writeHead(status,{'cache-control':'no-store','x-content-type-options':'nosniff',
 'x-robots-tag':'noindex,nofollow',...headers});res.end(body);
}
async function read(req){
 let size=0,buf=[];
 for await(const c of req){size+=c.length;if(size>2048)throw Error('BODY_TOO_LARGE');buf.push(c)}
 return Buffer.concat(buf);
}
function createPreviewServer(){
 return http.createServer(async(req,res)=>{
  try{
   const u=new URL(req.url,'http://localhost');
   if(u.search&&u.pathname!=='/assets/lot10-set/index.html')return send(res,404,'NOT_FOUND');
   if(req.method==='POST'&&u.pathname==='/api/checkout/set/plan'){
    const data=await read(req);
    const r=await fetch(UPSTREAM+u.pathname,{method:'POST',redirect:'error',
     headers:{origin:'https://wf.tati-lar.ru','content-type':'application/json'},
     body:data});
    return send(res,r.status,await r.text(),
     {'content-type':'application/json; charset=utf-8'});
   }
   if(req.method==='GET'&&u.pathname==='/api/checkout/set/status'){
    const r=await fetch(UPSTREAM+u.pathname,{redirect:'error'});
    return send(res,r.status,await r.text(),
     {'content-type':'application/json; charset=utf-8'});
   }
   if(req.method!=='GET')return send(res,405,'METHOD_NOT_ALLOWED');
   let decoded;
   try{decoded=decodeURIComponent(u.pathname)}catch{return send(res,404,'NOT_FOUND')}
   if(decoded.includes('\0')||decoded.includes('\\'))return send(res,404,'NOT_FOUND');
   const filename=path.resolve(ROOT,decoded==='/'?'index.html':decoded.replace(/^\/+/,''));
   if(!filename.startsWith(ROOT+path.sep))return send(res,404,'NOT_FOUND');
   if(!fs.existsSync(filename)||!fs.statSync(filename).isFile())
    return send(res,404,'NOT_FOUND');
   return send(res,200,fs.readFileSync(filename),
    {'content-type':MIME[path.extname(filename).toLowerCase()]||'application/octet-stream'});
  }catch{return send(res,503,JSON.stringify({ok:false,code:'R130_PREVIEW_UNAVAILABLE'}),
   {'content-type':'application/json; charset=utf-8'})}
 });
}
if(require.main===module){
 if(process.env.BF2026_R130_PREVIEW_ONLY!=='1')
  throw Error('R130_PREVIEW_ONLY_REQUIRED');
 if(!fs.existsSync(path.join(ROOT,'assets/lot10-set/index.html')))
  throw Error('R130_PREVIEW_FRONTEND_NOT_INITIALIZED');
 createPreviewServer().listen(PORT,HOST,()=>console.log('R130_LOT10_PREVIEW_LISTEN '+PORT));
}
module.exports={ROOT,UPSTREAM,createPreviewServer};
