import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {createLuchBrowserBridgeProxy} from '../integration/local-bridge-proxy.mjs';
import {createBroker} from '../broker/server.mjs';

const secret=randomBytes(32).toString('hex');
const extensionOrigin='chrome-extension://'+'a'.repeat(32);
const json=(res,status,obj)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(obj))};
const listen=server=>new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
const req=async(url,{method='GET',body,bridge=false,token,origin}={})=>{
 const headers={};
 if(bridge)headers['x-browser-bridge-token']=secret;
 if(token)headers.authorization='Bearer '+token;
 if(origin)headers.origin=origin;
 if(body!==undefined)headers['content-type']='application/json';
 const r=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json()};
};
const fixture=async()=>{
 const upstream=http.createServer(async(req,res)=>{
   const auth=req.headers['x-browser-bridge-token']===secret;
   if(!auth)return json(res,401,{ok:false,error:'NO_TOKEN'});
   if(req.method==='GET'&&req.url.startsWith('/v1/tabs')){
     const browser=new URL('http://local'+req.url).searchParams.get('browser');
     if(browser!=='chrome')return json(res,200,{ok:true,browser,tabs:[{id:'opera-isolated',url:'https://example.org'}]});
     return json(res,200,{ok:true,browser:'chrome',profileScope:'browser_default',tabs:[
       {id:'cdp-isolated-01',title:'Blank automation tab',url:'about:blank',attached:true},
       {id:'native-chrome:777',title:'DO_NOT_EXPOSE_PRIVATE_TITLE',url:'https://private.example/ungranted',profileKind:'USER_NATIVE_UNATTACHED',attached:false}
     ]});
   }
   if(req.method==='GET'&&req.url==='/v1/browsers')return json(res,200,{ok:true,browsers:[{id:'chrome',status:'CONNECTED'},{id:'opera',status:'CONNECTED'}]});
   if(req.method==='POST'&&req.url==='/v1/text')return json(res,200,{ok:true,text:'ISOLATED_AUTOMATION_TEXT'});
   if(req.method==='POST'&&req.url==='/v1/click')return json(res,200,{ok:true,result:{clicked:true}});
   return json(res,404,{ok:false,error:'MOCK_NOT_FOUND'});
 });
 await listen(upstream);
 const broker=createBroker({bridgeToken:secret,pairingCode:'53184926',port:0});
 await broker.listen();
 const bridgePort=upstream.address().port,brokerPort=broker.server.address().port;
 const router=createLuchBrowserBridgeProxy({bridgeToken:secret,port:0,upstream:'http://127.0.0.1:'+bridgePort,companion:'http://127.0.0.1:'+brokerPort});
 await router.listen();
 const base='http://127.0.0.1:'+router.server.address().port;
 const brokerBase='http://127.0.0.1:'+brokerPort;
 const close=async()=>{await router.close();await broker.close();await new Promise(r=>upstream.close(r))};
 return {base,brokerBase,close};
};
test('native user tabs stay distinct from isolated CDP and require pairing',async()=>{
 const f=await fixture();
 try{
   const noAuth=await req(f.base+'/v1/tabs?browser=chrome');
   assert.equal(noAuth.status,401);
   const before=await req(f.base+'/v1/tabs?browser=chrome',{bridge:true});
   assert.equal(before.status,200);
   assert.equal(before.data.userTabStatus,'COMPANION_PAIRING_REQUIRED');
   assert.equal(before.data.nativeSessionAttached,false);
   assert.equal(before.data.tabs.length,1);
   assert.ok(!JSON.stringify(before.data).includes('DO_NOT_EXPOSE_PRIVATE_TITLE'));
   assert.equal(before.data.userSessionReadable,false);
   assert.equal(before.data.tabs[0].profileKind,'ISOLATED_AUTOMATION_PROFILE');
   const pair=await req(f.brokerBase+'/pair',{method:'POST',origin:extensionOrigin,body:{code:'53184926'}});
   assert.equal(pair.status,200);const token=pair.data.token;
   const afterPair=await req(f.base+'/v1/tabs?browser=chrome',{bridge:true});
   assert.equal(afterPair.data.userTabStatus,'USER_TAB_PERMISSION_REQUIRED');
   assert.equal(afterPair.data.nativeSessionAttached,true);
   const grantId='d'.repeat(24),targetId='ext:83:'+grantId;
   const grant=await req(f.brokerBase+'/extension/grants',{method:'POST',origin:extensionOrigin,token,body:{grants:[{tabId:83,grantId,url:'https://private.example/training',title:'Private course list',expiresAt:Date.now()+60000}]}});
   assert.equal(grant.status,200);
   const authorized=await req(f.base+'/v1/tabs?browser=chrome',{bridge:true});
   assert.equal(authorized.data.userTabStatus,'USER_TABS_GRANTED');
   assert.equal(authorized.data.consentedTabCount,1);
   assert.equal(authorized.data.userSessionReadable,true);
   assert.equal(authorized.data.connectionMode,'USER_TAB_CONSENTED');
   assert.ok(!JSON.stringify(authorized.data).includes('DO_NOT_EXPOSE_PRIVATE_TITLE'));
   assert.equal(authorized.data.isolatedTabCount,1);
   assert.equal(authorized.data.tabs[0].id,targetId);
   assert.equal(authorized.data.tabs[0].profileKind,'USER_CONSENTED_TAB');
   assert.equal(authorized.data.tabs[1].profileKind,'ISOLATED_AUTOMATION_PROFILE');
   const statuses=await req(f.base+'/v1/browsers',{bridge:true});
   assert.equal(statuses.data.browsers[0].userTabStatus,'USER_TABS_GRANTED');
   assert.equal(statuses.data.browsers[1].id,'opera');
   const other=await req(f.base+'/v1/tabs?browser=opera',{bridge:true});
   assert.equal(other.data.tabs[0].id,'opera-isolated');
   const illegal=await req(f.base+'/v1/click',{method:'POST',bridge:true,body:{browser:'chrome',targetId,selector:'body'}});
   assert.equal(illegal.status,403);
   assert.equal(illegal.data.error,'USER_TAB_READ_ONLY');
   const mismatched=await req(f.base+'/v1/text',{method:'POST',bridge:true,body:{browser:'opera',targetId}});
   assert.equal(mismatched.status,400);
   const native=await req(f.base+'/v1/text',{method:'POST',bridge:true,body:{browser:'chrome',targetId:'native-chrome:321'}});
   assert.equal(native.status,403);
   const cdp=await req(f.base+'/v1/text',{method:'POST',bridge:true,body:{browser:'chrome',targetId:'cdp-isolated-01'}});
   assert.equal(cdp.status,200);assert.equal(cdp.data.text,'ISOLATED_AUTOMATION_TEXT');
   const liveTextPromise=req(f.base+'/v1/text',{method:'POST',bridge:true,body:{browser:'chrome',targetId,selector:'body'}});
   let task;for(let i=0;i<40;i++){
     const jobs=await req(f.brokerBase+'/extension/jobs',{token});
     if(jobs.data.jobs?.length){task=jobs.data.jobs[0];break}
     await new Promise(r=>setTimeout(r,50));
   }
   assert.ok(task,'real broker must dispatch read job');
   const finish=await req(f.brokerBase+'/extension/result',{method:'POST',origin:extensionOrigin,token,body:{jobId:task.id,result:{ok:true,text:'AUTHORIZED_COURSES_TEXT',title:'Courses'}}});
   assert.equal(finish.status,200);
   const read=await liveTextPromise;
   assert.equal(read.status,200);assert.equal(read.data.text,'AUTHORIZED_COURSES_TEXT');
   const revoke=await req(f.brokerBase+'/extension/grants',{method:'POST',origin:extensionOrigin,token,body:{grants:[]}});
   assert.equal(revoke.status,200);
   const revoked=await req(f.base+'/v1/text',{method:'POST',bridge:true,body:{browser:'chrome',targetId,selector:'body'}});
   assert.equal(revoked.status,403);
   const after=await req(f.base+'/v1/tabs?browser=chrome',{bridge:true});
   assert.equal(after.data.consentedTabCount,0);
   console.log('R11_INTEGRATION_ASSERTIONS_PASS');
 }finally{await f.close()}
});
test('proxy refuses remote endpoints, weak tokens and exposed listener',()=>{
 assert.throws(()=>createLuchBrowserBridgeProxy({bridgeToken:'short'}),/BRIDGE_TOKEN_REQUIRED/);
 assert.throws(()=>createLuchBrowserBridgeProxy({bridgeToken:secret,host:'0.0.0.0'}),/LOOPBACK_REQUIRED/);
 assert.throws(()=>createLuchBrowserBridgeProxy({bridgeToken:secret,upstream:'https://remote.example'}),/ONLY_LOOPBACK/);
 assert.throws(()=>createLuchBrowserBridgeProxy({bridgeToken:secret,companion:'http://127.0.0.1:9240',upstream:'http://127.0.0.1:9240'}),/DISTINCT/);
});

