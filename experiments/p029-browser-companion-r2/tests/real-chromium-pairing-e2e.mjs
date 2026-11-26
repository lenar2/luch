import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createBroker} from '../broker/server.mjs';
import {makeConsentedTabAdapter} from '../bridge-adapter/consented-tab-adapter.mjs';
import {routeCompanionRequest} from '../bridge-integration/browser-companion-routes.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const extension=path.resolve(here,'../extension');

test('REAL headed Chromium: MV3 onboarding, local pairing, scoped permissions, action and revoke',async()=>{
 const tmp=await mkdtemp(path.join(tmpdir(),'luch-e2e-'));
 const bridgeSecret=crypto.randomBytes(32).toString('hex');
 const broker=createBroker({bridgeToken:bridgeSecret,pairingCode:'51061022',port:9248});
  const fixture=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html><head><meta charset="utf-8"><title>LUCH QA page</title><style>body{margin:0;padding:72px;background:#f7f6f0;color:#102f34;font:16px/1.5 Arial,sans-serif}.card{max-width:680px;margin:0 auto;padding:42px;border:1px solid #d7deda;border-radius:18px;background:#fff}.eyebrow{color:#718a83;font-size:11px;font-weight:700;letter-spacing:.16em}.card h1{margin:10px 0;font-size:38px}.card p{color:#5b6b68}.card label{display:block;margin:24px 0 7px;font-weight:700}.card input{width:100%;padding:13px;border:1px solid #d7deda;border-radius:9px;font:inherit}.card button{margin-top:12px;padding:12px 18px;border:0;border-radius:9px;background:#143c43;color:#fff;font:inherit;font-weight:700}</style></head><body><main class="card"><span class="eyebrow">LOCAL QA PAGE</span><h1>LUCH browser fixture</h1><p>This example page is used to verify tab approval, reading and a permitted text-entry action.</p><label for="query">Search this page</label><input id="query" aria-label="Search"><button id="check" type="button">Check</button><p id="click-result">Not clicked</p></main></body></html>`)});
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
  await fixturePage.evaluate(() => document.querySelector('#check')?.addEventListener('click',()=>{document.querySelector('#click-result').textContent='LUCH pointer clicked'}));
  const captureDir=path.resolve(here,'../dist/store-captures');
  await mkdir(captureDir,{recursive:true});
  await fixturePage.screenshot({path:path.join(captureDir,'fixture-page-before-action.png'),fullPage:true});
  const popup=await context.newPage();
  await popup.setViewportSize({width:390,height:620});
  await popup.goto('chrome-extension://'+id+'/popup.html');
  await popup.locator('#headline').waitFor();
  assert.match(await popup.locator('#headline').innerText(),/Share a tab with LUCH/);
  assert.match(await popup.locator('#setup-boundary').innerText(),/does not install the desktop app or connect an AI host/i);
  await popup.screenshot({path:path.join(captureDir,'popup-before-pair.png'),fullPage:true});
  assert.equal(await popup.locator('#local-setup').getAttribute('href'),'http://127.0.0.1:9248/setup');
  const setup=await context.newPage();await setup.goto('http://127.0.0.1:9248/setup');
  await setup.locator('#generate').click();
  await setup.locator('#code').waitFor({state:'visible'});
  await setup.waitForFunction(()=>/^\d{8}$/.test(document.querySelector('#code')?.textContent?.trim()||''),undefined,{timeout:7000});
  const code=(await setup.locator('#code').innerText()).trim();
  assert.match(code,/^\d{8}$/);
  await popup.locator('#pairCode').fill(code);
  await popup.locator('#pair').click();
  await popup.waitForFunction(()=>document.querySelector('#status')?.textContent?.trim()==='Browser paired',undefined,{timeout:8000});
  assert.equal((await popup.locator('#status').innerText()).trim(),'Browser paired');
  const health=await fetch('http://127.0.0.1:9248/health');
  assert.equal((await health.json()).paired,true);
  // Ask Chrome to invoke the extension action via its user shortcut.
  // The browser, not this test script, must grant temporary activeTab access.
  await fixturePage.bringToFront();
  await popup.reload();
  await popup.waitForFunction(()=>document.querySelector('#status')?.textContent?.trim()==='Browser paired',undefined,{timeout:8000});
  await popup.screenshot({path:path.join(captureDir,'popup-paired.png'),fullPage:true});
  const shortcuts=await sw.evaluate(()=>chrome.commands.getAll());
  const actionCommand=shortcuts.find(x=>x.name==='_execute_action');
  assert.ok(actionCommand,'Chrome must register the extension action shortcut');
  assert.match(actionCommand.shortcut||'',/Ctrl\+Shift\+Y/i);
  // Playwright's CDP key events do not necessarily reach Chrome's browser-level
  // shortcut dispatcher. Use the X server to deliver a REAL native key chord.
  const focused=execFileSync('xdotool',['getwindowfocus','getwindowname'],{encoding:'utf8'}).trim();
  console.log('NATIVE_CHROME_FOCUS',focused.slice(0,140));
  execFileSync('xdotool',['key','--clearmodifiers','ctrl+shift+y']);
  await new Promise(r=>setTimeout(r,1100));
  const tab=await sw.evaluate(async()=>{
   const tabs=await chrome.tabs.query({active:true,currentWindow:true});
   return tabs.map(t=>({id:t.id,url:t.url,title:t.title}));
  });
  assert.ok(tab.some(t=>t.url?.startsWith('http://127.0.0.1:19498/fixture')),JSON.stringify(tab));
  // In this test the extension receives the command through its real worker.
  // The consent UI button is tested separately; the real shortcut is the
  // browser user gesture granting activeTab for the actual site.
  const firstGrant=await popup.evaluate(()=>chrome.runtime.sendMessage({op:'grant-active'}));
  assert.equal(firstGrant.ok,true,JSON.stringify(firstGrant));
  await popup.reload();
  await popup.waitForFunction(()=>document.querySelector('#shareStatus')?.textContent?.includes('LUCH can read this tab'),undefined,{timeout:8000});
  await popup.screenshot({path:path.join(captureDir,'popup-read-approved.png'),fullPage:true});
  const adapter=makeConsentedTabAdapter({brokerUrl:'http://127.0.0.1:9248',bridgeTokenProvider:()=>bridgeSecret,timeoutMs:14500});
  let approved=await adapter.listAuthorizedTabs();
  assert.equal(approved.tabs.length,1,JSON.stringify(approved));
  const targetId=approved.tabs[0].id;
  assert.match(targetId,/^ext:/);
  const before=await routeCompanionRequest('/v1/type',{browser:'chrome',targetId,selector:'#query',text:'LUCH real Chromium'},adapter);
  assert.equal(before.status,409,JSON.stringify(before));
  assert.equal(before.body.error,'INTERACTION_APPROVAL_REQUIRED');
  const interaction=await popup.evaluate(()=>chrome.runtime.sendMessage({op:'allow-interaction'}));
  assert.equal(interaction.ok,true,JSON.stringify(interaction));
  await popup.reload();
  await popup.waitForFunction(()=>document.querySelector('#shareStatus')?.textContent?.includes('LUCH can read and interact'),undefined,{timeout:8000});
  await popup.screenshot({path:path.join(captureDir,'popup-interaction-approved.png'),fullPage:true});
  const fill=await routeCompanionRequest('/v1/type',{browser:'chrome',targetId,selector:'#query',text:'LUCH real Chromium'},adapter);
  assert.equal(fill.status,200,JSON.stringify(fill));
  assert.equal(fill.body.result?.updated,true);
  assert.equal(await fixturePage.locator('#query').inputValue(),'LUCH real Chromium');
  const read=await adapter.readAuthorizedText({targetId});
  assert.equal(read.ok,true);
  assert.match(read.text,/LUCH browser fixture/);
  if(process.env.LUCH_TEST_PRECISE_POINTER==='1'){
    const enabled=await popup.evaluate(()=>chrome.runtime.sendMessage({op:'precise-cursor',enabled:true}));
    assert.equal(enabled.ok,true,JSON.stringify(enabled));
    await fixturePage.bringToFront();
    const box=await fixturePage.locator('#check').boundingBox();
    assert.ok(box);
    const clicked=await routeCompanionRequest('/v1/companion/action',
      {browser:'chrome',targetId,op:'pointer_click',args:{x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2)}},adapter);
    assert.equal(clicked.status,200,JSON.stringify(clicked));
    assert.equal((await fixturePage.locator('#click-result').textContent()).trim(),'LUCH pointer clicked');
    const disabled=await popup.evaluate(()=>chrome.runtime.sendMessage({op:'precise-cursor',enabled:false}));
    assert.equal(disabled.ok,true,JSON.stringify(disabled));
    console.log('REAL_CHROME_DEBUGGER_POINTER_CLICK_PASS');
  }
  const revoked=await popup.evaluate(()=>chrome.runtime.sendMessage({op:'revoke-active'}));
  assert.equal(revoked.ok,true,JSON.stringify(revoked));
  await popup.reload();
  await popup.waitForFunction(()=>document.querySelector('#shareStatus')?.textContent?.includes('No tab access granted'),undefined,{timeout:8000});
  await popup.screenshot({path:path.join(captureDir,'popup-revoked.png'),fullPage:true});
  const denied=await routeCompanionRequest('/v1/type',{browser:'chrome',targetId,selector:'#query',text:'must not write'},adapter);
  assert.equal(denied.status,409);
  assert.equal(await fixturePage.locator('#query').inputValue(),'LUCH real Chromium');
  await fixturePage.screenshot({path:path.join(captureDir,'fixture-page-after-action.png'),fullPage:true});
  console.log('REAL_CHROME_MV3_FULL_TAB_ACTION_PASS extension='+id+' target='+targetId);
 }finally{
  if(context)await context.close().catch(()=>{});
  await new Promise(r=>fixture.close(r));
  await broker.close().catch(()=>{});
  await rm(tmp,{recursive:true,force:true});
 }
},{timeout:90000});
