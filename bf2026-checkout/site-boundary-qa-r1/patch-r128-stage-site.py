#!/usr/bin/env python3
"""R128 one-shot stage patch. Exact isolated BF2026 checkout only; never production."""
from pathlib import Path
import sys

ROOT=Path('/srv/factory-scratch/bf2026-r118-relay-stage-20261119').resolve()
SITE=ROOT/'server.js'
if len(sys.argv)!=2 or Path(sys.argv[1]).resolve()!=SITE or not SITE.is_file():
    sys.exit('R128_REFUSE_NON_STAGE_SERVER')
source=SITE.read_text()
if 'BF2026_R128_CONSENT_BRIDGE' in source or '/api/checkout/consent/' in source:
    sys.exit('R128_ALREADY_PATCHED')
if source.count('const BF2026_R127_CONSENT_BOUNDARY=')!=1:
    sys.exit('R128_R127_BOUNDARY_ANCHOR_NOT_UNIQUE')
if source.count("const BF2026_R127_CONSENT_HTTP=")!=1:
    sys.exit('R128_R127_HTTP_ANCHOR_NOT_UNIQUE')
if source.count("callbackSecret:require('/srv/factory-scratch/bf2026-r118-relay-stage-20261119/site-boundary-qa-r1/r127-consent-boundary.cjs').loadCallbackSecret(process.env),")!=1:
    sys.exit('R128_CALLBACK_SECRET_ANCHOR_NOT_UNIQUE')
if source.count("const server=http.createServer(async(req,res)=>{")!=1:
    sys.exit('R128_SERVER_ANCHOR_NOT_UNIQUE')
if source.count("if(path.startsWith('/api/checkout/_qa/consent-boundary/')||path==='/api/checkout/_provider/getcourse/order-created')return BF2026_R127_CONSENT_HTTP(req,res,path);")!=1:
    sys.exit('R128_R127_ROUTE_ANCHOR_NOT_UNIQUE')

base=str(ROOT/'site-boundary-qa-r1')
boundary=base+'/r127-consent-boundary.cjs'
contract=base+'/r128-order-callback-contract.cjs'
bridge=base+'/r128-consent-bridge-http.cjs'
replacement=(
 "callbackSecret:(require("+repr(contract)+").loadVerifiedOrderCallbackConfig(process.env)"
 " ?require("+repr(boundary)+").loadCallbackSecret(process.env):null),"
)
source=source.replace(
 "callbackSecret:require("+repr(boundary)+").loadCallbackSecret(process.env),",
 replacement)
setup=(
 "const BF2026_R128_ORDER_CALLBACK_CONFIG=require("+repr(contract)+").loadVerifiedOrderCallbackConfig(process.env);\n"
 "const BF2026_R128_CONSENT_BRIDGE=require("+repr(bridge)+").createConsentBridge({\n"
 " boundary:BF2026_R127_CONSENT_BOUNDARY,quoteFn:compute,checkoutKey,\n"
 " stage:BF2026_R124_SINGLE_STAGE,allowedOrigin:BASE_ORIGIN,\n"
 " orderCallbackReady:Boolean(BF2026_R128_ORDER_CALLBACK_CONFIG)});\n"
)
anchor="const server=http.createServer(async(req,res)=>{"
source=source.replace(anchor,setup+anchor)
route=" if(path.startsWith('/api/checkout/_qa/consent-boundary/')||path==='/api/checkout/_provider/getcourse/order-created')return BF2026_R127_CONSENT_HTTP(req,res,path);"
source=source.replace(route,route+"\n if(path.startsWith('/api/checkout/consent/'))return BF2026_R128_CONSENT_BRIDGE(req,res,path);")
backup=SITE.with_name('server.js.before-r128-site-patch.backup')
if backup.exists():sys.exit('R128_BACKUP_ALREADY_EXISTS')
temp=SITE.with_name('server.js.r128.tmp')
if temp.exists():sys.exit('R128_TEMP_ALREADY_EXISTS')
backup.write_text(SITE.read_text())
backup.chmod(SITE.stat().st_mode&0o777)
temp.write_text(source)
temp.chmod(SITE.stat().st_mode&0o777)
temp.replace(SITE)
print('R128_STAGE_SITE_PATCHED')
print('BACKUP='+str(backup))
print('NEW_ROUTES=/api/checkout/consent/{status,session,challenge}')
print('R127_CALLBACK_SECRET_REQUIRES_OWNER_READBACK_ORDER_CONFIG')
print('PUBLIC_CHECKOUT_STILL_HOLD; PRODUCTION_UNTOUCHED')
