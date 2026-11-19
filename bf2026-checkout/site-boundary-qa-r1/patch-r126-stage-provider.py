#!/usr/bin/env python3
"""R126 independent, single-use isolated-stage server wiring.
R123 Export GET is reused; ten R124 single CTA gates remain HOLD.
Refuse production checkout site and duplicate patching.
"""
from pathlib import Path
import sys
if len(sys.argv)!=2: sys.exit('R126_USAGE_REQUIRED')
root=Path('/srv/factory-scratch/bf2026-r118-relay-stage-20261119').resolve()
site=Path(sys.argv[1]).resolve()
if site!=root/'server.js' or not site.is_file(): sys.exit('R126_REFUSE_NON_STAGE_SITE')
s=site.read_text()
if 'BF2026_R126_PROVIDER_VERIFY' in s:sys.exit('R126_ALREADY_PATCHED')
path=str(root/'site-boundary-qa-r1')
anchor="const server=http.createServer(async(req,res)=>{"
if s.count(anchor)!=1:sys.exit('R126_MISSING_SERVER_ANCHOR')
setup=(
"const BF2026_R126_PROVIDER_VERIFY=require("+repr(path+'/r126-provider-verification.cjs')+").createProviderVerification({\n"
" pool:BF2026_R121_STAGE_POOL,stage:BF2026_R124_SINGLE_STAGE,\n"
" readOnce:BF2026_R123_READBACK_ONCE,env:process.env,\n"
" observer:require("+repr(path+'/r126-approved-observer-loader.cjs')+").createConfiguredObserver(process.env)});\n"
"const BF2026_R126_PROVIDER_HTTP=require("+repr(path+'/r126-provider-verification-http.cjs')+").createProviderHttp({\n"
" provider:BF2026_R126_PROVIDER_VERIFY,qaAuthorized});\n"
)
s=s.replace(anchor,setup+anchor)
route=" if(path.startsWith('/api/checkout/_qa/single-form/'))return BF2026_R124_SINGLE_FORM_GATE.handle(req,res,path);"
if s.count(route)!=1:sys.exit('R126_SINGLE_ROUTE_ANCHOR_NOT_UNIQUE')
s=s.replace(route,route+"\n if(path.startsWith('/api/checkout/_qa/provider-verification/'))return BF2026_R126_PROVIDER_HTTP(req,res,path);")
form="   if(!BF2026_R124_SINGLE_FORM_GATE.publicRouteEligible(key))return reply(res,404,{ok:false,code:'NOT_FOUND'});"
if s.count(form)!=1:sys.exit('R126_FORM_GATE_ANCHOR_NOT_UNIQUE')
s=s.replace(form,form+"\n   try{if(!BF2026_R126_PROVIDER_VERIFY.route(key).public_release_allowed)return reply(res,404,{ok:false,code:'NOT_FOUND'});}catch{return reply(res,404,{ok:false,code:'NOT_FOUND'});}")
start="  if(q.kind==='single'&&!BF2026_R124_SINGLE_FORM_GATE.publicRouteEligible(checkoutKey(q))){httpStats.blocked++;return reply(res,503,{ok:false,code:'GETCOURSE_OFFER_NOT_READY',message:errors.NOT_READY,quote:q})}"
if s.count(start)!=1:sys.exit('R126_START_GATE_ANCHOR_NOT_UNIQUE')
s=s.replace(start,start+"\n  if(q.kind==='single'){\n   let r126;\n   try{r126=BF2026_R126_PROVIDER_VERIFY.route(checkoutKey(q))}catch{}\n   if(!r126||r126.public_release_allowed!==true){httpStats.blocked++;return reply(res,503,{ok:false,code:'GETCOURSE_OFFER_NOT_READY',message:errors.NOT_READY,quote:q})}\n  }")
if "if(registry.rollout_enabled!==true)return null;" not in s:
 sys.exit('R126_REJECT_PUBLIC_RELEASE_UNCHANGED')
temp=root/'server.js.r126.tmp'
if temp.exists():sys.exit('R126_TEMP_EXISTS')
temp.write_text(s)
temp.chmod(site.stat().st_mode&0o777)
temp.replace(site)
print('R126_STAGE_NATIVE_PROVIDER_VERIFIER_MOUNTED; EXPORT_REFRESH_DEFAULT_DISABLED; PUBLIC_SALES_HOLD')
