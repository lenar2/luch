'use strict';
// Deterministic decision table tests, synthetic response objects only.
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto');
const source=fs.readFileSync(path.join(__dirname,'../frontend/app.js'),'utf8');
const block=source.split('// BEGIN R83 DIAGNOSIS')[1].split('// END R83 DIAGNOSIS')[0].split('\n').slice(1).join('\n');
const context=vm.createContext({});vm.runInContext(block+'\nthis.diagnose=diagnoseWebsite;',context);
const diagnose=context.diagnose;
const standard={http_status:200,content_type:'text/html; charset=UTF-8',page_title:'Example',mobile_viewport:true,meta_description:true,bytes_examined:1000};
const cases=[
 ['healthy response not full health',standard,'responded',['journey'],['title','viewport','description']],
 ['missing title', {...standard,page_title:null},'responded',['title','journey'],['viewport']],
 ['missing viewport', {...standard,mobile_viewport:false},'responded',['viewport','journey'],['title']],
 ['missing description', {...standard,meta_description:false},'responded',['description','journey'],[]],
 ['unknown metadata no false missing',{...standard,page_title:undefined,mobile_viewport:null,meta_description:null},'responded',['journey'],['title','viewport','description']],
 ['non HTML no false metadata flags',{...standard,content_type:'application/json',page_title:null,mobile_viewport:false,meta_description:false},'responded',['content','journey'],['title','viewport','description']],
 ['204 no page body',{...standard,http_status:204,page_title:null},'responded',['content'],['title']],
 ['206 partial response',{...standard,http_status:206,page_title:null},'responded',['content'],['title']],
 ['301 redirect',{...standard,http_status:301,page_title:null},'redirect',['redirect_target'],['title','journey']],
 ['304 not modified',{...standard,http_status:304},'not_modified',['verify'],['redirect_target']],
 ['401 access denied',{...standard,http_status:401},'client_response',['access'],['title']],
 ['403 forbidden',{...standard,http_status:403},'client_response',['access'],['title']],
 ['404 missing homepage',{...standard,http_status:404},'client_response',['missing'],['title']],
 ['429 throttling',{...standard,http_status:429},'client_response',['rate'],['retry']],
 ['500 server error',{...standard,http_status:500},'server_error',['retry','operator'],['title']],
 ['503 server error',{...standard,http_status:503},'server_error',['retry','operator'],[]],
 ['unknown status',{},'unknown',['verify'],['journey']],
 ['malformed status string',{...standard,http_status:'200'},'unknown',['verify'],['journey']],
];
const results=[];
for(const [name,input,code,must,forbidden] of cases){
 for(const locale of ['en','ru']){
  const actual=diagnose(input,locale);
  assert.equal(actual.code,code,name+' '+locale);
  const ids=actual.actions.map(x=>x.code);
  for(const id of must)assert.ok(ids.includes(id),name+' missing '+id);
  for(const id of forbidden)assert.ok(!ids.includes(id),name+' unexpected '+id);
  assert.ok(actual.title&&actual.summary&&actual.limits&&actual.actions.every(x=>x.text&&x.evidence),name);
  results.push({name,locale,code,actions:Array.from(ids),ok:true});
 }
}
const failureBlock=source.split('// BEGIN R83 ATTEMPT STATUS')[1].split('// END R83 ATTEMPT STATUS')[0].split('\n').slice(1).join('\n');
vm.runInContext(failureBlock+'\nthis.failure=describeCheckFailure;',context);
for(const status of [null,401,403,422,429,503]){
 for(const locale of ['en','ru']){
  const f=context.failure(status,locale);
  assert.ok(f.title&&f.detail&&f.next);
  assert.ok(locale==='en'?f.title.includes('No new result'):f.title.includes('не подтверждён'));
  if(status===403)assert.ok(locale==='en'?f.detail.includes('not an HTTP status returned by the website'):f.detail.includes('не HTTP-статус'));
  results.push({name:'failed attempt '+status,locale,ok:true});
 }
}
const comparisonBlock=source.split('// BEGIN R832 COMPARISON')[1].split('// END R832 COMPARISON')[0].split('\n').slice(1).join('\n');
vm.runInContext(comparisonBlock+'\nthis.compare=compareObservations;',context);
const old={...standard,origin:'https://example.com',checked_at:100,sha256_prefix:'a'.repeat(24)};
const fresh={...old,checked_at:200};
for(const locale of ['en','ru']){
 const compare=(a,items)=>context.compare(a,items.map(result=>({result})),locale);
 for(const [name,actual,expected] of [
  ['same site stable',compare(fresh,[old]),[]],
  ['actual status changed',compare({...fresh,http_status:503},[old]),['http']],
  ['metadata changed',compare({...fresh,page_title:'New title',mobile_viewport:false},[old]),['title','viewport']],
  ['unknown metadata not false missing',compare({...fresh,mobile_viewport:null},[old]),[]],
  ['different sites never compared',compare(fresh,[{...old,origin:'https://example.org'}]),null],
  ['same timestamp not ordered',compare(fresh,[{...old,checked_at:200}]),null],
  ['ambiguous previous timestamp',compare(fresh,[old,{...old,http_status:404}]),null],
  ['changed content hash alone not repair',compare({...fresh,sha256_prefix:'b'.repeat(24)},[old]),[]],
  ['non-html not compared as missing metadata',compare({...fresh,content_type:'application/json',page_title:null},[old]),[]]
 ]){
  if(expected===null)assert.equal(actual,null,name);
  else{assert.ok(actual,name);assert.deepEqual(Array.from(actual.changes,x=>x.key),expected,name);assert.ok(actual.limits);}
  results.push({name:'comparison '+name,locale,ok:true});
 }
}
const report={status:'PASS',cases:results.length,synthetic_inputs:true,real_human_observations:0,source_sha256:crypto.createHash('sha256').update(source).digest('hex'),results};
if(process.env.EVIDENCE_PATH)fs.writeFileSync(process.env.EVIDENCE_PATH,JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,cases:report.cases,synthetic_inputs:true}));
