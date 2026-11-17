import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {stage,preflight,launchAgentXML} from './desktop-setup.mjs';
import {AccountBindingError} from './account-binding.mjs';
import {verifiedLegacySource,stopKnownUnpairedLegacy,restartKnownLegacy} from './legacy-migration.mjs';

const MARKER='.luch-browser-companion-enabled';
const BROKER_LABEL='com.luch.browser-companion-managed';
const BRIDGE_LABEL='com.aifactory.browser-bridge';
const RELEASE='0.5.2';
function fail(code){throw new AccountBindingError(code)}
function digest(data){return crypto.createHash('sha256').update(data).digest('hex')}
function proc(command,args,timeout=15000){return execFileSync(command,args,{timeout,stdio:['ignore','pipe','pipe'],encoding:'utf8'})}
function atomic(file,data){
 const target=path.dirname(file),tmp=path.join(target,'.luch-stage-'+crypto.randomBytes(10).toString('hex'));
 fs.writeFileSync(tmp,data,{mode:0o600,flag:'wx'});
 try{fs.renameSync(tmp,file)}finally{try{fs.unlinkSync(tmp)}catch{}}
}
async function health(port,pathName='/health',headers={}){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),port===9240?10500:2500);
 try{const r=await fetch('http://127.0.0.1:'+port+pathName,{headers,signal:ctrl.signal,cache:'no-store'});
  return {status:r.status,json:await r.json()};
 }catch{return null}finally{clearTimeout(timer)}
}
async function until(fn,tries=12,delay=500){
 for(let i=0;i<tries;i++){const a=await fn();if(a)return a;await new Promise(r=>setTimeout(r,delay))}
 fail('SERVICE_STARTUP_HEALTH_FAILED')
}
function secureWrite(file,data){
 if(fs.existsSync(file))fail('INSTALL_DESTINATION_EXISTS');
 fs.writeFileSync(file,data,{flag:'wx',mode:0o600});
}
export async function install({home=os.homedir(),expectedDeviceId,migrateKnownLegacy=false}={}){
 const verified=await preflight({home,expectedDeviceId});
 if(verified.brokerStatus!=='free'){
  if(verified.brokerStatus!=='running-existing'||!migrateKnownLegacy)fail('EXISTING_BROKER_REQUIRES_MANAGED_MIGRATION');
  verifiedLegacySource(home);
 }
 const bridgeRoot=verified.bridgeRoot;
 const releaseDir=path.join(home,'Library','Application Support','LUCH','Browser Companion','releases',RELEASE);
 const launchPath=path.join(home,'Library','LaunchAgents',BROKER_LABEL+'.plist');
 if(fs.existsSync(releaseDir)||fs.existsSync(launchPath))fail('PREVIOUS_INSTALL_REQUIRES_REVIEW');
 const stageDir=releaseDir+'.staging-'+crypto.randomBytes(6).toString('hex');
 let prepared=null,brokerStarted=false,bridgeChanged=false,markerAdded=false,legacyStopped=null;
 const originals=new Map(),created=[];
 const files=['server.mjs','browser-companion-adapter.mjs','browser-companion-consented-adapter.mjs',
   'browser-companion-broker.mjs','browser-companion-routes.mjs'];
 const bridgeFile=path.join(bridgeRoot,'server.mjs');
 const backup=(dest)=>{
  if(fs.existsSync(dest)){const st=fs.lstatSync(dest);if(!st.isFile()||st.isSymbolicLink())fail('BRIDGE_SOURCE_UNSAFE');
   originals.set(dest,{data:fs.readFileSync(dest),mode:st.mode&0o777});
  }else{originals.set(dest,null);created.push(dest)}
 };
 const domain='gui/'+process.getuid();
 const launch=(...args)=>proc('/bin/launchctl',args,18000);
 try{
  prepared=await stage({home,expectedDeviceId,outputDir:stageDir});
  // Preserve an exact rollback copy of the live bridge before writing anything.
  for(const name of files)backup(path.join(bridgeRoot,name));
  const liveHash=digest(fs.readFileSync(bridgeFile));
  if(liveHash!==verified.sourceSHA)fail('BRIDGE_CHANGED_DURING_INSTALL');
  const latest=await health(9240);
  if(latest?.json?.schema!=='browser-bridge.health.v2' ||
     Number(latest.json.chat_bridge_execution_leases?.active_count||0)>0)fail('BRIDGE_HAS_ACTIVE_WORK');
  if(verified.brokerStatus==='running-existing'){
   legacyStopped=await stopKnownUnpairedLegacy({home,port:9248});
  }
  if(await health(9248))fail('BROKER_PORT_OCCUPIED_DURING_INSTALL');
  fs.mkdirSync(releaseDir,{recursive:true,mode:0o700});
  const runner=path.join(releaseDir,'broker.mjs');
  secureWrite(runner,fs.readFileSync(path.join(stageDir,'broker.mjs')));
  const agentXML=launchAgentXML({node:verified.node,runner,
    tokenFile:path.join(bridgeRoot,'.token'),
    stdout:path.join(releaseDir,'broker.out.log'),stderr:path.join(releaseDir,'broker.err.log')});
  secureWrite(launchPath,agentXML);
  proc('/usr/bin/plutil',['-lint',launchPath],4000);
  launch('bootstrap',domain,launchPath);brokerStarted=true;
  await until(async()=>{const h=await health(9248);return h?.json?.service==='luch-browser-companion-broker'&&h.json.ok===true});
  // Changing a shared Browser Bridge is the last step after staged syntax and port checks.
  for(const name of files){
   const content=fs.readFileSync(path.join(stageDir,'bridge',name));
   atomic(path.join(bridgeRoot,name),content);
   if(name==='server.mjs')bridgeChanged=true;
  }
  const marker=path.join(bridgeRoot,MARKER);
  if(fs.existsSync(marker))fail('UNEXPECTED_EXISTING_FEATURE_MARKER');
  secureWrite(marker,Buffer.from('p029-browser-companion-r6\n'));markerAdded=true;
  launch('kickstart','-k',domain+'/'+BRIDGE_LABEL);
  await until(async()=>{
   const a=await health(9240);
   if(a?.json?.schema!=='browser-bridge.health.v2'||a?.json?.ok!==true)return false;
   const secret=fs.readFileSync(path.join(bridgeRoot,'.token'),'utf8').trim();
   const b=await health(9240,'/v1/tabs?browser=chrome',{'x-browser-bridge-token':secret});
   return b?.status===200&&b?.json?.ok===true&&
     ['USER_TAB_PERMISSION_REQUIRED','USER_CONSENTED_TABS_ONLY'].includes(b.json.profileScope);
  },16,650);
  fs.rmSync(stageDir,{recursive:true,force:true});
  return {ok:true,deviceId:verified.accountId,managedBroker:true,bridgeIntegrated:true,
    firstRunUrl:'http://127.0.0.1:9248/setup',version:RELEASE};
 }catch(err){
  // A failed install MUST NOT leave the shared Bridge running an unverified combination.
  if(markerAdded)try{fs.unlinkSync(path.join(bridgeRoot,MARKER))}catch{}
  if(bridgeChanged)for(const [file,old]of originals){
   try{if(old===null){fs.rmSync(file,{force:true})}else atomic(file,old.data)}catch{}
  }
  if(bridgeChanged)try{launch('kickstart','-k',domain+'/'+BRIDGE_LABEL)}catch{}
  if(brokerStarted)try{launch('bootout',domain,launchPath)}catch{}
  if(legacyStopped)try{restartKnownLegacy({file:legacyStopped.file,node:verified.node,tokenFile:path.join(bridgeRoot,'.token')})}catch{}
  try{fs.unlinkSync(launchPath)}catch{}
  try{fs.rmSync(releaseDir,{recursive:true,force:true})}catch{}
  try{fs.rmSync(stageDir,{recursive:true,force:true})}catch{}
  throw err;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),pos=args.indexOf('--device-id');
 const selected=pos>=0?args[pos+1]:'';
 try{
  if(args[0]!=='--install')fail('INSTALL_COMMAND_REQUIRED');
  console.log(JSON.stringify(await install({expectedDeviceId:selected,migrateKnownLegacy:args.includes('--migrate-known-legacy')})));
 }catch(e){console.error('LUCH_INSTALL_ERROR='+String(e.code||e.message||'UNKNOWN').replace(/[^A-Z0-9_]/gi,'').slice(0,95));process.exitCode=1}
}
