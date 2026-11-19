#!/usr/bin/env python3
"""R123 isolated-stage-only, CAS-like one-time route upgrade; no production files."""
import re,sys
from pathlib import Path
if len(sys.argv)!=2:sys.exit('usage: patch-r123-stage.py STAGE/server.js')
server=Path(sys.argv[1]).resolve()
root=Path('/srv/factory-scratch/bf2026-r118-relay-stage-20261119').resolve()
if server.parent!=root or not server.is_file():sys.exit('R123_REFUSE_NON_STAGE_SERVER')
s=server.read_text()
base=str(root/'site-boundary-qa-r1')
old=r'^const BF2026_R122_EXPORT_READER=\(\(\)=>\{[^\n]+\}\)\(\);$'
new=(
"const BF2026_R122_EXPORT_READER=(()=>{"
"if(!BF2026_R121_STAGE_POOL)return null;"
"const secret=require("+repr(base+'/r123-secret-provider.cjs')+").createStageSecretProvider();"
"if(!secret)return null;"
"const d=require("+repr(base+'/getcourse-export-readback.cjs')+");"
"return d.createGetCourseExportReader({apiKeyProvider:()=>secret.readKey(),"
"budget:d.createPostgresBudget(BF2026_R121_STAGE_POOL),strictProductIdentity:true});"
"})();"
)
s,n=re.subn(old,lambda m:new,s,flags=re.M)
if n!=1:sys.exit('R123_OLD_EXPORT_READER_NOT_EXACTLY_ONCE')
old2=r'^const BF2026_R121_BUNDLE_QA_READBACK_ROUTE=require\([^\n]+\)\.createQARouter\(\{qaAuthorized,pool:BF2026_R121_STAGE_POOL,exportReader:BF2026_R122_EXPORT_READER\}\);$'
replacement=(
"const BF2026_R123_READBACK_ONCE=BF2026_R122_EXPORT_READER?"
"require("+repr(base+'/r123-readback-once.cjs')+").createReadbackOnce({"
"pool:BF2026_R121_STAGE_POOL,reader:BF2026_R122_EXPORT_READER}):null;\n"
"const BF2026_R121_BUNDLE_QA_READBACK_ROUTE="
"require("+repr(base+'/r121-bundle-qa-http.cjs')+").createQARouter({qaAuthorized,"
"pool:BF2026_R121_STAGE_POOL,exportReader:BF2026_R122_EXPORT_READER,"
"readbackOnce:BF2026_R123_READBACK_ONCE});"
)
s,n=re.subn(old2,lambda m:replacement,s,flags=re.M)
if n!=1:sys.exit('R123_OLD_HTTP_ROUTE_NOT_EXACTLY_ONCE')
server.write_text(s)
print('R123_ISOLATED_READONLY_SECRET_AND_ONE_SHOT_ROUTE_WIRED')
