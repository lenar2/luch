'use strict';
/* Loopback-only R128 frontend preview. Proxies only the three R128 endpoints. */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const ROOT='/srv/factory-scratch/bf2026-r128-frontend-isolated-20261119/www';
const UPSTREAM='http://127.0.0.1:18774';
const ORIGIN='https://wf.tati-lar.ru';
const HOST='127.0.0.1';
const PORT=18775;
const MAX=2048;
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png',
 '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
function send(res,status,body,headers={}){
 if(res.headersSent)return;
 res.writeHead(status,{'cache-control':'no-store','x-content-type-options':'nosniff',
  'x-robots-tag':'noindex,nofollow',...headers});res.end(body);
}
async function body(req){
 const parts=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>MAX)throw Error('BODY_TOO_LARGE');parts.push(chunk)}
 return Buffer.concat(parts);
}
function safeFile(urlPath){
 let decoded;try{decoded=decodeURIComponent(urlPath)}catch{return null}
 if(decoded.includes('\0')||decoded.includes('\\'))return null;
 const relative=decoded==='/'?'index.html':decoded.replace(/^\/+/,'');
 const full=path.resolve(ROOT,relative);
 return full===ROOT||full.startsWith(ROOT+path.sep)?full:null;
}
function createPreviewServer(){
 return http.createServer(async(req,res)=>{
  try{
   const u=new URL(req.url,'http://localhost');
   if(u.search||u.hash)return send(res,404,'NOT_FOUND');
   if(u.pathname.startsWith('/api/checkout/consent/')){
    const allow={
     'GET /api/checkout/consent/status':true,
     'POST /api/checkout/consent/session':true,
     'POST /api/checkout/consent/challenge':true
    };
    if(!allow[req.method+' '+u.pathname])return send(res,404,'NOT_FOUND');
    let payload;
    const headers={origin:ORIGIN};
    if(req.headers.cookie)headers.cookie=req.headers.cookie;
    if(req.method==='POST'&&u.pathname.endsWith('/challenge')){
     headers['content-type']='application/json';
     payload=await body(req);
    }else if(req.method==='POST'&&
      (req.headers['content-type']!==undefined||req.headers['transfer-encoding']||
       Number(req.headers['content-length']||0)>0)){
     return send(res,415,'BODY_FORBIDDEN');
    }
    const upstream=await fetch(UPSTREAM+u.pathname,{method:req.method,headers,
     body:payload,redirect:'error'});
    const responseHeaders={'content-type':upstream.headers.get('content-type')||
      'application/json; charset=utf-8'};
    for(const name of ['cache-control','pragma','x-content-type-options','x-robots-tag','referrer-policy'])
     if(upstream.headers.get(name))responseHeaders[name]=upstream.headers.get(name);
    const cookie=upstream.headers.get('set-cookie');if(cookie)responseHeaders['set-cookie']=cookie;
    return send(res,upstream.status,await upstream.text(),responseHeaders);
   }
   if(req.method!=='GET')return send(res,405,'METHOD_NOT_ALLOWED');
   const file=safeFile(u.pathname);
   if(!file||!fs.existsSync(file)||!fs.statSync(file).isFile())return send(res,404,'NOT_FOUND');
   return send(res,200,fs.readFileSync(file),{'content-type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});
  }catch(e){
   return send(res,503,JSON.stringify({ok:false,code:'R128_PREVIEW_FAIL_CLOSED'}),{'content-type':'application/json; charset=utf-8'});
  }
 });
}
if(require.main===module){
 if(process.env.BF2026_R128_PREVIEW_ONLY!=='1')throw Error('R128_PREVIEW_FLAG_REQUIRED');
 if(!fs.existsSync(path.join(ROOT,'index.html')))throw Error('R128_PREVIEW_FRONTEND_MISSING');
 const server=createPreviewServer();
 server.listen(PORT,HOST,()=>process.stdout.write('R128_PREVIEW_LISTENING '+HOST+':'+PORT+'\n'));
}
module.exports={ROOT,UPSTREAM,HOST,PORT,createPreviewServer};
