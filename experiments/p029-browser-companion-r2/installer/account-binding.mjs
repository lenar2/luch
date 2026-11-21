import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';

const OWNER_AGENT_SPECS=[
 {label:'com.aifactory.browser-bridge-companion',family:'AI-Factory'},
 {label:'com.luch.companion',family:'LUCH portable'}
];
const CANONICAL_RELAY='https://api.lenarsalimov.ru/browser-bridge-v1';
const SAFE_ID=/^dev_[A-Za-z0-9_-]{8,64}$/;
export class AccountBindingError extends Error {
 constructor(code){super(code);this.name='AccountBindingError';this.code=code}
}
function plistValue(p,key){
 try{return execFileSync('/usr/bin/plutil',['-extract',key,'raw','-o','-',p],{encoding:'utf8',timeout:1800,stdio:['ignore','pipe','ignore']}).trim()}
 catch{return ''}
}
function ownerOnly(file,uid=process.getuid?.()){
 const stat=fs.lstatSync(file);
 if(!stat.isFile()||stat.isSymbolicLink())throw new AccountBindingError('UNSAFE_DEVICE_FILE');
 if(uid!==undefined&&stat.uid!==uid)throw new AccountBindingError('FOREIGN_OWNER_DEVICE_FILE');
 if((stat.mode&0o077)!==0)throw new AccountBindingError('INSECURE_DEVICE_FILE_MODE');
 return stat;
}
export function verifiedDeviceFile(deviceFile,expectedDeviceId,{uid=process.getuid?.()}={}){
 if(typeof expectedDeviceId!=='string'||!SAFE_ID.test(expectedDeviceId))throw new AccountBindingError('ACCOUNT_DEVICE_SELECTION_REQUIRED');
 ownerOnly(deviceFile,uid);
 let data;
 try{data=JSON.parse(fs.readFileSync(deviceFile,'utf8'))}
 catch{throw new AccountBindingError('DEVICE_CREDENTIAL_INVALID')}
 if(!data||typeof data.deviceId!=='string'||!SAFE_ID.test(data.deviceId)||data.deviceId!==expectedDeviceId)
   throw new AccountBindingError('DEVICE_ID_MISMATCH');
 if(typeof data.deviceToken!=='string'||data.deviceToken.length<24)
   throw new AccountBindingError('DEVICE_CREDENTIAL_MISSING');
 return {deviceId:data.deviceId,credentialPresent:true,verifiedLocalFile:true};
}
export function healthyCompanion(value,now=Date.now()){
 if(!value||value.ok!==true||value.schema!=='luch.companion.local-health.v1'||value.instance!=='primary')
   throw new AccountBindingError('COMPANION_HEALTH_INVALID');
 const last=Number(value.pollAt||0);
 if(!Number.isFinite(last)||last<=0||last>now+5000||now-last>90_000)
   throw new AccountBindingError('COMPANION_NOT_AUTHENTICATED_RECENTLY');
 return {ok:true,lastPollAgeMs:now-last};
}
export async function probeHealth(port,{fetchImpl=fetch,now=Date.now()}={}){
 if(!Number.isInteger(port)||port<1024||port>65535)throw new AccountBindingError('COMPANION_PORT_INVALID');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),3000);
 try{const r=await fetchImpl('http://127.0.0.1:'+port+'/health',{signal:controller.signal,redirect:'error',cache:'no-store'});
  if(!r.ok)throw new AccountBindingError('COMPANION_HEALTH_FAILED');
  return healthyCompanion(await r.json(),now);
 }catch(e){if(e instanceof AccountBindingError)throw e;throw new AccountBindingError('COMPANION_HEALTH_FAILED')}
 finally{clearTimeout(timer)}
}
export function discoverAccounts({home=os.homedir()}={}){
 const launchdir=path.join(home,'Library','LaunchAgents'),list=[];
 for(const spec of OWNER_AGENT_SPECS){
  const plist=path.join(launchdir,spec.label+'.plist');
  if(!fs.existsSync(plist))continue;
  const file=plistValue(plist,'EnvironmentVariables.PUBLIC_APP_V1_DEVICE_FILE');
  const relay=plistValue(plist,'EnvironmentVariables.PUBLIC_APP_V1_RELAY');
  const port=Number(plistValue(plist,'EnvironmentVariables.PUBLIC_APP_V1_COMPANION_HEALTH_PORT'));
  if(relay!==CANONICAL_RELAY||!file||!path.isAbsolute(file)||!file.startsWith(home+path.sep))continue;
  if(!fs.existsSync(file))continue;
  let identity;
  try{
   ownerOnly(file);
   identity=JSON.parse(fs.readFileSync(file,'utf8'));
   if(!SAFE_ID.test(identity.deviceId||'')||typeof identity.deviceToken!=='string'||identity.deviceToken.length<24)continue;
  }catch{continue}
  list.push({deviceId:identity.deviceId,deviceFile:file,sourceAgent:spec.label,sourceFamily:spec.family,port});
 }
 return list;
}
export async function validatedAccount({home=os.homedir(),expectedDeviceId,fetchImpl=fetch,now=Date.now()}={}){
 const candidates=discoverAccounts({home}).filter(x=>x.deviceId===expectedDeviceId);
 if(candidates.length!==1)throw new AccountBindingError(candidates.length?'AMBIGUOUS_ACCOUNT_REGISTRATIONS':'AUTHORIZED_ACCOUNT_NOT_FOUND');
 const selected=candidates[0];
 verifiedDeviceFile(selected.deviceFile,expectedDeviceId);
 const health=await probeHealth(selected.port,{fetchImpl,now});
 return {deviceId:selected.deviceId,deviceFile:selected.deviceFile,sourceAgent:selected.sourceAgent,sourceFamily:selected.sourceFamily,health,validated:true};
}
export function displayAccounts({home=os.homedir()}={}){
 return discoverAccounts({home}).map(a=>({deviceId:a.deviceId,label:a.sourceFamily,agent:a.sourceAgent}));
}
