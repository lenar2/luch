import {Client} from '/app/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StreamableHTTPClientTransport} from '/app/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js';
import http from 'node:http';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {createLuchBrowserBridgeProxy} from '../integration/local-bridge-proxy.mjs';
import {createBroker} from '../broker/server.mjs';

const token=randomBytes(32).toString('hex'),origin='chrome-extension://'+'a'.repeat(32);
const flags=[];
const mark=(name)=>{flags.push(name);console.log('PASS',name)};
const req=async(url,{method='GET',body,secret,auth,origin:o}={})=>{
 const headers={};
 if(secret)headers['x-browser-bridge-token']=secret;
 if(auth)headers.authorization='Bearer '+auth;
 if(o)headers.origin=o;
 if(body!==undefined)headers['content-type']='application/json';
 const r=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json()};
};
const txt=r=>(r.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');
const parse=r=>JSON.parse(txt(r));
let upstream,broker,router,child,client,transport;
try{
 fs.writeFileSync('/qa/.token',token,{mode:0o600,flag:'wx'});
 upstream=http.createServer((req,res)=>{
  if(req.headers['x-browser-bridge-token']!==token){res.writeHead(401);res.end();return}
  res.writeHead(200,{'content-type':'application/json'});
  if(req.url.startsWith('/v1/tabs'))res.end(JSON.stringify({ok:true,browser:'chrome',tabs:[{id:'isolated-qa',title:'CDP sandbox',url:'about:blank',attached:true}]}));
  else if(req.url==='/v1/browsers')res.end(JSON.stringify({ok:true,browsers:[{id:'chrome',connected:true,status:'CONNECTED',cdpProfile:'ISOLATED_AUTOMATION_PROFILE'}]}));
  else if(req.url==='/v1/text')res.end(JSON.stringify({ok:true,text:'ISOLATED_PAGE_ONLY'}));
  else res.end(JSON.stringify({ok:false,error:'UNKNOWN_UPSTREAM'}));
 });
 await new Promise(r=>upstream.listen(9240,'127.0.0.1',r));
 broker=createBroker({bridgeToken:token,pairingCode:'63910427',port:9248});
 await broker.listen();
 router=createLuchBrowserBridgeProxy({bridgeToken:token,port:9251});
 await router.listen();
 child=spawn(process.execPath,['/qa/stock-mcp-adapter/server.mjs','--http'],{
  env:{...process.env,FACTORY_BROWSER_BRIDGE_URL:'http://127.0.0.1:9251',FACTORY_BROWSER_MCP_PORT:'9243',FACTORY_BROWSER_MCP_HOST:'127.0.0.1',HOME:'/qa'},
  cwd:'/qa/stock-mcp-adapter',stdio:['ignore','pipe','pipe']
 });
 const errChunks=[];child.stderr.on('data',x=>{if(errChunks.join('').length<1200)errChunks.push(x.toString())});
 let ready=false;for(let i=0;i<45;i++){
  if(child.exitCode!==null)throw new Error('stock LUCH MCP adapter exited: '+errChunks.join(''));
  try{const r=await fetch('http://127.0.0.1:9243/health');if(r.ok){ready=true;break}}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 assert.ok(ready,'stock MCP HTTP adapter did not start');
 transport=new StreamableHTTPClientTransport(new URL('http://127.0.0.1:9243/mcp'));
 client=new Client({name:'LUCH Browser Companion R1.1 Stock MCP QA',version:'0.1.0'});
 await client.connect(transport);
 const list=await client.listTools();
 assert.ok(list.tools.some(x=>x.name==='browser_tabs'));
 assert.ok(list.tools.some(x=>x.name==='browser_read_text'));
 mark('real_stock_luch_mcp_adapter_connected');
 const before=parse(await client.callTool({name:'browser_tabs',arguments:{browser:'chrome'}}));
 assert.equal(before.userTabStatus,'COMPANION_PAIRING_REQUIRED');
 assert.equal(before.tabs.length,1);
 assert.equal(before.tabs[0].profileKind,'ISOLATED_AUTOMATION_PROFILE');
 mark('stock_browser_tabs_reports_unpaired_and_isolated');
 const pair=await req('http://127.0.0.1:9248/pair',{method:'POST',origin,body:{code:'63910427'}});
 assert.equal(pair.status,200);const auth=pair.data.token;
 const grantId='d'.repeat(24),targetId='ext:42:'+grantId;
 const grant=await req('http://127.0.0.1:9248/extension/grants',{method:'POST',origin,auth,body:{grants:[{tabId:42,grantId,url:'https://synthetic.example/tilda',title:'Allowed demo',expiresAt:Date.now()+60000}]}});
 assert.equal(grant.status,200);
 const after=parse(await client.callTool({name:'browser_tabs',arguments:{browser:'chrome'}}));
 assert.equal(after.userTabStatus,'USER_TABS_GRANTED');
 assert.equal(after.tabs[0].id,targetId);
 assert.equal(after.tabs[1].id,'isolated-qa');
 mark('stock_browser_tabs_reports_consented_personal_tab_first');
 const pending=client.callTool({name:'browser_read_text',arguments:{browser:'chrome',targetId,selector:'body'}});
 let job;for(let i=0;i<50;i++){
  const jobs=await req('http://127.0.0.1:9248/extension/jobs',{auth});
  if(jobs.data.jobs?.length){job=jobs.data.jobs[0];break}
  await new Promise(r=>setTimeout(r,50));
 }
 assert.ok(job,'read job never arrived to extension broker');
 assert.equal((await req('http://127.0.0.1:9248/extension/result',{method:'POST',origin,auth,body:{jobId:job.id,result:{ok:true,text:'GETCOURSE_TRAININGS_FIXTURE_ONLY',title:'Courses'}}})).status,200);
 const read=parse(await pending);
 assert.equal(read.text,'GETCOURSE_TRAININGS_FIXTURE_ONLY');
 mark('stock_browser_read_text_resolves_granted_dom');
 const forbidden=await client.callTool({name:'browser_click',arguments:{browser:'chrome',targetId,selector:'h1'}});
 assert.equal(forbidden.isError,true);
 assert.match(txt(forbidden),/USER_TAB_READ_ONLY/);
 mark('stock_browser_click_denied_for_consented_readonly_tab');
 const revoke=await req('http://127.0.0.1:9248/extension/grants',{method:'POST',origin,auth,body:{grants:[]}});
 assert.equal(revoke.status,200);
 const afterRevoke=await client.callTool({name:'browser_read_text',arguments:{browser:'chrome',targetId,selector:'body'}});
 assert.equal(afterRevoke.isError,true);
 assert.match(txt(afterRevoke),/USER_TAB_PERMISSION_REQUIRED/);
 mark('stock_browser_read_text_denied_after_revoke');
 const status=parse(await client.callTool({name:'browser_status',arguments:{browser:'chrome'}}));
 assert.equal(status.browser.userTabStatus,'USER_TAB_PERMISSION_REQUIRED');
 mark('stock_browser_status_distinguishes_permission');
 console.log('STOCK_LUCH_MCP_R11_PASS',flags.length);
 fs.writeFileSync('/qa/QA_STOCK_MCP_R11_PASS.json',JSON.stringify({status:'PASS_SHADOW_STOCK_LUCH_MCP',checks:flags,limitations:['Signed-in user tabs were NOT read','All tests used synthetic localhost broker session','Production LUCH MCP endpoint was NOT switched']},null,2));
}catch(e){console.error('STOCK_MCP_R11_FAIL',e.stack||e);process.exitCode=1;}
finally{
 try{await client?.close()}catch{}
 try{await transport?.close()}catch{}
 if(child){child.kill('SIGTERM');await new Promise(r=>setTimeout(r,150));if(child.exitCode===null)child.kill('SIGKILL')}
 try{await router?.close()}catch{}
 try{await broker?.close()}catch{}
 if(upstream)await new Promise(r=>upstream.close(r));
 try{fs.unlinkSync('/qa/.token')}catch{}
}

