import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f));
test('toolbar and extension icons are valid, size-matched PNGs derived from source-backed LUCH asset',()=>{
 const full=read('extension/assets/luch-brand-r22.svg').toString('utf8');
 const ray=read('extension/assets/luch-ray-mark.svg').toString('utf8');
 assert.match(full,/<svg /);
 assert.match(ray,/<svg /);
 assert.equal(crypto.createHash('sha256').update(full).digest('hex'),'79c2e907ee5ccd4ca77740319d1027e2acf4fb002f17cb62d6aac8e831285676');
 assert.equal(crypto.createHash('sha256').update(ray).digest('hex'),'72c318dbd742f26169ba9842e055ef019ce33054d5c0f086f089102afcf22fb2');
 const manifest=JSON.parse(read('extension/manifest.json'));
 assert.equal(manifest.minimum_chrome_version,'120');
 for(const size of [16,32,48,128]){
  const filename='extension/assets/icon-'+size+'.png';
  const file=read(filename);
  assert.equal(file.subarray(0,8).toString('hex'),'89504e470d0a1a0a',filename);
  assert.equal(file.readUInt32BE(16),size,filename+' width');
  assert.equal(file.readUInt32BE(20),size,filename+' height');
  assert.ok(file.length>250,filename+' should not be empty');
 }
});