test('consented personal tab remains visible when isolated CDP is unavailable',async()=>{
 const broker=createBroker({bridgeToken:secret,pairingCode:'92418037',port:0});
 await broker.listen();
 const port=broker.server.address().port;
 const proxy=createLuchBrowserBridgeProxy({bridgeToken:secret,port:0,upstream:'http://127.0.0.1:19547',companion:'http://127.0.0.1:'+port});
 await proxy.listen();
 const base='http://127.0.0.1:'+proxy.server.address().port;
 const brokerBase='http://127.0.0.1:'+port;
 try{
  const first=await req(base+'/v1/tabs?browser=chrome',{bridge:true});
  assert.equal(first.status,200);
  assert.equal(first.data.userTabStatus,'COMPANION_PAIRING_REQUIRED');
  const pair=await req(brokerBase+'/pair',{method:'POST',origin:extensionOrigin,body:{code:'92418037'}});
  assert.equal(pair.status,200);
  const g=await req(brokerBase+'/extension/grants',{method:'POST',origin:extensionOrigin,token:pair.data.token,
   body:{grants:[{tabId:51,grantId:'f'.repeat(24),url:'https://example.test/private',title:'Consented user tab',expiresAt:Date.now()+50000}]}});
  assert.equal(g.status,200);
  const r=await req(base+'/v1/tabs?browser=chrome',{bridge:true});
  assert.equal(r.status,200);
  assert.equal(r.data.tabs.length,1);
  assert.equal(r.data.consentedTabCount,1);
  assert.equal(r.data.isolatedTabCount,0);
  assert.equal(r.data.tabs[0].profileKind,'USER_CONSENTED_TAB');
  const stats=await req(base+'/v1/browsers',{bridge:true});
  assert.equal(stats.status,200);
  assert.equal(stats.data.browsers[0].userTabStatus,'USER_TABS_GRANTED');
 }finally{await proxy.close();await broker.close()}
});
test('fail closed if both bridge sources are absent',async()=>{
 const proxy=createLuchBrowserBridgeProxy({bridgeToken:secret,port:0,upstream:'http://127.0.0.1:19547',companion:'http://127.0.0.1:19548'});
 await proxy.listen();
 try{
  const base='http://127.0.0.1:'+proxy.server.address().port;
  const r=await req(base+'/v1/tabs?browser=chrome',{bridge:true});
  assert.equal(r.status,503);
  assert.equal(r.data.error,'LOCAL_BROWSER_AND_COMPANION_UNAVAILABLE');
 }finally{await proxy.close()}
});

