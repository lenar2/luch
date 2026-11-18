import test from 'node:test';
import assert from 'node:assert/strict';
import {createBroker} from '../broker/server.mjs';

const EXT='chrome-extension://'+'a'.repeat(32);
const OTHER='chrome-extension://'+'b'.repeat(32);
const BRIDGE='bridge-secret-'+'z'.repeat(48);

test('Chrome GET polling without Origin requires current token and cannot escalate writes',async()=>{
 const broker=createBroker({bridgeToken:BRIDGE,pairingCode:'68129534',port:0});
 await broker.listen();
 const base='http://127.0.0.1:'+broker.server.address().port;
 const request=async(path,{method='GET',origin,token,bridge=false,data}={})=>{
  const headers={};
  if(origin)headers.Origin=origin;
  if(token)headers.Authorization='Bearer '+token;
  if(bridge)headers['x-browser-bridge-token']=BRIDGE;
  if(data!==undefined)headers['content-type']='application/json';
  const r=await fetch(base+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});
  return {status:r.status,...await r.json()};
 };
 try{
  const pair=await request('/pair',{method:'POST',origin:EXT,data:{code:'68129534'}});
  assert.equal(pair.status,200);assert.ok(pair.token);
  const {token}=pair;
  const good=await request('/extension/jobs',{token});
  assert.equal(good.status,200);assert.deepEqual(good.jobs,[]);
  assert.equal((await request('/extension/jobs')).status,403);
  assert.equal((await request('/extension/jobs',{token:'x'.repeat(43)})).status,403);
  assert.equal((await request('/extension/jobs',{origin:OTHER,token})).status,403);
  assert.equal((await request('/extension/jobs',{origin:'https://evil.invalid',token})).status,403);
  assert.equal((await request('/extension/grants',{method:'POST',token,data:{grants:[]}})).status,403);
  assert.equal((await request('/extension/grants',{method:'POST',origin:OTHER,token,data:{grants:[]}})).status,403);
  assert.equal((await request('/v1/tabs')).status,403);
  assert.equal((await request('/v1/tabs',{bridge:true})).status,200);
  assert.equal((await request('/extension/disconnect',{method:'POST',origin:EXT,token})).status,200);
  assert.equal((await request('/extension/jobs',{token})).status,403);
 }finally{await broker.close()}
});
