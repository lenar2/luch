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
test('exact 100 named Chrome/Opera actions are mapped from authenticated MCP',()=>{
 const op=[...names(edge,'READ_OPS'),...names(edge,'INTERACT_OPS'),...names(edge,'POINTER_OPS')];
 assert.equal(op.length,100);
 assert.equal(new Set(op).size,100);
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
 assert.equal(manifest.version,'0.8.1');
 assert.deepEqual(manifest.host_permissions,['https://api.lenarsalimov.ru/luch/browser/*']);
});
test('pairing instructions match the 10-minute code expiry',()=>{
 assert.match(popup,/ten minutes/);
 assert.match(popup,/десяти минут/);
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

test('one-time pairing is an atomic, role-restricted transaction (no eq-null race)',()=>{
 const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261118090000_p029_atomic_pairing_claim.sql'),'utf8');
 assert.match(sql,/create or replace function public\.p029_claim_pairing\(/);
 assert.match(sql,/for update;/);
 assert.match(sql,/used_at is null/);
 assert.match(sql,/expires_at > clock_timestamp\(\)/);
 assert.match(sql,/insert into public\.p029_browser_devices/);
 assert.match(sql,/update public\.p029_browser_pairings/);
 assert.match(sql,/revoke all on function public\.p029_claim_pairing/);
 assert.match(sql,/from public, anon, authenticated/);
 assert.match(sql,/to service_role/);
 assert.match(edge,/admin\.rpc\("p029_claim_pairing"/);
 assert.match(edge,/PAIRING_CODE_INVALID_OR_EXPIRED/);
 assert.doesNotMatch(edge,/\.eq\("used_at",null\)/);
 assert.doesNotMatch(edge,/PAIRING_RACE_RETRY/);
});

test('MV3 idle alarm is covered by an extended cloud reply window',()=>{
 // Chrome limits alarm periods to at least 30s and may delay them.
 assert.match(edge,/const ONLINE_MS = 90_000;/);
 assert.match(edge,/const JOB_WAIT_MS = 55_000;/);
 assert.match(edge,/expires_at:new Date\(Date\.now\(\)\+120_000\)/);
 assert.match(edge,/lease_until:new Date\(Date\.now\(\)\+60_000\)/);
 assert.match(worker,/chrome\.alarms\.create\('luch-poll',\{periodInMinutes:0\.5\}\)/);
});
test('bounded retention is scheduled and only privileged roles can purge',()=>{
 const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261121060000_p029_data_retention_cron.sql'),'utf8');
 assert.match(sql,/create extension if not exists pg_cron/);
 assert.match(sql,/create or replace function public\.p029_cleanup_data\(\)/);
 assert.match(sql,/delete from public\.p029_browser_jobs/);
 assert.match(sql,/delete from public\.p029_browser_pairings/);
 assert.match(sql,/delete from public\.p029_browser_tab_overviews/);
 assert.match(sql,/delete from public\.p029_browser_grants/);
 assert.match(sql,/delete from public\.p029_browser_audit_events/);
 assert.match(sql,/revoke all on function public\.p029_cleanup_data\(\) from public, anon, authenticated/);
 assert.match(sql,/p029-browser-companion-retention/);
});

test('grant heartbeats use upsert before pruning to avoid transient consent loss',()=>{
 const start=edge.indexOf('if(path.endsWith("/extension/grants"))');
 const stop=edge.indexOf('if(path.endsWith("/extension/tab-overview"))',start);
 assert.ok(start>=0&&stop>start);
 const handler=edge.slice(start,stop);
 assert.match(handler,/\.upsert\(rows,\{onConflict:"device_id,tab_id"\}\)/);
 assert.match(handler,/\.not\("tab_id","in"/);
 assert.doesNotMatch(handler,/\.delete\(\)\.eq\("device_id",device\.id\);\s*const rows/);
});
test('MCP browser action descriptions prefer approved tabs rather than all-tabs permission',()=>{
 assert.match(edge,/Find target IDs with browser_list_approved_tabs/);
 assert.match(worker,/let grantPublishQueue=Promise\.resolve\(\)/);
 assert.match(worker,/const current=await state\(\);/);
 assert.match(worker,/async function performJob\(job\)/);
 assert.match(worker,/USER_TAB_PERMISSION_REVOKED/);
});