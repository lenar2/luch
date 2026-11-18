import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const edge=fs.readFileSync(path.join(root,'supabase/functions/p029-browser-companion/index.ts'),'utf8');
const worker=fs.readFileSync(path.join(root,'extension/background.js'),'utf8');
const popup=fs.readFileSync(path.join(root,'extension/popup.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json'),'utf8'));

function names(source,setName) {
  const match=source.match(new RegExp('const '+setName+' = new Set\\(\\[([\\s\\S]*?)\\]\\)'));
  assert.ok(match,'Missing '+setName);
  return [...match[1].matchAll(/"([a-z_]+)"/g)].map(x=>x[1]);
}
test('exact 45 named Chrome/Opera actions are mapped from authenticated MCP',()=>{
 const op=[...names(edge,'READ_OPS'),...names(edge,'INTERACT_OPS'),...names(edge,'POINTER_OPS')];
 assert.equal(op.length,45);
 assert.equal(new Set(op).size,45);
 assert.match(edge,/const browserToolOps=\[\.\.\.ALL_OPS\]\.filter\(\(x\)=>x!=="list_open_tabs"\)/);
 assert.match(edge,/server\.registerTool\("browser_list_open_tabs"/);
});
test('database job columns map to the actual MV3 worker contract',()=>{
 assert.match(edge,/targetId:claimed\.target_id/);
 assert.match(edge,/toolName:claimed\.tool_name/);
 assert.match(worker,/job\.targetId/);
 assert.match(worker,/jobId:job\.id,result/);
});
test('lost ACK cannot retry an irreversible click',()=>{
 assert.doesNotMatch(edge, /status:"pending",claimed_at:null,lease_until:null/);
 assert.match(edge,/\.eq\("status","pending"\)/);
 assert.match(edge,/\.eq\("status","claimed"\)\.gt\("expires_at",nowIso\(\)\)/);
 assert.match(edge,/\.gt\("lease_until",nowIso\(\)\)/);
});
test('cloud OAuth bearer and device bearer remain distinct',()=>{
 assert.match(edge,/withOAuthProtectedResource\(/);
 assert.match(edge,/withSupabase\(\{auth:"user"\}\)/);
 assert.match(edge,/sha256Hex\(token\)/);
 assert.match(edge,/\.eq\("user_id",device\.user_id\)/);
 assert.match(edge,/validateTarget\(userId,device,op,args\)/);
 assert.equal(manifest.version,'0.7.0');
 assert.deepEqual(manifest.host_permissions,['https://api.lenarsalimov.ru/luch/browser/*']);
});
test('pairing instructions match the 10-minute code expiry',()=>{
 assert.match(popup,/ten minutes/);
 assert.match(popup,/десять минут/);
 assert.match(edge,/Date\.now\(\)\+600_000/);
 assert.doesNotMatch(popup,/локального Companion|локальную страницу подключения|five minutes/i);
});
