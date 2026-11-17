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
 assert.match(js,/Pairing links this browser to the local Companion only/);
 assert.match(js,/does not install the desktop app or connect an AI host/);
 assert.match(js,/Браузер подключён к локальному Companion/);
 assert.match(js,/ИИ-клиент отдельно должен иметь авторизованное подключение LUCH/);
 assert.match(js,/Browser paired/);
 assert.doesNotMatch(js,/Put this page to work/);
});

test('first-run pairing explains supported prerequisites and five-minute code lifetime',()=>{
 const js=read('extension/popup.js');
 const broker=read('broker/server.mjs');
 assert.match(js,/supported LUCH setup/);
 assert.match(js,/eight-digit pairing code/);
 assert.match(js,/expires after five minutes/);
 assert.match(broker,/Создать код подключения/);
 assert.match(broker,/Generate pairing code/);
 assert.match(broker,/does not install the desktop app or authorize an AI host/);
 assert.match(broker,/пять минут/);
 assert.doesNotMatch(js,/15 minutes|15-minute|15 минут/i);
 assert.doesNotMatch(broker,/15 minutes|15-minute|15 минут/i);
});

test('tab permissions remain separate, session-scoped and fail closed',()=>{
 const manifest=JSON.parse(read('extension/manifest.json'));
 const js=read('extension/popup.js');
 const worker=read('extension/background.js');
 assert.deepEqual([...manifest.permissions].sort(),['activeTab','alarms','scripting','storage'].sort());
 assert.deepEqual(manifest.host_permissions,['http://127.0.0.1:9248/*']);
 for(const forbidden of ['cookies','history','debugger','webRequest','<all_urls>'])assert.ok(!JSON.stringify(manifest).includes(forbidden));
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
 assert.match(listing,/16 read\/inspection and 23 interaction\/navigation/);
 assert.match(listing,/not all functions of this extension/);
 assert.match(listing,/general public self-service setup is not yet available/i);
 assert.match(listing,/Opera runtime E2E is still required/);
 assert.match(listing,/not approved as the final plugin mark/);
 const privacy=read('../../docs/browser-companion-privacy.md');
 assert.match(privacy,/http:\/\/127\.0\.0\.1:9248/);
});
