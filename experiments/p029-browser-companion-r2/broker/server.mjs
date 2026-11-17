import http from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';

const MAX_BODY=700_000, MAX_GRANTS=20, SESSION_IDLE_MS=120_000;
// The heartbeat is an internal live-connection check, not a user permission expiry.
const READ_OPS=new Set(['read_text','inspect_page','get_links','get_headings','get_forms','get_tables','get_selection','query_elements','find_text','accessibility_snapshot','hit_test','get_element','scroll_position','screenshot','tab_info','window_info']);
const INTERACT_OPS=new Set(['focus','hover','scroll_into_view','scroll','scroll_to','fill','insert_text','type_text','select_option','check_element','click','click_at','double_click','click_accessible','navigate','reload','back','forward','activate_tab','close_tab','new_tab','new_window','window_set']);
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
 let currentPairCode=code;
let pairHash=hash(code),pairUntil=clock()+5*60_000,failed=0,session=null,sessionLastSeen=0,extensionOrigin=null;
const setupCsrf=randomBytes(24).toString('hex');
const setupOrigin='http://127.0.0.1:'+port;
const pairStatus=()=>({paired:!!session,ready:!session&&pairHash!==null&&clock()<=pairUntil&&failed<6});
const page=(language='en')=>{
 const ru=language==='ru';
 const copy=ru?{
  title:'Подключите браузер к LUCH',
  intro:'Создайте одноразовый код на этом компьютере и введите его в расширении LUCH Browser Companion.',
  generate:'Создать код подключения',
  waiting:'Код ещё не создан.',
  note:'Код действует пять минут и подключает только этот браузер к локальному Companion. Он не устанавливает приложение и не авторизует ИИ-клиент.',
  done:'Код создан. Вернитесь в расширение и введите восемь цифр.',
  failed:'Не удалось создать код. Обновите страницу и попробуйте снова.',
  offline:'Companion недоступен.',
  paired:'Этот Companion уже подключён. Сначала отключите браузер в расширении.'
 }:{
  title:'Connect your browser to LUCH',
  intro:'Generate a one-time code on this computer, then enter it in the LUCH Browser Companion extension.',
  generate:'Generate pairing code',
  waiting:'No code has been generated yet.',
  note:'The code expires after five minutes and pairs this browser with the local Companion only. It does not install the desktop app or authorize an AI host.',
  done:'Code created. Return to the extension and enter the eight digits.',
  failed:'Could not generate a code. Refresh this page and try again.',
  offline:'Companion is unavailable.',
  paired:'This Companion is already paired. Disconnect the browser in the extension first.'
 };
 return [
  '<!doctype html><html lang="'+language+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>LUCH Companion · Connect</title>',
  '<style>:root{color-scheme:light;--ink:#102f34;--muted:#5a6a69;--line:#d8dfda;--accent:#d6ad73}*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:28px 18px;background:radial-gradient(ellipse at 50% 0%,#dce9e3 0%,#f7f6f0 58%,#f1eee5 100%);color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;display:grid;place-items:center}.card{width:min(100%,520px);padding:30px;border:1px solid var(--line);border-radius:20px;background:rgba(255,255,255,.94);box-shadow:0 18px 60px rgba(16,47,52,.08)}.brand{font-size:17px;font-weight:800;letter-spacing:.12em}.brand span{display:block;margin-top:2px;color:var(--muted);font-size:11px;font-weight:500;letter-spacing:.02em}.eyebrow{margin:28px 0 7px;color:#66817e;font-size:10px;font-weight:800;letter-spacing:.16em}.card h1{margin:0 0 10px;font-size:30px;line-height:1.12;letter-spacing:-.04em}.intro{margin:0;color:var(--muted)}button{margin-top:22px;padding:13px 18px;border:0;border-radius:10px;background:#143c43;color:#fff;font:inherit;font-weight:700;cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}button:focus-visible{outline:3px solid #d6ad73;outline-offset:3px}output{display:block;min-height:54px;margin-top:20px;color:#143c43;font-size:36px;font-weight:750;letter-spacing:.22em;font-variant-numeric:tabular-nums}#status{min-height:22px;margin:4px 0 0;color:#47615e;font-size:13px}.note{margin-top:24px;padding:13px 15px;border-left:3px solid var(--accent);border-radius:0 9px 9px 0;background:#f6f1e8;color:#596460;font-size:12px}.fine{margin-top:20px;color:#788581;font-size:11px}</style></head><body>',
  '<main class="card"><div class="brand">LUCH<span>Browser Companion · Local setup</span></div><p class="eyebrow">LUCH / CONNECT</p><h1>'+copy.title+'</h1><p class="intro">'+copy.intro+'</p>',
  '<button id="generate" type="button" '+(session?'disabled':'')+'>'+copy.generate+'</button><output id="code" aria-label="'+(ru?'Код подключения':'Pairing code')+'"></output><p id="status" role="status" aria-live="polite">'+(session?copy.paired:copy.waiting)+'</p>',
  '<div class="note">'+copy.note+'</div><p class="fine">'+(ru?'Не вводите здесь пароли от сайтов.':'Never enter website passwords here.')+'</p></main>',
  '<script>const csrf='+JSON.stringify(setupCsrf)+';const copy='+JSON.stringify(copy)+';const button=document.getElementById("generate");button.addEventListener("click",async()=>{button.disabled=true;const status=document.getElementById("status"),code=document.getElementById("code");status.textContent="";code.textContent="";try{const response=await fetch("/setup/code",{method:"POST",headers:{"Content-Type":"application/json","X-LUCH-Setup-CSRF":csrf},body:"{}"});const data=await response.json();if(!response.ok||!data.ok){status.textContent=data.error==="ALREADY_PAIRED"?copy.paired:copy.failed;button.disabled=data.error==="ALREADY_PAIRED";return}code.textContent=data.code;status.textContent=copy.done}catch{status.textContent=copy.offline;button.disabled=false}});</script>',
  '</body></html>'
 ].join('');
};
 const grants=new Map(),jobs=new Map(),pending=new Map();
 const grantedTabs=()=>session&&clock()-sessionLastSeen<SESSION_IDLE_MS?[...grants.values()]:[];
 function bridgeAuth(req){const raw=req.headers['x-browser-bridge-token'];return typeof raw==='string'&&equals(secretHash,hash(raw));}
 function extensionAuth(req){const raw=req.headers.authorization||'';const token=/^Bearer ([A-Za-z0-9_-]{24,})$/.exec(raw);
 const ok=session&&token&&equals(session,hash(token[1]))&&(req.headers.origin===extensionOrigin||(req.method==='GET'&&!req.headers.origin));
 if(ok)sessionLastSeen=clock();
 return !!ok;
}
 function extensionReq(req){return /^chrome-extension:\/\/[a-p]{32}$/.test(String(req.headers.origin||''))}
 function settle(jobId,result){const r=pending.get(jobId);if(r){pending.delete(jobId);clearTimeout(r.timer);r.resolve(result)}}
 const server=http.createServer(async(req,res)=>{
  const origin=extensionReq(req)?req.headers.origin:'';
  const url=new URL(req.url,`http://${host}:${port}`);
if(req.headers.host!==('127.0.0.1:'+port))return json(res,403,errorCode('INVALID_HOST'));
if(req.method==='GET'&&url.pathname==='/setup'){
const language=/^\s*ru(?:[-,;]|$)/i.test(String(req.headers['accept-language']||''))?'ru':'en';
res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(page(language));return;
}
if(req.method==='POST'&&url.pathname==='/setup/code'){
if(req.headers.origin!==setupOrigin||req.headers['x-luch-setup-csrf']!==setupCsrf||req.headers['content-type']!=='application/json')return json(res,403,errorCode('SETUP_ORIGIN_DENIED'));
if(session)return json(res,409,errorCode('ALREADY_PAIRED'));
currentPairCode=String(randomBytes(4).readUInt32BE()%100_000_000).padStart(8,'0');pairHash=hash(currentPairCode);pairUntil=clock()+5*60_000;failed=0;
return json(res,200,{ok:true,code:currentPairCode,validForSeconds:300});
}
  if(req.method==='OPTIONS'){
   if(!origin)return json(res,403,errorCode('EXTENSION_ORIGIN_REQUIRED'));
   res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'120','Cache-Control':'no-store'});res.end();return;
  }
  try{
   if(req.method==='GET'&&url.pathname==='/health'){
    if(req.headers.authorization&&!extensionAuth(req))return json(res,403,errorCode('EXTENSION_NOT_AUTHORIZED'),origin);
    return json(res,200,{ok:true,service:'luch-browser-companion-broker',paired:!!session,authorizedTabs:grantedTabs().length},origin);
   }
   if(req.method==='POST'&&url.pathname==='/pair'){
    if(!origin)return json(res,403,errorCode('EXTENSION_ORIGIN_REQUIRED'));
    if(!pairHash||clock()>pairUntil||failed>=6)return json(res,403,errorCode('PAIRING_UNAVAILABLE'),origin);
    const {code:provided}=await readJSON(req);if(typeof provided!=='string'||!equals(hash(provided),pairHash)){failed++;return json(res,403,errorCode('PAIRING_DENIED'),origin)}
    // One code is one extension session. A new pairing requires an explicit local broker restart.
    pairHash=null;extensionOrigin=origin;
    // Generate the token outside the hash to avoid persisting it.
    const token=randomBytes(32).toString('base64url');session=hash(token);sessionLastSeen=clock();
    grants.clear();return json(res,200,{ok:true,token},origin);
   }
   if(url.pathname.startsWith('/extension/')){
    if(!extensionAuth(req))return json(res,403,errorCode('EXTENSION_NOT_AUTHORIZED'),origin);
    if(req.method==='POST'&&url.pathname==='/extension/disconnect'){
      grants.clear();for(const [jobId] of jobs){jobs.delete(jobId);settle(jobId,errorCode('OWNER_DISCONNECTED'))}
      session=null;sessionLastSeen=0;extensionOrigin=null;
      return json(res,200,{ok:true,disconnected:true},origin);
    }
    if(req.method==='POST'&&url.pathname==='/extension/grants'){
     const body=await readJSON(req);if(!Array.isArray(body.grants)||body.grants.length>MAX_GRANTS)return json(res,400,errorCode('INVALID_GRANTS'),origin);
     const next=new Map();
     for(const g of body.grants){
      if(!Number.isSafeInteger(g.tabId)||g.tabId<0||!/^[a-f0-9]{24}$/.test(g.grantId||''))return json(res,400,errorCode('INVALID_GRANT'),origin);
      const url=cleanUrl(g.url);if(!url||!['read','interact'].includes(g.scope||'read'))return json(res,400,errorCode('INVALID_GRANT'),origin);
      next.set(`ext:${g.tabId}:${g.grantId}`,{targetId:`ext:${g.tabId}:${g.grantId}`,url,title:String(g.title||'').slice(0,180),tabId:g.tabId,grantId:g.grantId,scope:g.scope||'read'});
     }
     grants.clear();for(const [k,v] of next)grants.set(k,v);
     for(const [jobId,job] of jobs){if(!grants.has(job.targetId)){jobs.delete(jobId);settle(jobId,errorCode('GRANT_REVOKED'))}}
     return json(res,200,{ok:true,count:grantedTabs().length},origin);
    }
    if(req.method==='GET'&&url.pathname==='/extension/jobs'){
     const out=[...jobs.values()].filter(j=>!j.delivered).slice(0,3);for(const j of out)j.delivered=true;return json(res,200,{ok:true,jobs:out},origin);
    }
    if(req.method==='POST'&&url.pathname==='/extension/result'){
     const {jobId,result}=await readJSON(req);if(typeof jobId!=='string'||!jobs.has(jobId))return json(res,404,errorCode('JOB_NOT_FOUND'),origin);
     const job=jobs.get(jobId);jobs.delete(jobId);
     if(!grantedTabs().some(g=>g.targetId===job.targetId)){settle(jobId,errorCode('GRANT_REVOKED'));return json(res,403,errorCode('GRANT_REVOKED'),origin)}
     if(!result||typeof result.ok!=='boolean')return json(res,400,errorCode('INVALID_RESULT'),origin);
     let data=null;
     if(result.ok&&result.data!==undefined){
      const serialized=JSON.stringify(result.data);
      if(serialized.length>560000)return json(res,413,errorCode('RESULT_TOO_LARGE'),origin);
      data=result.data;
     }
     const safe=result.ok?{ok:true,text:String(result.text||'').slice(0,65536),title:String(result.title||'').slice(0,180),data}:errorCode(String(result.error||'EXECUTION_FAILED').slice(0,80));
     settle(jobId,safe);return json(res,200,{ok:true},origin);
    }
    return json(res,404,errorCode('UNKNOWN_EXTENSION_ROUTE'),origin);
   }
   if(url.pathname.startsWith('/v1/')){
    if(!bridgeAuth(req))return json(res,403,errorCode('BRIDGE_AUTH_REQUIRED'));
    if(req.method==='GET'&&url.pathname==='/v1/tabs')return json(res,200,{ok:true,browser:'chrome',profileScope:'USER_CONSENTED_TABS_ONLY',nativeSessionAttached:!!session,tabs:grantedTabs().map(g=>({id:g.targetId,title:g.title,url:g.url,type:'page',attached:true,readOnly:g.scope!=='interact',scope:g.scope,transport:'luch_browser_companion',profileKind:'USER_CONSENTED_TAB',sessionScoped:true}))});
    if(req.method==='GET'&&url.pathname==='/v1/capabilities')
      return json(res,200,{ok:true,profileScope:'USER_CONSENTED_TABS_ONLY',read:[...READ_OPS],interact:[...INTERACT_OPS],sessionScoped:true});
    if(req.method==='POST'&&(url.pathname==='/v1/text'||url.pathname==='/v1/action')){
     const body=await readJSON(req);
     const {targetId}=body;
     const legacyText=url.pathname==='/v1/text';
     const op=legacyText?'read_text':String(body.op||'');
     if(!READ_OPS.has(op)&&!INTERACT_OPS.has(op))return json(res,400,errorCode('ACTION_NOT_ALLOWED'));
     if(legacyText&&body.selector!==undefined&&body.selector!=='body')return json(res,400,errorCode('SELECTOR_NOT_AVAILABLE'));
     const grant=grants.get(targetId);
     if(!grant||!grantedTabs().some(g=>g.targetId===targetId))return json(res,403,errorCode('USER_TAB_PERMISSION_REQUIRED'));
     if(INTERACT_OPS.has(op)&&grant.scope!=='interact')return json(res,403,errorCode('INTERACTION_APPROVAL_REQUIRED'));
     const args=legacyText?{}:body.args;
     if(args!==undefined&&(typeof args!=='object'||args===null||Array.isArray(args)))return json(res,400,errorCode('INVALID_ACTION_ARGS'));
     if(JSON.stringify(args||{}).length>30000)return json(res,400,errorCode('ACTION_ARGS_TOO_LARGE'));
     if(pending.size>=8)return json(res,429,errorCode('BUSY'));
     const id=randomBytes(12).toString('hex');
     const job={id,targetId,kind:legacyText?'read_text':'action',op,args:args||{},delivered:false};
     jobs.set(id,job);
     const result=await new Promise(resolve=>{
      const timer=setTimeout(()=>{pending.delete(id);jobs.delete(id);resolve(errorCode('BROWSER_COMPANION_TIMEOUT'))},11000);
      pending.set(id,{resolve,timer});
     });
     return json(res,result.ok?200:403,result.ok?{ok:true,text:result.text,title:result.title,data:result.data,source:'USER_CONSENTED_TAB'}:result);
    }
    return json(res,404,errorCode('UNKNOWN_BRIDGE_ROUTE'));
   }
   json(res,404,errorCode('NOT_FOUND'),origin);
  }catch(e){json(res,400,errorCode(String(e.message||'REQUEST_INVALID').slice(0,80)),origin)}
 });
 return {server,get pairingCode(){return currentPairCode},pairStatus,listen:()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.removeListener('error',reject);resolve()})}),close:()=>new Promise(r=>server.close(r)),grantedTabs};
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
 const tokenFile=process.env.LUCH_BRIDGE_TOKEN_FILE;
 if(!tokenFile||!existsSync(tokenFile))throw new Error('Set LUCH_BRIDGE_TOKEN_FILE to an existing private bridge token file');
 const bridgeToken=readFileSync(tokenFile,'utf8').trim();
 const broker=createBroker({bridgeToken,port:Number(process.env.LUCH_COMPANION_PORT||9248)});
 await broker.listen();
 console.log('LUCH Browser Companion broker on 127.0.0.1 (private)');
 if(process.env.LUCH_COMPANION_DEBUG_PAIR_CODE==='1')console.log('DEBUG pairing code: '+broker.pairingCode);
}
