'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const files={
 worker:fs.readFileSync(path.join(root,'extension/background.js'),'utf8'),
 broker:fs.readFileSync(path.join(root,'broker/server.mjs'),'utf8'),
 cloud:fs.readFileSync(path.join(root,'supabase/functions/p029-browser-companion/index.ts'),'utf8'),
 bridge:fs.readFileSync(path.join(root,'bridge-integration/browser-companion-routes.mjs'),'utf8')
};
const src=files.worker.slice(0,files.worker.indexOf('let working=false;'));
const ctx=vm.createContext({importScripts:()=>{}});
const result=vm.runInContext(src+'\n({read:[...READ_OPS],interact:[...INTERACT_OPS],pointer:[...POINTER_OPS]})',ctx);
const all=[...result.read,...result.interact,...result.pointer],unique=[...new Set(all)];
const missing={};
for(const [name,text] of Object.entries(files)){if(name==='worker')continue;missing[name]=all.filter(op=>!new RegExp('(?:["\'\\x60])'+op+'(?:["\'\\x60])').test(text));}
const summary={count:all.length,distinct:unique.length,read:result.read.length,interact:result.interact.length,pointer:result.pointer.length,duplicate:all.filter((x,i)=>all.indexOf(x)!==i),missing};
console.log(JSON.stringify(summary,null,2));
if(all.length!==100||unique.length!==100||Object.values(missing).some(x=>x.length))process.exitCode=1;