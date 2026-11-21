import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('popup makes browser pairing and AI-host authorization distinct',()=>{
 const html=read('extension/popup.html');
 const js=read('extension/popup.js');
 assert.match(html,/id="setup-boundary"/);
 assert.match(html,/id="setup-steps"/);
 assert.match(js,/Pairing links this browser directly to your LUCH account/);
 assert.match(js,/your existing ChatGPT/i);
 assert.match(js,/напрямую связывает этот браузер с вашим аккаунтом LUCH/);
 assert.match(js,/ChatGPT.*остаётся вашим существующим хостом/);
 assert.match(js,/Browser paired/);
 assert.doesNotMatch(js,/Put this page to work/);
});

test('first-run pairing explains cloud MCP and ten-minute one-time code',()=>{
 const js=read('extension/popup.js');
 const edge=read('supabase/functions/p029-browser-companion/index.ts');
 assert.match(js,/browser_companion_pairing_create/);
 assert.match(js,/eight-digit code/);
 assert.match(js,/ten minutes/);
 assert.match(js,/десять минут/);
 assert.match(edge,/Date\.now\(\)\+600_000/);
 assert.match(js,/LUCH cloud is not reachable/);
 assert.doesNotMatch(js,/localhost|local setup on this computer|five minutes/i);
});

test('tab permissions remain separate, session-scoped and fail closed',()=>{
 const manifest=JSON.parse(read('extension/manifest.json'));
 const js=read('extension/popup.js');
 const worker=read('extension/background.js');
 assert.deepEqual([...manifest.permissions].sort(),['activeTab','alarms','scripting','storage','debugger'].sort());
 assert.deepEqual(manifest.host_permissions,['https://api.lenarsalimov.ru/luch/browser/*']);
 for(const forbidden of ['cookies','history','webRequest','<all_urls>'])assert.ok(!JSON.stringify(manifest).includes(forbidden));
 assert.deepEqual(manifest.optional_permissions,['tabs']);
 assert.match(js,/Allow reading on this tab/);
 assert.match(js,/Allow interaction on this tab/);
 assert.match(js,/Revoke access to this tab/);
 assert.match(worker,/INTERACTION_APPROVAL_REQUIRED/);
 assert.match(worker,/TAB_ORIGIN_CHANGED/);
 assert.match(worker,/chrome\.storage\.session/);
 const statusHandler=worker.slice(worker.indexOf("if(msg.op==='status')"),worker.indexOf("if(msg.op==='pair')"));
 assert.match(statusHandler,/api\('\/health'/);
 assert.doesNotMatch(statusHandler,/api\('\/extension\/jobs'/);
});

test('store copy does not conflate extension operations with the platform inventory',()=>{
 const listing=read('STORE_LISTING_DRAFT.md');
 assert.match(listing,/full 45-operation interaction\/pointer surface/);
 assert.doesNotMatch(listing,/all 54 LUCH browser tools/);
 assert.match(listing,/Feature access, including write actions, varies by AI provider/);
 assert.match(listing,/Opera runtime has not passed exact-build E2E/);
 assert.match(listing,/NOT SUBMITTED \/ RELEASE HOLD/);
 const privacy=read('../../docs/browser-companion-privacy.md');
 assert.match(privacy,/https:\/\/api\.lenarsalimov\.ru\/luch\/browser/);
});
