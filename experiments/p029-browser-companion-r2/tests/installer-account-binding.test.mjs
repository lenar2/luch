import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {verifiedDeviceFile,healthyCompanion,AccountBindingError} from '../installer/account-binding.mjs';
import {launchAgentXML} from '../installer/desktop-setup.mjs';
import {verifiedLegacySource} from '../installer/legacy-migration.mjs';
import crypto from 'node:crypto';

test('account binding refuses wrong owner, stale device and permissive credential file',()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'luch-owner-'));
 const file=path.join(base,'device.json');
 try{
  fs.writeFileSync(file,JSON.stringify({deviceId:'dev_testDeviceABCDEFG',deviceToken:'X'.repeat(40)}),{mode:0o600});
  assert.equal(verifiedDeviceFile(file,'dev_testDeviceABCDEFG').deviceId,'dev_testDeviceABCDEFG');
  assert.throws(()=>verifiedDeviceFile(file,'dev_someOtherDevice'),/DEVICE_ID_MISMATCH/);
  fs.chmodSync(file,0o644);
  assert.throws(()=>verifiedDeviceFile(file,'dev_testDeviceABCDEFG'),/INSECURE_DEVICE_FILE_MODE/);
  fs.chmodSync(file,0o600);
  fs.writeFileSync(file,JSON.stringify({deviceId:'dev_testDeviceABCDEFG',deviceToken:'short'}));
  assert.throws(()=>verifiedDeviceFile(file,'dev_testDeviceABCDEFG'),/DEVICE_CREDENTIAL_MISSING/);
  const link=path.join(base,'symlink.json');fs.symlinkSync(file,link);
  assert.throws(()=>verifiedDeviceFile(link,'dev_testDeviceABCDEFG'),/UNSAFE_DEVICE_FILE/);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});
test('requires genuine recent official Companion heartbeat',()=>{
 const clock=Date.now();
 const good={ok:true,schema:'luch.companion.local-health.v1',instance:'primary',pollAt:clock-2000};
 assert.equal(healthyCompanion(good,clock).ok,true);
 assert.throws(()=>healthyCompanion({...good,pollAt:clock-100000},clock),/COMPANION_NOT_AUTHENTICATED_RECENTLY/);
 assert.throws(()=>healthyCompanion({...good,instance:'public-local'},clock),/COMPANION_HEALTH_INVALID/);
 assert.throws(()=>healthyCompanion({...good,pollAt:0},clock),/COMPANION_NOT_AUTHENTICATED_RECENTLY/);
});
test('managed LaunchAgent has no credential contents and is per-user, loopback-only',()=>{
 const plist=launchAgentXML({node:'/usr/local/bin/node',runner:'/Users/test/Library/Application Support/LUCH/Browser Companion/broker.mjs',
 tokenFile:'/Users/test/AI-Factory/browser-bridge/.token',stdout:'/Users/test/broker.log',stderr:'/Users/test/broker.err'});
 assert.match(plist,/com\.luch\.browser-companion-managed/);
 assert.match(plist,/RunAtLoad/);
 assert.match(plist,/KeepAlive/);
 assert.match(plist,/LUCH_BRIDGE_TOKEN_FILE/);
 assert.doesNotMatch(plist,/deviceToken|Bearer |token_value|Password/);
});
test('legacy broker migration can only target specifically audited binary and path',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'luch-legacy-'));
 try{assert.throws(()=>verifiedLegacySource(root),/UNKNOWN_EXISTING_BROKER/)}
 finally{fs.rmSync(root,{recursive:true,force:true})}
});
