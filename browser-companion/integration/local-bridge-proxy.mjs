import http from 'node:http';
import {timingSafeEqual,createHash} from 'node:crypto';

const MAX_BODY = 160_000;
const TIMEOUT = 9000;
const hash = s => createHash('sha256').update(String(s)).digest();
const equal = (a,b) => a.length === b.length && timingSafeEqual(a,b);
const validLoopback = input => {
  const url = new URL(input);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' ||
    url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('ONLY_LOOPBACK_HTTP_ENDPOINTS_ALLOWED');
  }
  return url.origin;
};
const send = (res,status,value) => {
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(JSON.stringify(value));
};
function boundedBody(req) {
  return new Promise((resolve,reject)=>{
    const chunks=[]; let length=0;
    req.on('data',part=>{
      length+=part.length;
      if(length>MAX_BODY){reject(new Error('BODY_TOO_LARGE'));req.destroy();}
      else chunks.push(part);
    });
    req.on('end',()=>{
      try {
        const raw=Buffer.concat(chunks).toString('utf8');
        resolve({raw,body:JSON.parse(raw||'{}')});
      } catch {reject(new Error('INVALID_JSON'))}
    });
    req.on('error',reject);
  });
}
export function createLuchBrowserBridgeProxy({
 bridgeToken,upstream='http://127.0.0.1:9240',companion='http://127.0.0.1:9248',
 host='127.0.0.1',port=9251,fetchImpl=fetch,
}={}) {
  if(typeof bridgeToken!=='string'||bridgeToken.length<24)throw new Error('BRIDGE_TOKEN_REQUIRED');
  if(host!=='127.0.0.1')throw new Error('LOOPBACK_REQUIRED');
  const upstreamUrl=validLoopback(upstream+'/');
  const companionUrl=validLoopback(companion+'/');
  if(upstreamUrl===companionUrl)throw new Error('PROXY_TARGETS_MUST_BE_DISTINCT');
  const secretHash=hash(bridgeToken);
  const auth=req=>typeof req.headers['x-browser-bridge-token']==='string' &&
    equal(secretHash,hash(req.headers['x-browser-bridge-token']));
  const upstreamFetch=async(base,pathname,method='GET',payload)=>{
    const ctl=new AbortController();
    const limit=base===companionUrl?(pathname==='/v1/text'?13500:1300):TIMEOUT;
    const timer=setTimeout(()=>ctl.abort(),limit);
    try{
      const result=await fetchImpl(base+pathname,{
        method,
        headers:{'x-browser-bridge-token':bridgeToken,...(payload===undefined?{}:{'content-type':'application/json'})},
        body:payload,signal:ctl.signal,redirect:'error'
      });
      const raw=await result.text();
      let body;try{body=JSON.parse(raw)}catch{throw new Error('NON_JSON_BRIDGE_RESULT')}
      return {status:result.status,body};
    }finally{clearTimeout(timer)}
  };
  const companionStatus=async()=> {
    try {
      const r=await upstreamFetch(companionUrl,'/v1/tabs');
      if(r.status!==200||!r.body?.ok||!Array.isArray(r.body.tabs))return {available:false,reason:'COMPANION_NOT_AVAILABLE',tabs:[]};
      return {available:true,paired:Boolean(r.body.nativeSessionAttached),tabs:r.body.tabs};
    }catch{return {available:false,reason:'COMPANION_NOT_AVAILABLE',tabs:[]}}
  };
  const server=http.createServer(async(req,res)=>{
    try {
      const target=new URL(req.url,'http://127.0.0.1:'+port);
      if(req.method==='GET'&&target.pathname==='/health'){
        return send(res,200,{ok:true,service:'LUCH Browser Companion Local Router',schema:'luch.browser-companion-router.v1',production:false});
      }
      if(!auth(req))return send(res,401,{ok:false,error:'BRIDGE_AUTH_REQUIRED'});
      if(req.method==='GET'&&target.pathname==='/v1/tabs'&&target.searchParams.get('browser')==='chrome'){
        const [base,consent]=await Promise.all([
          upstreamFetch(upstreamUrl,'/v1/tabs?browser=chrome').catch(()=>null),companionStatus()
        ]);
        if((!base||base.status!==200||!base.body?.ok)&&!consent.available)
          return send(res,503,{ok:false,error:'LOCAL_BROWSER_AND_COMPANION_UNAVAILABLE'});
        // Never leak titles/URLs of *ungranted* native-user windows exposed by older
        // Bridge native fallbacks. The only user-owned tabs admitted here come
        // from the Companion broker's current, revocable grant list.
        const isolated=(base?.body?.ok?(base.body.tabs||[]):[])
          .filter(x=>{
            const id=String(x.id||'');
            const kind=String(x.profileKind||'');
            return !id.startsWith('ext:')&&!id.startsWith('native-chrome:')&&
              !id.startsWith('native-opera:')&&kind!=='USER_NATIVE_UNATTACHED'&&
              kind!=='USER_CONSENTED_TAB';
          }).map(x=>({...x,profileKind:'ISOLATED_AUTOMATION_PROFILE',readOnly:!x.attached}));
        const authorized=consent.tabs.map(x=>({...x,profileKind:'USER_CONSENTED_TAB',readOnly:true}));
        return send(res,200,{ok:true,browser:'chrome',tabs:[...authorized,...isolated],
          profileScope:'USER_CONSENTED_PLUS_ISOLATED',
          nativeSessionAttached:consent.paired,
          userSessionReadable:consent.paired&&authorized.length>0,
          connectionMode:consent.paired&&authorized.length?'USER_TAB_CONSENTED':'ISOLATED_ONLY',
          consentedTabCount:authorized.length,
          isolatedTabCount:isolated.length,
          userTabStatus:!consent.available?'COMPANION_UNAVAILABLE':
            !consent.paired?'COMPANION_PAIRING_REQUIRED':
            authorized.length?'USER_TABS_GRANTED':'USER_TAB_PERMISSION_REQUIRED'});
      }
      if(req.method==='GET'&&target.pathname==='/v1/browsers'){
        const [base,consent]=await Promise.all([
          upstreamFetch(upstreamUrl,'/v1/browsers').catch(()=>null),companionStatus()
        ]);
        if((!base||base.status!==200||!base.body?.ok)&&!consent.available)
          return send(res,503,{ok:false,error:'LOCAL_BROWSER_AND_COMPANION_UNAVAILABLE'});
        const known=(base?.body?.ok?base.body.browsers:[{id:'chrome',connected:false,status:'ISOLATED_PROFILE_UNAVAILABLE'}])||[];
        const browsers=known.map(b=>b.id!=='chrome'?b:{
          ...b,cdpProfile:'ISOLATED_AUTOMATION_PROFILE',
          nativeSessionAttached:consent.paired,
          userSessionReadable:consent.paired&&consent.tabs.length>0,
          connectionMode:consent.paired&&consent.tabs.length?'USER_TAB_CONSENTED':'ISOLATED_ONLY',
          consentedTabCount:consent.tabs.length,
          userTabStatus:!consent.available?'COMPANION_UNAVAILABLE':
            !consent.paired?'COMPANION_PAIRING_REQUIRED':
            consent.tabs.length?'USER_TABS_GRANTED':'USER_TAB_PERMISSION_REQUIRED'
        });
        return send(res,200,{ok:true,browsers});
      }
      if(req.method==='POST'&&target.pathname.startsWith('/v1/')){
        const {raw,body}=await boundedBody(req);
        const chosen=typeof body.targetId==='string'&&body.targetId.startsWith('ext:');
        if(chosen){
          if(body.browser!=='chrome')return send(res,400,{ok:false,error:'COMPANION_TARGET_BROWSER_MISMATCH'});
          if(target.pathname!=='/v1/text')return send(res,403,{ok:false,error:'USER_TAB_READ_ONLY'});
          const output=await upstreamFetch(companionUrl,'/v1/text','POST',raw);
          return send(res,output.status,output.body);
        }
        // A native-user target must never fall back to CDP.
        if(typeof body.targetId==='string'&&body.targetId.startsWith('native-chrome:'))
          return send(res,403,{ok:false,error:'USER_TAB_PERMISSION_REQUIRED'});
        const output=await upstreamFetch(upstreamUrl,target.pathname+target.search,'POST',raw);
        return send(res,output.status,output.body);
      }
      // All other methods and routes retain the original bridge's behavior.
      if(req.method!=='GET')return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
      const output=await upstreamFetch(upstreamUrl,target.pathname+target.search);
      return send(res,output.status,output.body);
    }catch(e){
      const reason=String(e.message||e);
      return send(res,/(TIMEOUT|abort|fetch failed|ECONNREFUSED)/i.test(reason)?503:400,
        {ok:false,error:/(TIMEOUT|abort|fetch failed|ECONNREFUSED)/i.test(reason)?'LOCAL_BRIDGE_UNAVAILABLE':'ROUTER_INVALID_REQUEST'});
    }
  });
  return {
    server,
    listen:()=>new Promise((resolve,reject)=>server.once('error',reject).listen(port,host,resolve)),
    close:()=>new Promise(resolve=>server.close(resolve))
  };
}
