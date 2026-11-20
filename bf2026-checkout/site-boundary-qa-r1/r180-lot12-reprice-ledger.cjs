'use strict';
/* BF2026 R180 local-SSH repricer queue.
 * No GetCourse HTTP, no payments, no callbacks. Only owner-authorized Mac
 * worker may attest real native UI readback and promote ledger to PRICE_VERIFIED.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {buildLot12SetPlan}=require('./r154-lot12-set.cjs');
const DIR=process.env.BF2026_LOT12_LEDGER_DIR||'/srv/factory-scratch/bf2026-checkout-r2-20261119/r166-native-order-ledger';
const N15=/^[1-9][0-9]{9,17}$/;
const SHA=/^[a-f0-9]{64}$/;
function fail(s){throw Error('R180_'+s)}
function safeFile(dir,name) {
 if(!N15.test(String(name)))fail('DEAL_NUMBER_INVALID');
 const files=fs.readdirSync(dir);
 for(const f of files) {
  if(!/^[a-f0-9]{64}\.json$/.test(f))continue;
  const p=path.join(dir,f);
  const stat=fs.lstatSync(p);
  if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)continue;
  const rec=JSON.parse(fs.readFileSync(p,'utf8'));
  if(rec.deal_number===String(name))return {p,rec};
 }
 fail('DEAL_NOT_IN_LEDGER');
}
function validate(rec){
 if(rec.state!=='created_requires_price_readback'||
    !N15.test(String(rec.deal_number))||
    !/^[1-9]\d{6,17}$/.test(String(rec.deal_id))||
    !SHA.test(rec.plan_sha256)||!Number.isSafeInteger(rec.total_rub)||rec.total_rub<=0||
    !Array.isArray(rec.expected_lines)||rec.expected_lines.length<2||
    rec.expected_lines.length>7||rec.positions_done!==rec.expected_lines.length)
  fail('NOT_ELIGIBLE');
 const ids=new Set();
 let sum=0;
 for(const l of rec.expected_lines){
  if(!Number.isSafeInteger(l.offer_id)||l.offer_id<1||
     !Number.isSafeInteger(l.price_rub)||l.price_rub<=0||ids.has(l.offer_id))fail('INVALID_LINE');
  ids.add(l.offer_id);sum+=l.price_rub;
 }
 if(sum!==rec.total_rub)fail('PRICE_SUM_MISMATCH');
 return {offers:ids,sum};
}
function readAll(){
 const out=[];
 for(const f of fs.readdirSync(DIR)){
  if(!/^[a-f0-9]{64}\.json$/.test(f))continue;
  const p=path.join(DIR,f);
  try{
   const s=fs.lstatSync(p);
   if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077)!==0)continue;
   const rec=JSON.parse(fs.readFileSync(p,'utf8'));
   validate(rec);
   if(Date.now()-Date.parse(rec.started_at)>86400000)continue;
   out.push({deal_number:rec.deal_number,deal_id:rec.deal_id,
    expected_lines:rec.expected_lines,plan_sha256:rec.plan_sha256,total_rub:rec.total_rub,
    buyer_email_sha256:rec.buyer_email_sha256||null,nonce_sha256:rec.nonce_sha256||null});
  }catch{}
 }
 return out.sort((a,b)=>Number(a.deal_id)-Number(b.deal_id)).slice(0,30);
}
function atomicSave(p,rec){
 const tmp=p+'.r180-'+process.pid+'-'+crypto.randomBytes(5).toString('hex');
 fs.writeFileSync(tmp,JSON.stringify(rec),{mode:0o600,flag:'wx'});
 fs.renameSync(tmp,p);
}
function ack(dealNo,proof){
 const {p,rec}=safeFile(DIR,dealNo);
 const {offers}=validate(rec);
 if(proof.deal_number!==rec.deal_number||String(proof.deal_id)!==String(rec.deal_id)||
    proof.plan_sha256!==rec.plan_sha256||
    proof.native_status!=='new'||proof.native_paid_value!==0||
    proof.native_total_rub!==rec.total_rub||
    proof.reloaded!==true||proof.account_host!=='study.shkola-dnv.com'||
    !Array.isArray(proof.positions)||proof.positions.length!==rec.expected_lines.length)
  fail('NATIVE_PROOF_INVALID');
 const observed=new Map(),positionIds=new Set();
 for(const p0 of proof.positions){
  if(!offers.has(p0.offer_id)||observed.has(p0.offer_id)||
     !Number.isSafeInteger(p0.position_id)||p0.position_id<1||positionIds.has(p0.position_id)||
     !Number.isSafeInteger(p0.price_rub)||p0.price_rub<=0||
     p0.quantity!==1||p0.currency!=='RUB')fail('NATIVE_POSITIONS_INVALID');
  positionIds.add(p0.position_id);
  observed.set(p0.offer_id,p0.price_rub);
 }
 for(const l of rec.expected_lines)if(observed.get(l.offer_id)!==l.price_rub)
  fail('NATIVE_LINE_PRICE_MISMATCH');
 if(rec.buyer_email_sha256&&proof.buyer_email_sha256!==rec.buyer_email_sha256)
  fail('BUYER_MISMATCH');
 if(rec.nonce_sha256&&proof.native_nonce_sha256!==rec.nonce_sha256)
  fail('NONCE_MISMATCH');
 if(proof.native_plan_sha256!==rec.plan_sha256)
  fail('NATIVE_OFFER_REVISION_MISMATCH');
 // Read the current record a second time to avoid an overwritten newer state.
 const fresh=JSON.parse(fs.readFileSync(p,'utf8'));
 if(fresh.state!==rec.state||fresh.deal_id!==rec.deal_id||
    fresh.plan_sha256!==rec.plan_sha256)fail('CONCURRENT_RECORD_CHANGED');
 const verified=Object.freeze({
  ...fresh,state:'price_verified',native_total_readback_verified:true,
  price_verified_at:new Date().toISOString(),verified_positions:proof.positions,
  native_status:'new',verified_source:'GETCOURSE_ADMIN_CHROME_RELOAD',
 });
 atomicSave(p,verified);
 return {ok:true,deal_number:rec.deal_number,price_verified:true,total_rub:rec.total_rub};
}
function seed(dealNo,selection){
 const {p,rec}=safeFile(DIR,dealNo);
 if(rec.expected_lines)fail('ALREADY_SEEDED');
 if(rec.state!=='created_requires_price_readback')fail('STATE_MISMATCH');
 const plan=buildLot12SetPlan({selection});
 if(plan.plan_sha256!==rec.plan_sha256||plan.desired_order_total_rub!==rec.total_rub||
    plan.items_count!==rec.positions_done)fail('EXISTING_QUOTE_NOT_MATCHED');
 const changed={...rec,expected_lines:plan.lines.map(l=>({offer_id:l.offer_id,price_rub:l.discounted_line_price_rub}))};
 atomicSave(p,changed);
 return {ok:true,seeded_deal_number:dealNo,count:plan.items_count,total_rub:rec.total_rub};
}
const [mode,arg,proof]=process.argv.slice(2);
try{
 let result;
 if(mode==='list')result=readAll();
 else if(mode==='seed')result=seed(arg,JSON.parse(Buffer.from(proof,'base64').toString()));
 else if(mode==='ack')result=ack(arg,JSON.parse(Buffer.from(proof,'base64').toString()));
 else if(mode==='status'){
  const {rec}=safeFile(DIR,arg);
  result={deal_number:rec.deal_number,deal_id:rec.deal_id,state:rec.state,
   total_rub:rec.total_rub,positions_done:rec.positions_done,price_verified_at:rec.price_verified_at||null};
 }else fail('UNKNOWN_MODE');
 process.stdout.write(JSON.stringify(result)+'\n');
}catch(e){process.stderr.write(JSON.stringify({ok:false,code:e.message})+'\n');process.exitCode=1}
