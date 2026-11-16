import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import crypto from 'node:crypto';
import {createBroker} from '../broker/server.mjs';
import {makeConsentedTabAdapter} from '../bridge-adapter/consented-tab-adapter.mjs';
import {routeCompanionRequest} from '../bridge-integration/browser-companion-routes.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const extension=path.resolve(here,'../extension');

test('REAL headed Chromium: MV3 registered, original popup opens and pairs to actual loopback Companion',async()=>{
 const tmp=await mkdtemp(path.join(tmpdir(),'luch-e2e-'));
 const bridgeSecret=crypto.randomBytes(32).toString('hex');
 const broker=createBroker({bridgeToken:bridgeSecret,pairingCode:'51061022',port:9248});
 const fixture=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<html><title>LUCH QA page</title><body><h1>LUCH browser fixture</h1><input id="query" aria-label="Search"><button id="check" type="button">Check</button></body></html>')});
 let context=null;
 try{
  await broker.listen();
  await new Promise(r=>fixture.listen(19498,'127.0.0.1',r));
  context=await chromium.launchPersistentContext(tmp,{
   headless:false,
   args:['--disable-extensions-except='+extension,'--load-extension='+extension,'--no-first-run','--no-default-browser-check'],
   viewport:{width:1260,height:900}
  });
  let sw=context.serviceWorkers()[0];
  if(!sw)sw=await context.waitForEvent('serviceworker',{timeout:30000});
  const id=new URL(sw.url()).hostname;
  assert.match(id,/^[a-p]{32}$/);
  const fixturePage=await context.newPage();await fixturePage.goto('http://127.0.0.1:19498/fixture');
  await assert.doesNotReject(()=>fixturePage.locator('h1').getByText('LUCH browser fixture').waitFor());
  const popup=await context.newPage();
  await popup.goto('chrome-extension://'+id+'/popup.html');
  await popup.locator('#headline').waitFor();
  assert.match(await popup.locator('#headline').innerText(),/Put this page to work/);
  assert.equal(await popup.locator('#local-setup').getAttribute('href'),'http://127.0.0.1:9248/setup');
  const setup=await context.newPage();await setup.goto('http://127.0.0.1:9248/setup');
  await setup.locator('#generate').click();
  await setup.locator('#code').waitFor({state:'visible'});
  await setup.waitForFunction(()=>/^\d{8}$/.test(document.querySelector('#code')?.textContent?.trim()||''),undefined,{timeout:7000});
  const code=(await setup.locator('#code').innerText()).trim();
  assert.match(code,/^\d{8}$/);
  await popup.locator('#pairCode').fill(code);
  await popup.locator('#pair').click();
  await popup.waitForFunction(()=>document.querySelector('#status')?.textContent?.trim()==='Connected',undefined,{timeout:8000});
  assert.equal((await popup.locator('#status').innerText()).trim(),'Connected');
  const health=await fetch('http://127.0.0.1:9248/health');
  assert.equal((await health.json()).paired,true);
  // Ask Chrome to invoke the extension action via its user shortcut.
  // The browser, not this test script, must grant temporary activeTab access.
  await fixturePage.bringToFront();
  const shortcuts=await sw.evaluate(()=>chrome.commands.getAll());
  const actionCommand=shortcuts.find(x=>x.name==='_execute_action');
  assert.ok(actionCommand,'Chrome must register the extension action shortcut');
  assert.match(actionCommand.shortcut||'',/Ctrl\+Shift\+Y/i);
  await fixturePage.keyboard.press('Control+Shift+Y');
  await new Promise(r=>setTimeout(r,700));
  const tab=await sw.evaluate(async()=>{
   const tabs=await chrome.tabs.query({active:true,currentWindow:true});
   return tabs.map(t=>({id:t.id,url:t.url,title:t.title}));
  });
  assert.ok(tab.some(t=>t.url?.startsWith('http://127.0.0.1:19498/fixture')),JSON.stringify(tab));
  // In this test the extension receives the command through its real worker.
  // The consent UI button is tested separately; the real shortcut is the
  // browser user gesture granting activeTab for the actual site.
  const firstGrant=await sw.evaluate(()=>chrome.runtime.sendMessage({op:'grant-active'}));
  assert.equal(firstGrant.ok,true,JSON.stringify(firstGrant));
  const adapter=makeConsentedTabAdapter({brokerUrl:'http://127.0.0.1:9248',bridgeTokenProvider:()=>bridgeSecret,timeoutMs:14500});
  let approved=await adapter.listAuthorizedTabs();
  assert.equal(approved.tabs.length,1,JSON.stringify(approved));
  const targetId=approved.tabs[0].id;
  assert.match(targetId,/^ext:/);
  const before=await routeCompanionRequest('/v1/type',{browser:'chrome',targetId,selector:'#query',text:'LUCH real Chromium'},adapter);
  assert.equal(before.status,409,JSON.stringify(before));
  assert.equal(before.body.error,'INTERACTION_APPROVAL_REQUIRED');
  const interaction=await sw.evaluate(()=>chrome.runtime.sendMessage({op:'allow-interaction'}));
  assert.equal(interaction.ok,true,JSON.stringify(interaction));
  const fill=await routeCompanionRequest('/v1/type',{browser:'chrome',targetId,selector:'#query',text:'LUCH real Chromium'},adapter);
  assert.equal(fill.status,200,JSON.stringify(fill));
  assert.equal(fill.body.result?.updated,true);
  assert.equal(await fixturePage.locator('#query').inputValue(),'LUCH real Chromium');
  const read=await adapter.readAuthorizedText({targetId});
  assert.equal(read.ok,true);
  assert.match(read.text,/LUCH browser fixture/);
  const revoked=await sw.evaluate(()=>chrome.runtime.sendMessage({op:'revoke-active'}));
  assert.equal(revoked.ok,true,JSON.stringify(revoked));
  const denied=await routeCompanionRequest('/v1/type',{browser:'chrome',targetId,selector:'#query',text:'must not write'},adapter);
  assert.equal(denied.status,409);
  assert.equal(await fixturePage.locator('#query').inputValue(),'LUCH real Chromium');
  await popup.screenshot({path:path.join(tmp,'paired-popup.png')});
  console.log('REAL_CHROME_MV3_FULL_TAB_ACTION_PASS extension='+id+' target='+targetId);
 }finally{
  if(context)await context.close().catch(()=>{});
  await new Promise(r=>fixture.close(r));
  await broker.close().catch(()=>{});
  await rm(tmp,{recursive:true,force:true});
 }
},{timeout:90000});
