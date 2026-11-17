import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {displayAccounts,validatedAccount,AccountBindingError} from './account-binding.mjs';

const COMPONENT_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const BRIDGE_SHA='4486892bbeab0623f82c69516d3570ce1f02c6b53e9913501945461e4712f345';
const BIND_PORT=9248,BRIDGE_PORT=9240;
function fail(code){throw new AccountBindingError(code)}
function sha(buffer){return crypto.createHash('sha256').update(buffer).digest('hex')}
function privateFile(p){
 const st=fs.lstatSync(p);
 if(!st.isFile()||st.isSymbolicLink()||st.uid!==process.getuid()||(st.mode&0o077)!==0)fail('UNSAFE_BRIDGE_CREDENTIAL');
 if(fs.readFileSync(p,'utf8').trim().length<24)fail('BRIDGE_CREDENTIAL_MISSING');
}
function nodeBinary(home){
 for(const p of ['/usr/local/bin/node','/opt/homebrew/bin/node',path.join(home,'.luch/node/v24.16.0/bin/node')])
  if(fs.existsSync(p)&&fs.statSync(p).isFile())return p;
 fail('INSTALL_OFFICIAL_LUCH_COMPANION_FIRST');
}
async function localHealth(port){
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),port===9240?10500:2500);
 try{const r=await fetch('http://127.0.0.1:'+port+'/health',{signal:ctrl.signal,cache:'no-store',redirect:'error'});
  if(!r.ok)return null;return await r.json();
 }catch{return null}
 finally{clearTimeout(timer)}
}
export async function preflight({home=os.homedir(),expectedDeviceId}={}){
 const account=await validatedAccount({home,expectedDeviceId});
 if(account.sourceAgent!=='com.aifactory.browser-bridge-companion')fail('BRIDGE_BUILD_UNSUPPORTED');
 const bridgeRoot=path.join(home,'AI-Factory','browser-bridge');
 const original=path.join(bridgeRoot,'server.mjs');
 if(!fs.existsSync(original)||sha(fs.readFileSync(original))!==BRIDGE_SHA)
  fail('BRIDGE_SOURCE_CHANGED_REQUIRE_REVIEW');
 privateFile(path.join(bridgeRoot,'.token'));
 const status=await localHealth(BRIDGE_PORT);
 if(status?.ok!==true||status.schema!=='browser-bridge.health.v2')fail('BRIDGE_NOT_HEALTHY');
 if(Number(status.chat_bridge_execution_leases?.active_count||0)>0)fail('BRIDGE_ACTIVE_WORK_BUSY');
 const broker=await localHealth(BIND_PORT);
 const brokerStatus=broker===null?'free':broker.service==='luch-browser-companion-broker'?'running-existing':'port-occupied';
 if(brokerStatus==='port-occupied')fail('BROKER_PORT_OWNED_BY_OTHER_APP');
 return {accountId:account.deviceId,deviceFile:account.deviceFile,
  sourceAgent:account.sourceAgent,bridgeRoot,node:nodeBinary(home),brokerStatus,sourceSHA:BRIDGE_SHA,
  ready:true};
}
export function launchAgentXML({node,runner,tokenFile,stdout,stderr}){
 const esc=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const pairs=[['Label','com.luch.browser-companion-managed'],['StandardOutPath',stdout],['StandardErrorPath',stderr]];
 const xml=['<?xml version="1.0" encoding="UTF-8"?>',
 '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
 '<plist version="1.0"><dict>'];
 for(const [k,v] of pairs)xml.push('<key>'+k+'</key><string>'+esc(v)+'</string>');
 xml.push('<key>ProgramArguments</key><array><string>'+esc(node)+'</string><string>'+esc(runner)+'</string></array>');
 xml.push('<key>EnvironmentVariables</key><dict><key>LUCH_BRIDGE_TOKEN_FILE</key><string>'+esc(tokenFile)+'</string></dict>');
 xml.push('<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>5</integer></dict></plist>');
 return xml.join('\n')+'\n';
}
function syntax(file,node){execFileSync(node,['--check',file],{timeout:5000,stdio:'ignore'})}
export async function stage({home=os.homedir(),expectedDeviceId,outputDir}={}){
 const status=await preflight({home,expectedDeviceId});
 if(!outputDir||!path.isAbsolute(outputDir)||fs.existsSync(outputDir))fail('NEW_STAGE_DIRECTORY_REQUIRED');
 fs.mkdirSync(outputDir,{recursive:true,mode:0o700});
 try{
  const generated=path.join(outputDir,'bridge');
  execFileSync(status.node,[path.join(COMPONENT_ROOT,'bridge-integration/integrate.mjs'),
   path.join(status.bridgeRoot,'server.mjs'),generated,COMPONENT_ROOT],
   {timeout:8000,stdio:['ignore','pipe','pipe']});
  const serverFile=path.join(generated,'server.mjs');
  let source=fs.readFileSync(serverFile,'utf8');
  const flag="process.env.LUCH_BROWSER_COMPANION_ENABLED === '1'";
  if(!source.includes(flag))fail('INTEGRATION_FEATURE_FLAG_MISSING');
  source=source.replace(flag,"(process.env.LUCH_BROWSER_COMPANION_ENABLED === '1' || fs.existsSync(path.join(ROOT,'.luch-browser-companion-enabled')))");
  fs.writeFileSync(serverFile,source,{mode:0o600});
  syntax(serverFile,status.node);
  const runner=path.join(outputDir,'broker.mjs');
  fs.copyFileSync(path.join(COMPONENT_ROOT,'broker/server.mjs'),runner,fs.constants.COPYFILE_EXCL);
  fs.chmodSync(runner,0o600);syntax(runner,status.node);
  const tokenFile=path.join(status.bridgeRoot,'.token');
  fs.writeFileSync(path.join(outputDir,'launchagent-preview.plist'),
   launchAgentXML({node:status.node,runner,tokenFile,
     stdout:path.join(outputDir,'broker.out.log'),stderr:path.join(outputDir,'broker.err.log')}),{mode:0o600});
  return {...status,prepared:true,stageDir:outputDir,patchedSHA:sha(fs.readFileSync(serverFile)),liveChanged:false};
 }catch(e){fs.rmSync(outputDir,{recursive:true,force:true});throw e}
}
const args=process.argv.slice(2);
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const arg=key=>{const idx=args.indexOf(key);return idx>=0?args[idx+1]:''};
 try{
  if(args[0]==='--list'){for(const a of displayAccounts())console.log([a.deviceId,a.label,a.agent].join('\t'))}
  else if(args[0]==='--check')console.log(JSON.stringify(await preflight({expectedDeviceId:arg('--device-id')})));
  else if(args[0]==='--stage')console.log(JSON.stringify(await stage({expectedDeviceId:arg('--device-id'),outputDir:arg('--output-dir')})));
  else{console.log('Available: --list; --check --device-id ID; --stage --device-id ID --output-dir NEW_PATH');process.exitCode=2}
 }catch(e){
  console.error('LUCH_SETUP_ERROR='+String(e?.code||e?.message||'UNKNOWN').replace(/[^A-Z0-9_]/gi,'').slice(0,100));
  process.exitCode=1;
 }
}
