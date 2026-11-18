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

test('public code pairing is rate-limited by an atomic service-role RPC',()=>{
 assert.match(edge,/async function permitPairAttempt\(req:Request\)/);
 assert.match(edge,/admin\.rpc\("p029_pair_attempt_allowed"/);
 assert.match(edge,/\["global:pair",240,600\]/);
 assert.match(edge,/\[ipKey,18,600\]/);
 assert.match(edge,/if\(!await permitPairAttempt\(req\)\)/);
 assert.match(edge,/\{\s*"Retry-After":"600"\s*\}/);
});
test('OAuth users cannot fetch hashes or page results through PostgREST',()=>{
 const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261118073000_p029_remove_direct_data_api_reads.sql'),'utf8');
 for(const name of ['devices','pairings','grants','tab_overviews','jobs','audit_events'])
  assert.match(sql,new RegExp('revoke select on public\\.p029_browser_'+name+' from authenticated'));
});

test('approved-only tab discovery is isolated to owner and device, without all-tabs consent',()=>{
 const start=edge.indexOf('server.registerTool("browser_list_approved_tabs"');
 const end=edge.indexOf('server.registerTool("browser_list_open_tabs"',start);
 assert.ok(start>0&&end>start,'approved tab tool registered before optional all-tabs tool');
 const handler=edge.slice(start,end);
 assert.match(handler,/chooseDevice\(userId,deviceId,true\)/);
 assert.match(handler,/from\("p029_browser_grants"\)/);
 assert.match(handler,/\.eq\("user_id",userId\)\.eq\("device_id",device\.id\)/);
 assert.match(handler,/redactedUrl\(g\.url_redacted\)/);
 assert.match(handler,/onlyApprovedTabs:true/);
 assert.doesNotMatch(handler,/p029_browser_tab_overviews|ALL_TABS_USER_APPROVAL_REQUIRED|chrome\.permissions/);
});
