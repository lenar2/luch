#!/usr/bin/env python3
"""R130 one-shot exact R129 staging integration. Never patches production."""
from pathlib import Path
import sys
ROOT=Path('/srv/factory-scratch/bf2026-r118-relay-stage-20261119').resolve()
SITE=ROOT/'server.js'
if len(sys.argv)!=2 or Path(sys.argv[1]).resolve()!=SITE or not SITE.is_file():
 sys.exit('R130_REFUSE_NON_STAGE_SITE')
s=SITE.read_text()
if 'BF2026_R130_MANIFEST_GATE' in s or 'BF2026_R130_VERSIONED_REGISTRY' in s:
 sys.exit('R130_ALREADY_APPLIED')
base=str(ROOT/'site-boundary-qa-r1')
def q(name):return repr(base+'/'+name)
owner="const BF2026_R129_OWNER_CONFIG=require("+q('r129-order-field-registry.cjs')+").loadOwnerSignedConfig(process.env);"
if s.count(owner)!=1:sys.exit('R130_OWNER_CONFIG_ANCHOR_MISSING')
insert=owner+(
 "\nconst BF2026_R127_REVISION_MANIFEST=require("+q('r127-consent-boundary.cjs')+").loadRevisionManifest(process.env);"
 "\nconst BF2026_R130_VERSIONED_REGISTRY=require("+q('r130-versioned-manifest.cjs')+").createVersionedManifestRegistry({"
 "pool:BF2026_R121_STAGE_POOL,"
 "publicKey:require("+q('r130-versioned-manifest.cjs')+").loadRuntimeTrust(process.env),"
 "routeRevisionManifest:BF2026_R127_REVISION_MANIFEST,scope:'BF2026_SITE'});"
)
s=s.replace(owner,insert,1)
old="revisionManifest:require("+q('r127-consent-boundary.cjs')+").loadRevisionManifest(process.env),"
if s.count(old)!=1:sys.exit('R130_R127_REVISION_LOAD_ANCHOR_MISSING')
s=s.replace(old,"revisionManifest:BF2026_R127_REVISION_MANIFEST,",1)
old=" nativeConsentVerifier:null});"
if s.count(old)!=1:sys.exit('R130_R127_BOUNDARY_OPTIONS_ANCHOR_MISSING')
s=s.replace(old," nativeConsentVerifier:null,callbackGuard:BF2026_R130_VERSIONED_REGISTRY.assertCallback});\n"+
 "const BF2026_R130_BOUNDARY=require("+q('r130-versioned-manifest.cjs')+").createManifestBoundBoundary({\n"+
 " boundary:BF2026_R127_CONSENT_BOUNDARY,registry:BF2026_R130_VERSIONED_REGISTRY});",1)
s=s.replace("boundary:BF2026_R127_CONSENT_BOUNDARY,qaAuthorized","boundary:BF2026_R130_BOUNDARY,qaAuthorized")
s=s.replace("boundary:BF2026_R127_CONSENT_BOUNDARY,quoteFn:compute","boundary:BF2026_R130_BOUNDARY,quoteFn:compute")
s=s.replace("consentBoundary:BF2026_R127_CONSENT_BOUNDARY,","consentBoundary:BF2026_R130_BOUNDARY,")
old="qaAuthorized});\nconst server=http.createServer(async(req,res)=>{"
if s.count(old)!=1:sys.exit('R130_FIELD_GATE_TO_SERVER_ANCHOR_MISSING')
s=s.replace(old,
 "qaAuthorized});\n"+
 "const BF2026_R130_MANIFEST_GATE=require("+q('r130-versioned-manifest.cjs')+").createManifestGate({\n"+
 " registry:BF2026_R130_VERSIONED_REGISTRY,fieldGate:BF2026_R129_FIELD_GATE,\n"+
 " qaConsentHttp:BF2026_R127_CONSENT_HTTP,qaAuthorized});\n"+
 "const server=http.createServer(async(req,res)=>{",1)
oldroutes=(
 " if(path.startsWith('/api/checkout/_qa/consent-boundary/'))return BF2026_R127_CONSENT_HTTP(req,res,path);\n"
 " if(path==='/api/checkout/_provider/getcourse/order-created'||path.startsWith('/api/checkout/consent/')||path.startsWith('/api/checkout/_qa/order-fields/'))return BF2026_R129_FIELD_GATE(req,res,path);"
)
if s.count(oldroutes)!=1:sys.exit('R130_R129_ROUTE_ANCHOR_MISSING')
newroutes=(
 " if(path.startsWith('/api/checkout/_qa/consent-boundary/')||path.startsWith('/api/checkout/_qa/manifest/')||"
 "path==='/api/checkout/_provider/getcourse/order-created'||path.startsWith('/api/checkout/consent/')||"
 "path.startsWith('/api/checkout/_qa/order-fields/'))return BF2026_R130_MANIFEST_GATE(req,res,path);"
)
s=s.replace(oldroutes,newroutes,1)
backup=SITE.with_name('server.js.before-r130-stage.backup')
temp=SITE.with_name('server.js.r130.tmp')
if backup.exists() or temp.exists():sys.exit('R130_BACKUP_OR_TEMP_ALREADY_EXISTS')
backup.write_text(SITE.read_text())
backup.chmod(SITE.stat().st_mode&0o777)
temp.write_text(s)
temp.chmod(SITE.stat().st_mode&0o777)
temp.replace(SITE)
print('R130_STAGE_SITE_PATCHED')
print('R130_VERSIONED_MANIFEST_REGISTRY_CONNECTED')
print('R127_NONCE_INSERT_AND_CALLBACK_LOCKED_TO_CURRENT_MANIFEST_HEAD')
print('ALL_TWELVE_ENTRIES_AND_TEN_ROUTES_REQUIRED')
print('MISSING_OWNER_MANIFEST_OR_R127_ROUTE_MANIFEST_STAYS_HOLD')
print('PRODUCTION_UNTOUCHED')
