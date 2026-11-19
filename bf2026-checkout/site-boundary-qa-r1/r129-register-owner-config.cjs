'use strict';
/* Explicit one-shot owner-attested stage registration.
 * By default cannot execute: both required flags, signed owner file,
 * native field IDs and process ID are absent.
 * Updates ONLY existing R129 isolated staging ledger rows.
 */
const {loadOwnerSignedConfig,HOST,ROLES}=require('./r129-order-field-registry.cjs');
const STAGE='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
function fail(code){const e=Error(code);e.code=code;throw e}
async function registerOwnerAttestation({pool,owner,clock=()=>Date.now()}={}){
 if(!pool||typeof pool.connect!=='function'||!owner||
  owner.owner_signature_verified!==true||owner.public_release_allowed!==false)
  fail('R129_SIGNED_STAGE_REGISTRATION_DEPENDENCIES_REQUIRED');
 if(Date.parse(owner.expires_at)<=clock())fail('R129_OWNER_CONFIG_EXPIRED');
 const client=await pool.connect();let started=false;
 try{
  await client.query('BEGIN');started=true;
  const fields=await client.query(
   'SELECT * FROM bf2026_r129_order_fields WHERE account_host=$1 ORDER BY field_role FOR UPDATE',[HOST]);
  const processes=await client.query(
   'SELECT * FROM bf2026_r129_order_process WHERE account_host=$1 FOR UPDATE',[HOST]);
  if(fields.rows.length!==2||processes.rows.length!==1)
   fail('R129_STAGE_PRESEEDED_ROWS_MISSING');
  const all=fields.rows.map(x=>x.state).concat(processes.rows.map(x=>x.state));
  if(all.some(x=>!['UNVERIFIED','OWNER_ATTESTED_QA_ONLY'].includes(x)))
   fail('R129_UNEXPECTED_LEDGER_STATE');
  const already=all.every(x=>x==='OWNER_ATTESTED_QA_ONLY');
  if(!already&&all.some(x=>x!=='UNVERIFIED'))
   fail('R129_PARTIALLY_ATTESTED_LEDGER_REQUIRES_MANUAL_REVIEW');
  const sha=owner.signed_payload_sha256,verifiedAt=new Date(clock()).toISOString();
  if(!already){
   for(const role of ROLES){
    const f=owner.config.order_fields[role];
    await client.query(
     "UPDATE bf2026_r129_order_fields SET field_id=$3,native_readback_sha256=$4,"+
     "native_form_population_sha256=$5,owner_signed_payload_sha256=$6,"+
     "native_verified_at=$7,state='OWNER_ATTESTED_QA_ONLY',updated_at=now() "+
     "WHERE account_host=$1 AND field_role=$2 AND state='UNVERIFIED'",
     [HOST,role,f.field_id,f.readback_evidence_sha256,
      owner.form_population_evidence_sha256[role],sha,verifiedAt]
    );
   }
   await client.query(
    "UPDATE bf2026_r129_order_process SET process_id=$2,"+
    "native_process_readback_sha256=$3,owner_signed_payload_sha256=$4,"+
    "native_verified_at=$5,state='OWNER_ATTESTED_QA_ONLY',updated_at=now() "+
    "WHERE account_host=$1 AND state='UNVERIFIED'",
    [HOST,owner.process_id,owner.config.callback_process.readback_evidence_sha256,
     sha,verifiedAt]
   );
  }else{
   for(const row of fields.rows){
    const expected=owner.config.order_fields[row.field_role];
    if(!expected||String(row.field_id)!==String(expected.field_id)||
     row.owner_signed_payload_sha256!==sha||
     row.native_readback_sha256!==expected.readback_evidence_sha256||
     row.native_form_population_sha256!==owner.form_population_evidence_sha256[row.field_role])
     fail('R129_EXISTING_NATIVE_ATTESTATION_CONFLICT');
   }
   const p=processes.rows[0];
   if(String(p.process_id)!==String(owner.process_id)||
    p.owner_signed_payload_sha256!==sha||
    p.native_process_readback_sha256!==owner.config.callback_process.readback_evidence_sha256)
    fail('R129_EXISTING_PROCESS_ATTESTATION_CONFLICT');
  }
  await client.query('COMMIT');started=false;
  return Object.freeze({ok:true,state:'OWNER_ATTESTED_QA_ONLY',
   changed:!already,public_release_allowed:false,
   native_provider_consent_verified:false,provider_signature_verified:false});
 }catch(e){
  if(started)try{await client.query('ROLLBACK')}catch{}
  throw e;
 }finally{client.release()}
}
async function main(){
 if(process.env.BF2026_STAGE_ONLY!=='1'||
  process.env.BF2026_R129_APPLY_OWNER_CONFIG!=='1'||
  process.env.BF2026_STAGE_PG_POOL_MODULE!==STAGE+'/stage-pool-module.cjs')
  fail('R129_REFUSE_NON_STAGE_OR_UNAUTHORIZED_REGISTRATION');
 const owner=loadOwnerSignedConfig(process.env);
 if(!owner)fail('R129_NO_VERIFIED_NATIVE_GETCOURSE_ORDER_FIELD_OWNER_CONFIG');
 const {pool}=require(STAGE+'/stage-pool-module.cjs');
 try{const result=await registerOwnerAttestation({pool,owner});
  process.stdout.write(JSON.stringify(result)+'\n')}
 finally{await pool.end()}
}
if(require.main===module)main().catch(e=>{
 process.stderr.write(String(e.code||'R129_OWNER_REGISTRATION_FAILED')+'\n');
 process.exitCode=1;
});
module.exports={registerOwnerAttestation};
