#!/usr/bin/env python3
"""R129 one-shot, exact isolated R128 site server integration ONLY."""
from pathlib import Path
import sys
ROOT=Path('/srv/factory-scratch/bf2026-r118-relay-stage-20261119').resolve()
SITE=ROOT/'server.js'
if len(sys.argv)!=2 or Path(sys.argv[1]).resolve()!=SITE or not SITE.is_file():
 sys.exit('R129_REFUSE_NON_STAGE_SITE')
s=SITE.read_text()
if 'BF2026_R129_FIELD_GATE' in s or '/api/checkout/_qa/order-fields/' in s:
 sys.exit('R129_ALREADY_APPLIED')
base=str(ROOT/'site-boundary-qa-r1')
registry=repr(base+'/r129-order-field-registry.cjs')
boundary=repr(base+'/r127-consent-boundary.cjs')
gate=repr(base+'/r129-order-field-gate-http.cjs')
start="const BF2026_R127_CONSENT_BOUNDARY="
if s.count(start)!=1:sys.exit('R129_R127_CONSENT_ANCHOR_MISSING_OR_AMBIGUOUS')
s=s.replace(start,
 "const BF2026_R129_OWNER_CONFIG=require("+registry+").loadOwnerSignedConfig(process.env);\n"+start,1)
old="callbackSecret:(require("+repr(base+'/r128-order-callback-contract.cjs')+").loadVerifiedOrderCallbackConfig(process.env) ?require("+boundary+").loadCallbackSecret(process.env):null),"
new="callbackSecret:(BF2026_R129_OWNER_CONFIG?require("+boundary+").loadCallbackSecret(process.env):null),"
if s.count(old)!=1:sys.exit('R129_PREVIOUS_CALLBACK_SECRET_GATE_MISSING')
s=s.replace(old,new)
old="orderCallbackReady:Boolean(BF2026_R128_ORDER_CALLBACK_CONFIG)});"
if s.count(old)!=1:sys.exit('R129_R128_BRIDGE_SETUP_ANCHOR_MISSING')
s=s.replace(old,"orderCallbackReady:Boolean(BF2026_R129_OWNER_CONFIG)});")
server="const server=http.createServer(async(req,res)=>{"
if s.count(server)!=1:sys.exit('R129_SERVER_ANCHOR_AMBIGUOUS')
setup=(
 "const BF2026_R129_ORDER_REGISTRY=require("+registry+").createFieldRegistry({\n"
 " pool:BF2026_R121_STAGE_POOL,owner:BF2026_R129_OWNER_CONFIG});\n"
 "const BF2026_R129_FIELD_GATE=require("+gate+").createFieldGate({\n"
 " registry:BF2026_R129_ORDER_REGISTRY,consentBridge:BF2026_R128_CONSENT_BRIDGE,\n"
 " providerHttp:BF2026_R127_CONSENT_HTTP,consentBoundary:BF2026_R127_CONSENT_BOUNDARY,\n"
 " qaAuthorized});\n"
)
s=s.replace(server,setup+server,1)
routes=(
 " if(path.startsWith('/api/checkout/_qa/consent-boundary/')||"
 "path==='/api/checkout/_provider/getcourse/order-created')"
 "return BF2026_R127_CONSENT_HTTP(req,res,path);\n"
 " if(path.startsWith('/api/checkout/consent/'))"
 "return BF2026_R128_CONSENT_BRIDGE(req,res,path);"
)
if s.count(routes)!=1:sys.exit('R129_R128_ROUTING_NOT_EXACT')
newroutes=(
 " if(path.startsWith('/api/checkout/_qa/consent-boundary/'))return BF2026_R127_CONSENT_HTTP(req,res,path);\n"
 " if(path==='/api/checkout/_provider/getcourse/order-created'||"
 "path.startsWith('/api/checkout/consent/')||"
 "path.startsWith('/api/checkout/_qa/order-fields/'))return BF2026_R129_FIELD_GATE(req,res,path);"
)
s=s.replace(routes,newroutes)
backup=SITE.with_name('server.js.before-r129-stage.backup')
temp=SITE.with_name('server.js.r129.tmp')
if backup.exists() or temp.exists():sys.exit('R129_BACKUP_OR_TEMP_ALREADY_EXISTS')
backup.write_text(SITE.read_text())
backup.chmod(SITE.stat().st_mode&0o777)
temp.write_text(s)
temp.chmod(SITE.stat().st_mode&0o777)
temp.replace(SITE)
print('R129_STAGE_SITE_PATCHED')
print('R129_ORDER_FIELD_REGISTRY_DEFAULT_UNVERIFIED_AND_IDS_NULL')
print('R129_GETCOURSE_CALLBACK_WRAPPED_FAIL_CLOSED')
print('R129_PUBLIC_CHECKOUT_REMAINS_HOLD')
