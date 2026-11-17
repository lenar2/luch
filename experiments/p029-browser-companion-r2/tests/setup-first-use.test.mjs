import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createBroker} from '../broker/server.mjs';

test('first-use pairing page safely creates a fresh code without terminal or restarting Companion', async()=>{
 const bridgeToken=crypto.randomBytes(32).toString('hex');
 const broker=createBroker({bridgeToken,pairingCode:'12345678',port:19491});
 const base='http://127.0.0.1:19491';
 try{
  await broker.listen();
  let r=await fetch(base+'/setup');
  const html=await r.text();
  assert.equal(r.status,200);
  assert.match(html,/Generate pairing code/);
  assert.match(html,/does not install the desktop app or authorize an AI host/);
  assert.match(html,/The code expires after five minutes/);
  const ruResponse=await fetch(base+'/setup',{headers:{'accept-language':'ru-RU,ru;q=0.9'}});
  const ruHtml=await ruResponse.text();
  assert.equal(ruResponse.status,200);
  assert.match(ruHtml,/Создать код подключения/);
  assert.match(ruHtml,/пять минут/);
  assert.equal(html.includes('12345678'),false,'Initial secret must not be embedded in the HTML');
  assert.equal(r.headers.get('x-frame-options'),'DENY');
  assert.match(r.headers.get('content-security-policy')||'',/frame-ancestors 'none'/);
  const csrf=html.match(/const csrf="([a-f0-9]{48})"/)?.[1];
  assert.ok(csrf,'CSRF included only in local same-origin document');
  const post=(origin,csrfValue)=>fetch(base+'/setup/code',{method:'POST',headers:{'content-type':'application/json',origin,'x-luch-setup-csrf':csrfValue},body:'{}'});
  r=await post('https://attacker.example',csrf);
  assert.equal(r.status,403);
  r=await post(base,'0'.repeat(48));assert.equal(r.status,403);
  r=await post(base,csrf);const result=await r.json();
  assert.equal(r.status,200);assert.match(result.code,/^\d{8}$/);
  assert.equal(result.validForSeconds,300);
  assert.equal(broker.pairingCode,result.code);
  const pair=await fetch(base+'/pair',{method:'POST',headers:{origin:'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','content-type':'application/json'},body:JSON.stringify({code:result.code})});
  assert.equal(pair.status,200);
  assert.equal((await pair.json()).ok,true);
  r=await post(base,csrf);assert.equal(r.status,409,'must not re-pair while already paired');
  r=await fetch(base+'/health');const publicHealth=await r.json();
  assert.equal(publicHealth.pairingCode,undefined,'health never leaks pairing secret');
 }finally{await broker.close()}
});
