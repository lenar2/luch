#!/usr/bin/env python3
"""R124: mount single native form guard only in isolated BF2026 staging server.
No production paths, no GetCourse calls; atomic copy-on-write after exact matches.
"""
import re,sys
from pathlib import Path
if len(sys.argv)!=2:sys.exit('USAGE: patch-r124-stage-single.py STAGE/server.js')
server=Path(sys.argv[1]).resolve()
root=Path('/srv/factory-scratch/bf2026-r118-relay-stage-20261119').resolve()
if server!=root/'server.js' or not server.is_file():
 sys.exit('R124_REFUSE_NON_ISOLATED_STAGE_SERVER')
s=server.read_text()
if 'BF2026_R124_SINGLE_FORM_GATE' in s:
 sys.exit('R124_ALREADY_PATCHED_REFUSE_REAPPLY')
dir=str(root/'site-boundary-qa-r1')
anchor="const server=http.createServer(async(req,res)=>{"
if s.count(anchor)!=1:sys.exit('R124_SERVER_ANCHOR_NOT_UNIQUE')
setup=(
"const BF2026_R124_SINGLE_STAGE=require("+repr(dir+'/r124-stage-training-overlay.cjs')+").stageMetadata({catalog,registry});\n"
"const BF2026_R124_SINGLE_FORM_GATE=require("+repr(dir+'/r124-single-form-stage-gate.cjs')+").createSingleFormGate({\n"
" stage:BF2026_R124_SINGLE_STAGE,catalog,registry,quoteFn:compute,checkoutKey,qaAuthorized,pool:BF2026_R121_STAGE_POOL});\n"
)
s=s.replace(anchor,setup+anchor)
route_anchor=" if(path.startsWith('/api/checkout/_qa/native-bundle/'))return BF2026_R112_NATIVE_BUNDLE_QA_ROUTE(req,res,path);"
if s.count(route_anchor)!=1:sys.exit('R124_QA_ROUTE_ANCHOR_NOT_UNIQUE')
s=s.replace(route_anchor,route_anchor+"\n if(path.startsWith('/api/checkout/_qa/single-form/'))return BF2026_R124_SINGLE_FORM_GATE.handle(req,res,path);")
public_anchor=" if(req.method==='GET'&&path==='/api/checkout/form'){\n   const key=new URL(req.url,'http://localhost').searchParams.get('route');"
if s.count(public_anchor)!=1:sys.exit('R124_PUBLIC_FORM_ROUTE_ANCHOR_NOT_UNIQUE')
s=s.replace(public_anchor,public_anchor+
"\n   if(!BF2026_R124_SINGLE_FORM_GATE.publicRouteEligible(key))return reply(res,404,{ok:false,code:'NOT_FOUND'});")
start_anchor="  if(path==='/api/checkout/quote'){httpStats.quotes++;return reply(res,200,{ok:true,quote:q,availability:a})}"
if s.count(start_anchor)!=1:sys.exit('R124_PUBLIC_START_ANCHOR_NOT_UNIQUE')
s=s.replace(start_anchor,start_anchor+
"\n  if(q.kind==='single'&&!BF2026_R124_SINGLE_FORM_GATE.publicRouteEligible(checkoutKey(q))){httpStats.blocked++;return reply(res,503,{ok:false,code:'GETCOURSE_OFFER_NOT_READY',message:errors.NOT_READY,quote:q})}")
# Refuse risky substitution of release behavior for sets.
if 'registry.checkout_forms[key]' not in s or "if(registry.rollout_enabled!==true)return null;" not in s:
 sys.exit('R124_PUBLIC_GUARD_MISSING')
tmp=server.with_name('server.js.r124.tmp')
if tmp.exists():sys.exit('R124_TEMP_ALREADY_EXISTS')
tmp.write_text(s)
tmp.chmod(server.stat().st_mode & 0o777)
tmp.replace(server)
print('R124_MOUNTED_IN_REAL_ISOLATED_SERVER_FORM_AND_START_ROUTES')
