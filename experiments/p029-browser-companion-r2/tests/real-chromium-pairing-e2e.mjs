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
  // A programmatically opened popup does NOT prove activeTab user gesture. Real
  // toolbar-grant and AI browser action are separate mandatory release gates.
  await popup.screenshot({path:path.join(tmp,'paired-popup.png')});
  console.log('REAL_CHROME_MV3_PAIRING_PASS extension='+id+' screenshot='+path.join(tmp,'paired-popup.png'));
 }finally{
  if(context)await context.close().catch(()=>{});
  await new Promise(r=>fixture.close(r));
  await broker.close().catch(()=>{});
  await rm(tmp,{recursive:true,force:true});
 }
},{timeout:90000});
