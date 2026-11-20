'use strict';
/* One-shot stage-only activation. Requires an actual owner-signed 12-entry
 * manifest and the independently signed R127 ten-route revision manifest.
 * This writes the staging anti-rollback head only; never releases sales.
 */
const STAGE='/srv/factory-scratch/bf2026-r118-relay-stage-20261119';
function fail(code){const e=Error(code);e.code=code;throw e}
async function main(){
 if(process.env.BF2026_STAGE_ONLY!=='1'||
  process.env.BF2026_R130_APPLY_MANIFEST!=='1'||
  process.env.BF2026_R115_DB_POOL_MODULE!==STAGE+'/stage-pool-module.cjs')
  fail('R130_REFUSE_NON_STAGE_OR_UNAUTHORIZED_REGISTRATION');
 const registryModule=require('./r130-versioned-manifest.cjs');
 const publicKey=registryModule.loadRuntimeTrust(process.env);
 const envelope=registryModule.loadVersionedEnvelope(process.env);
 const routeManifest=require('./r127-signed-revision-manifest.cjs')
  .loadSignedRevisionManifest(process.env);
 if(!publicKey||!envelope||!routeManifest)
  fail('R130_OWNER_TRUST_OR_SIGNED_ROUTE_MANIFEST_UNAVAILABLE');
 const {pool}=require(STAGE+'/stage-pool-module.cjs');
 try{
  const registry=registryModule.createVersionedManifestRegistry({
   pool,publicKey,routeRevisionManifest:routeManifest,scope:registryModule.SCOPE
  });
  const result=await registry.register(envelope);
  process.stdout.write(JSON.stringify(result)+'\n');
 }finally{await pool.end()}
}
if(require.main===module)main().catch(e=>{
 process.stderr.write(String(e.code||'R130_MANIFEST_REGISTRATION_FAILED')+'\n');
 process.exitCode=1;
});
module.exports={main};
