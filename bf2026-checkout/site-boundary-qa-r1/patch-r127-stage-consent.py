#!/usr/bin/env python3
"""R127 one-shot integration into the exact isolated BF2026 stage only."""
from pathlib import Path
import sys
if len(sys.argv)!=2:sys.exit('R127_USAGE_REQUIRED')
root=Path('/srv/factory-scratch/bf2026-r118-relay-stage-20261119').resolve()
site=Path(sys.argv[1]).resolve()
if site!=root/'server.js' or not site.is_file():sys.exit('R127_REFUSE_NON_STAGE_SERVER')
s=site.read_text()
if 'BF2026_R127_CONSENT_BOUNDARY' in s:sys.exit('R127_ALREADY_PATCHED')
if s.count('const BF2026_R126_PROVIDER_VERIFY=')!=1:sys.exit('R127_R126_ANCHOR_MISSING')
path=str(root/'site-boundary-qa-r1')
setup=(
"const BF2026_R127_CONSENT_BOUNDARY=require("+repr(path+'/r127-consent-boundary.cjs')+").createConsentBoundary({\n"
" pool:BF2026_R121_STAGE_POOL,stage:BF2026_R124_SINGLE_STAGE,\n"
" revisionManifest:require("+repr(path+'/r127-consent-boundary.cjs')+").loadRevisionManifest(process.env),\n"
" callbackSecret:require("+repr(path+'/r127-consent-boundary.cjs')+").loadCallbackSecret(process.env),\n"
" nativeConsentVerifier:null});\n"
"const BF2026_R127_CONSENT_HTTP=require("+repr(path+'/r127-consent-http.cjs')+").createConsentHttp({\n"
" boundary:BF2026_R127_CONSENT_BOUNDARY,qaAuthorized});\n"
)
anchor="const server=http.createServer(async(req,res)=>{"
if s.count(anchor)!=1:sys.exit('R127_SERVER_ANCHOR_NOT_UNIQUE')
s=s.replace(anchor,setup+anchor)
route=" if(path.startsWith('/api/checkout/_qa/provider-verification/'))return BF2026_R126_PROVIDER_HTTP(req,res,path);"
if s.count(route)!=1:sys.exit('R127_R126_HTTP_ROUTE_NOT_UNIQUE')
s=s.replace(route,route+"\n if(path.startsWith('/api/checkout/_qa/consent-boundary/')||path==='/api/checkout/_provider/getcourse/order-created')return BF2026_R127_CONSENT_HTTP(req,res,path);")
start="  const target=verifiedNativeForm(q);"
guard=(
"  const r127Consent=BF2026_R127_CONSENT_BOUNDARY.publicCheckoutDecision(q);\n"
"  if(!r127Consent.allowed){httpStats.blocked++;return reply(res,503,{ok:false,code:r127Consent.code,\n"
"   provider_consent_verified:false,client_checkbox_trusted:false,checkout_url:null,public_release_allowed:false,quote:q})}\n"
)
if s.count(start)!=1:sys.exit('R127_CHECKOUT_START_TARGET_NOT_UNIQUE')
s=s.replace(start,guard+start)
temp=root/'server.js.r127.tmp'
if temp.exists():sys.exit('R127_TEMP_EXISTS')
temp.write_text(s);temp.chmod(site.stat().st_mode&0o777);temp.replace(site)
print('R127_STAGE_CONSENT_BOUNDARY_MOUNTED; CALLBACK_DISABLED_WITHOUT_PRIVATE_SECRET; ALL_CHECKOUT_STARTS_HOLD')
