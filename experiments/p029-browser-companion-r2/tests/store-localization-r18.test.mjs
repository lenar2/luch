import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Chrome listing includes valid EN/RU manifest localization, not fake store labels',()=>{
 const manifest=JSON.parse(read('extension/manifest.json'));
 assert.equal(manifest.default_locale,'en');
 assert.equal(manifest.name,'LUCH Browser Companion');
 assert.equal(manifest.description,'__MSG_appDescription__');
 assert.equal(manifest.action.default_title,'__MSG_actionTitle__');
 for(const locale of ['en','ru']){
  const messages=JSON.parse(read('extension/_locales/'+locale+'/messages.json'));
  for(const k of ['appName','appDescription','actionTitle'])
   assert.ok(typeof messages[k]?.message==='string'&&messages[k].message.length>=8);
  assert.equal(messages.appName.message,manifest.name);
  assert.doesNotMatch(messages.appDescription.message,/localhost|127\.0\.0\.1:9248|15-?minute/i);
 }
});

test('the deterministic candidate ZIP includes both customer locales',()=>{
 const pkg=read('package.sh');
 for(const locale of ['en','ru'])
  assert.match(pkg,new RegExp('_locales/'+locale+'/messages\\.json'));
 assert.match(pkg,/zipfile\.ZipFile/);
});

test('HEA storefront emphasizes tab consent, explicit host support and actual screenshot',()=>{
 const listing=read('STORE_LISTING_HEA_R18.md');
 assert.match(listing,/Ваш ИИ может помогать/);
 assert.match(listing,/Your AI can do more than answer questions/);
 assert.match(listing,/совместимом ИИ/);
 assert.match(listing,/plan and workspace must support/);
 assert.match(listing,/must not pretend to be real UI/);
});
