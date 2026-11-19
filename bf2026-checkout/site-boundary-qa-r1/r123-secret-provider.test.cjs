'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createFileSecretProvider}=require('./r123-secret-provider.cjs');
const key='TEST_ONLY_KEY_'+('a'.repeat(30));
test('R123 secret provider reads only owner-private, pinned-account regular file; no disclosure',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bf2026-r123-secret-test-'));
 const filePath=path.join(root,'secret.json');
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const doc={account_host:'study.shkola-dnv.com',api_account_name:'qa_test_account',key};
 fs.writeFileSync(filePath,JSON.stringify(doc),{mode:0o600});
 const provider=createFileSecretProvider({root,filePath});
 const result=await provider.assertReady();
 assert.equal(result.credential_configured,true);
 assert.equal(JSON.stringify(result).includes(key),false);
 assert.equal(await provider.readKey(),key);
 fs.chmodSync(filePath,0o644);
 await assert.rejects(provider.readKey(),{code:'R123_SECRET_PERMISSIONS_INVALID'});
 fs.chmodSync(filePath,0o600);
 doc.account_host='wrong.example';fs.writeFileSync(filePath,JSON.stringify(doc),{mode:0o600});
 await assert.rejects(provider.readKey(),{code:'R123_SECRET_ACCOUNT_IDENTITY_INVALID'});
 doc.account_host='study.shkola-dnv.com';doc.api_account_name='';
 fs.writeFileSync(filePath,JSON.stringify(doc),{mode:0o600});
 await assert.rejects(provider.readKey(),{code:'R123_SECRET_ACCOUNT_IDENTITY_INVALID'});
 doc.api_account_name='qa_test_account';doc.email='not allowed';
 fs.writeFileSync(filePath,JSON.stringify(doc),{mode:0o600});
 await assert.rejects(provider.readKey(),{code:'R123_SECRET_SCHEMA_INVALID'});
 delete doc.email;
 fs.writeFileSync(filePath,JSON.stringify(doc),{mode:0o600});
 const symlink=path.join(root,'symlink.json');
 fs.symlinkSync(filePath,symlink);
 await assert.rejects(createFileSecretProvider({root,filePath:symlink}).readKey(),
  {code:'R123_SECRET_PERMISSIONS_INVALID'});
 assert.throws(()=>createFileSecretProvider({root,filePath:path.join(root,'..','escape.json')}),
  {code:'R123_SECRET_PATH_NOT_ALLOWLISTED'});
 fs.chmodSync(root,0o777);
 await assert.rejects(provider.readKey(),{code:'R123_SECRET_DIRECTORY_UNSAFE'});
});
