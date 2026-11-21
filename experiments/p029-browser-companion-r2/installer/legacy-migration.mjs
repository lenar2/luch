import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {AccountBindingError} from './account-binding.mjs';

const OLD_SHA='1bca73af69a07f5b7d6bd7df2cba4973c24256fe18b07d8d3dcc626e8afaf08e';
function fail(code){throw new AccountBindingError(code)}
export function legacyFile(home){
 return path.join(home,'Downloads','LUCH-Browser-Companion-Release','experiments',
  'p029-browser-companion-r2','broker','server.mjs');
}
export function verifiedLegacySource(home){
 const file=legacyFile(home);
 if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink())fail('UNKNOWN_EXISTING_BROKER');
 if(createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==OLD_SHA)
  fail('UNRECOGNIZED_EXISTING_BROKER_BUILD');
 return file;
}
export function legacyProcess({home,port=9248}={}){
 const file=verifiedLegacySource(home);
 let pid;
 try{pid=Number(execFileSync('/usr/sbin/lsof',
   ['-t','-nP','-iTCP:'+port,'-sTCP:LISTEN'],{encoding:'utf8',timeout:3000,stdio:['ignore','pipe','ignore']}).trim())}
 catch{fail('LEGACY_BROKER_PROCESS_NOT_FOUND')}
 if(!Number.isSafeInteger(pid)||pid<=1)fail('AMBIGUOUS_LEGACY_PROCESS');
 const cmd=execFileSync('/bin/ps',['-p',String(pid),'-o','command='],
    {encoding:'utf8',timeout:3500,stdio:['ignore','pipe','ignore']}).trim();
 if(!cmd.includes(file))fail('BROKER_PID_DOES_NOT_MATCH_KNOWN_SOURCE');
 return {pid,file};
}
async function currentHealth(port=9248){
 try{const r=await fetch('http://127.0.0.1:'+port+'/health',
  {signal:AbortSignal.timeout(2500),cache:'no-store'});
  if(!r.ok)fail('LEGACY_BROKER_HEALTH_INVALID');
  return await r.json();
 }catch(e){if(e instanceof AccountBindingError)throw e;return null}
}
export async function stopKnownUnpairedLegacy({home,port=9248}={}){
 const before=await currentHealth(port);
 if(before?.service!=='luch-browser-companion-broker'||before.paired!==false)
  fail('LEGACY_BROKER_HAS_SESSION_OR_UNKNOWN_STATE');
 const known=legacyProcess({home,port});
 // Verify the PID and executable path immediately before issuing SIGTERM.
 const again=legacyProcess({home,port});
 if(again.pid!==known.pid||again.file!==known.file)fail('LEGACY_BROKER_PID_CHANGED');
 process.kill(known.pid,'SIGTERM');
 for(let i=0;i<30;i++){
  await new Promise(r=>setTimeout(r,100));
  const now=await currentHealth(port);
  if(now===null)return known;
 }
 fail('LEGACY_BROKER_NOT_STOPPED');
}
export function restartKnownLegacy({file,node,tokenFile}){
 if(!file||!node||!tokenFile)fail('LEGACY_RESTART_CONFIG_MISSING');
 const child=spawn(node,[file],{
  env:{...process.env,LUCH_BRIDGE_TOKEN_FILE:tokenFile,LUCH_COMPANION_PORT:'9248'},
  detached:true,stdio:'ignore'
 });
 child.unref();
 return {attempted:true};
}
