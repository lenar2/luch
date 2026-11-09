import http from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';

const MAX_BODY=160_000, MAX_GRANTS=20, TTL=15*60_000;
const hash=s=>createHash('sha256').update(String(s)).digest();
const equals=(a,b)=>a.length===b.length&&timingSafeEqual(a,b);
const json=(res,status,body,origin='')=>{
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(origin)headers['Access-Control-Allow-Origin']=origin;
  res.writeHead(status,headers);res.end(JSON.stringify(body));
};
function errorCode(code){return {ok:false,error:code}}
const cleanUrl=s=>{try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}};
function readJSON(req){return new Promise((resolve,reject)=>{
 let chunks=[],bytes=0;req.on('data',c=>{bytes+=c.length;if(bytes>MAX_BODY){reject(new Error('BODY_TOO_LARGE'));req.destroy();}else chunks.push(c)});
 req.on('end',()=>{try{const s=Buffer.concat(chunks).toString('utf8');resolve(JSON.parse(s||'{}'))}catch{reject(new Error('INVALID_JSON'))}});req.on('error',reject);
});}
export function createBroker({bridgeToken,pairingCode,port=9248,host='127.0.0.1',clock=()=>Date.now()}={}){
 if(!bridgeToken||String(bridgeToken).length<24)throw new Error('BRIDGE_TOKEN_REQUIRED');
 const secretHash=hash(String(bridgeToken));
 const code=pairingCode||String(randomBytes(4).readUInt32BE()%100_000_000).padStart(8,'0');
 if(!/^\d{8}$/.test(code))throw new Error('PAIR_CODE_INVALID');
 let pairHash=hash(code),pairUntil=clock()+5*60_000,failed=0,session=null,extensionOrigin=null;
 const grants=new Map(),jobs=new Map(),pending=new Map();
 const grantedTabs=()=>[...grants.values()].filter(g=>g.expiresAt>clock());
 function bridgeAuth(req){const raw=req.headers['x-browser-bridge-token'];return typeof raw==='string'&&equals(secretHash,hash(raw));}
 function extensionAuth(req){const raw=req.headers.authorization||'';const token=/^Bearer ([A-Za-z0-9_-]{24,})$/.exec(raw);return session&&token&&equals(session,hash(token[1]))&&(req.headers.origin===extensionOrigin||(req.method==='GET'&&!req.headers.origin));}
 function extensionReq(req){return /^chrome-extension:\/\/[a-p]{32}$/.test(String(req.headers.origin||''))}
 function settle(jobId,result){const r=pending.get(jobId);if(r){pending.delete(jobId);clearTimeout(r.timer);r.resolve(result)}}
 const server=http.createServer(async(req,res)=>{
  const origin=extensionReq(req)?req.headers.origin:'';
  const url=new URL(req.url,`http://${host}:${port}`);
  if(req.method==='OPTIONS'){
   if(!origin)return json(res,403,errorCode('EXTENSION_ORIGIN_REQUIRED'));
   res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'120','Cache-Control':'no-store'});res.end();return;
  }
  try{
   if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,service:'luch-browser-companion-broker',paired:!!session,authorizedTabs:grantedTabs().length});
   if(req.method==='POST'&&url.pathname==='/pair'){
    if(!origin)return json(res,403,errorCode('EXTENSION_ORIGIN_REQUIRED'));
    if(!pairHash||clock()>pairUntil||failed>=6)return json(res,403,errorCode('PAIRING_UNAVAILABLE'),origin);
    const {code:provided}=await readJSON(req);if(typeof provided!=='string'||!equals(hash(provided),pairHash)){failed++;return json(res,403,errorCode('PAIRING_DENIED'),origin)}
    // One code is one extension session. A new pairing requires an explicit local broker restart.
    pairHash=null;extensionOrigin=origin;
    // Generate the token outside the hash to avoid persisting it.
    const token=randomBytes(32).toString('base64url');session=hash(token);
    grants.clear();return json(res,200,{ok:true,token},origin);
   }
   if(url.pathname.startsWith('/extension/')){
    if(!extensionAuth(req))return json(res,403,errorCode('EXTENSION_NOT_AUTHORIZED'),origin);
    if(req.method==='POST'&&url.pathname==='/extension/disconnect'){
      grants.clear();for(const [jobId] of jobs){jobs.delete(jobId);settle(jobId,errorCode('OWNER_DISCONNECTED'))}
      session=null;extensionOrigin=null;
      return json(res,200,{ok:true,disconnected:true},origin);
    }
    if(req.method==='POST'&&url.pathname==='/extension/grants'){
     const body=await readJSON(req);if(!Array.isArray(body.grants)||body.grants.length>MAX_GRANTS)return json(res,400,errorCode('INVALID_GRANTS'),origin);
     const next=new Map();
     for(const g of body.grants){
      if(!Number.isSafeInteger(g.tabId)||g.tabId<0||!/^[a-f0-9]{24}$/.test(g.grantId||''))return json(res,400,errorCode('INVALID_GRANT'),origin);
      const url=cleanUrl(g.url);if(!url||!Number.isFinite(g.expiresAt)||g.expiresAt<=clock()||g.expiresAt>clock()+TTL+10_000)return json(res,400,errorCode('INVALID_GRANT'),origin);
      next.set(`ext:${g.tabId}:${g.grantId}`,{targetId:`ext:${g.tabId}:${g.grantId}`,url,title:String(g.title||'').slice(0,180),tabId:g.tabId,grantId:g.grantId,expiresAt:g.expiresAt});
     }
     grants.clear();for(const [k,v] of next)grants.set(k,v);
     for(const [jobId,job] of jobs){if(!grants.has(job.targetId)){jobs.delete(jobId);settle(jobId,errorCode('GRANT_REVOKED'))}}
     return json(res,200,{ok:true,count:grantedTabs().length},origin);
    }
    if(req.method==='GET'&&url.pathname==='/extension/jobs'){
     const out=[...jobs.values()].slice(0,3);return json(res,200,{ok:true,jobs:out},origin);
    }
    if(req.method==='POST'&&url.pathname==='/extension/result'){
     const {jobId,result}=await readJSON(req);if(typeof jobId!=='string'||!jobs.has(jobId))return json(res,404,errorCode('JOB_NOT_FOUND'),origin);
     const job=jobs.get(jobId);jobs.delete(jobId);
     if(!grants.has(job.targetId)||grants.get(job.targetId).expiresAt<=clock()){settle(jobId,errorCode('GRANT_REVOKED'));return json(res,403,errorCode('GRANT_REVOKED'),origin)}
     if(!result||typeof result.ok!=='boolean')return json(res,400,errorCode('INVALID_RESULT'),origin);
     const safe=result.ok?{ok:true,text:String(result.text||'').slice(0,65536),title:String(result.title||'').slice(0,180)}:errorCode(String(result.error||'EXECUTION_FAILED').slice(0,80));
     settle(jobId,safe);return json(res,200,{ok:true},origin);
    }
    return json(res,404,errorCode('UNKNOWN_EXTENSION_ROUTE'),origin);
   }
   if(url.pathname.startsWith('/v1/')){
    if(!bridgeAuth(req))return json(res,403,errorCode('BRIDGE_AUTH_REQUIRED'));
    if(req.method==='GET'&&url.pathname==='/v1/tabs')return json(res,200,{ok:true,browser:'chrome',profileScope:'USER_CONSENTED_TABS_ONLY',nativeSessionAttached:!!session,tabs:grantedTabs().map(g=>({id:g.targetId,title:g.title,url:g.url,type:'page',attached:true,readOnly:true,transport:'luch_browser_companion',profileKind:'USER_CONSENTED_TAB',expiresAt:g.expiresAt}))});
    if(req.method==='POST'&&url.pathname==='/v1/text'){
     const {targetId,selector='body'}=await readJSON(req);
     if(selector!=='body')return json(res,400,errorCode('SELECTOR_NOT_AVAILABLE'));
     const grant=grants.get(targetId);if(!grant||grant.expiresAt<=clock())return json(res,403,errorCode('USER_TAB_PERMISSION_REQUIRED'));
     // Bound duration and pending jobs prevent an extension from creating unbounded work.
     if(pending.size>=8)return json(res,429,errorCode('BUSY'));
     const id=randomBytes(12).toString('hex');const job={id,targetId,kind:'read_text'};jobs.set(id,job);
     const result=await new Promise(resolve=>{const timer=setTimeout(()=>{pending.delete(id);jobs.delete(id);resolve(errorCode('BROWSER_COMPANION_TIMEOUT'))},11000);pending.set(id,{resolve,timer})});
     return json(res,result.ok?200:403,result.ok?{ok:true,text:result.text,title:result.title,source:'USER_CONSENTED_TAB'}:result);
    }
    return json(res,404,errorCode('UNKNOWN_BRIDGE_ROUTE'));
   }
   json(res,404,errorCode('NOT_FOUND'),origin);
  }catch(e){json(res,400,errorCode(String(e.message||'REQUEST_INVALID').slice(0,80)),origin)}
 });
 return {server,pairingCode:code,listen:()=>new Promise(r=>server.listen(port,host,r)),close:()=>new Promise(r=>server.close(r)),grantedTabs};
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
 const tokenFile=process.env.LUCH_BRIDGE_TOKEN_FILE;
 if(!tokenFile||!existsSync(tokenFile))throw new Error('Set LUCH_BRIDGE_TOKEN_FILE to an existing private bridge token file');
 const bridgeToken=readFileSync(tokenFile,'utf8').trim();
 const broker=createBroker({bridgeToken,port:Number(process.env.LUCH_COMPANION_PORT||9248)});
 await broker.listen();
 console.log('LUCH Browser Companion broker on 127.0.0.1 (private)');
 console.log('Pairing code (valid 5 minutes; show only to the owner): '+broker.pairingCode);
}
