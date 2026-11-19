'use strict';
/* BF2026 R123. Read-only secret provider. The API key is never put in argv,
 * the deployment environment, HTTP requests, GitHub files, or audit output.
 * Only a privately provisioned regular 0600 JSON file may supply credentials.
 * This module never creates or modifies credentials. */
const fs=require('node:fs');
const path=require('node:path');
const TRUSTED_DIR='/srv/factory-scratch/bf2026-r118-relay-stage-20261119/private-credentials';
const HOST='study.shkola-dnv.com';
function fail(code){const e=new Error(code);e.code=code;throw e}
function createFileSecretProvider({filePath,root=TRUSTED_DIR,readFile=fs.readFileSync,
 lstat=fs.lstatSync,realpath=fs.realpathSync,uid=process.getuid?.()}={}){
 if(typeof root!=='string'||!path.isAbsolute(root))fail('R123_SECRET_ROOT_INVALID');
 if(typeof filePath!=='string'||!path.isAbsolute(filePath)||
    path.dirname(filePath)!==root||path.basename(filePath).startsWith('.'))
  fail('R123_SECRET_PATH_NOT_ALLOWLISTED');
 if(typeof uid!=='number')fail('R123_SECRET_OWNER_UNAVAILABLE');
 return Object.freeze({
  kind:'R123_FILE_SECRET_PROVIDER',
  async readKey(){
   let dir,st,real;
   try{dir=lstat(root);st=lstat(filePath);real=realpath(filePath)}
   catch{fail('R123_SECRET_FILE_UNAVAILABLE')}
   if(!dir.isDirectory()||dir.isSymbolicLink()||
     (dir.mode&0o022)!==0||dir.uid!==uid)fail('R123_SECRET_DIRECTORY_UNSAFE');
   if(!st.isFile()||st.isSymbolicLink()||st.uid!==uid||
      (st.mode&0o077)!==0||(st.mode&0o400)===0||st.size<70||st.size>2048||
      real!==filePath)fail('R123_SECRET_PERMISSIONS_INVALID');
   let obj;try{obj=JSON.parse(readFile(filePath,{encoding:'utf8',flag:'r'}))}
   catch{fail('R123_SECRET_JSON_INVALID')}
   if(!obj||Array.isArray(obj)||typeof obj!=='object'||
     Object.keys(obj).sort().join(',')!=='account_host,api_account_name,key')
    fail('R123_SECRET_SCHEMA_INVALID');
   if(obj.account_host!==HOST||typeof obj.api_account_name!=='string'||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{2,100}$/.test(obj.api_account_name))
    fail('R123_SECRET_ACCOUNT_IDENTITY_INVALID');
   if(typeof obj.key!=='string'||obj.key.length<20||obj.key.length>256||
      /\s/.test(obj.key))fail('R123_SECRET_KEY_INVALID');
   return obj.key;
  },
  async assertReady(){
   await this.readKey();
   return {credential_configured:true,account_host:HOST,api_account_name_bound:true};
  }
 });
}
function createStageSecretProvider(env=process.env){
 const filePath=env.BF2026_GETCOURSE_SECRET_FILE;
 if(!filePath)return null;
 return createFileSecretProvider({filePath});
}
module.exports={TRUSTED_DIR,HOST,createFileSecretProvider,createStageSecretProvider};
