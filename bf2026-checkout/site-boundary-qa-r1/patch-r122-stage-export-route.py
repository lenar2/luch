#!/usr/bin/env python3
"""Add optional secret-injected, read-only GetCourse Export API reader to isolated R121 stage."""
import re,sys
from pathlib import Path
if len(sys.argv)!=3:sys.exit("usage: patch-r122-stage-export-route.py STAGE/server.js R121_HTTP_MODULE")
server,module=(Path(x).resolve() for x in sys.argv[1:])
root=Path('/srv/factory-scratch/bf2026-r118-relay-stage-20261119').resolve()
if root not in server.parents:sys.exit("REFUSE_NON_ISOLATED_STAGE")
if not server.is_file() or not module.is_file():sys.exit("R122_STAGE_INPUT_MISSING")
s=server.read_text()
tag='BF2026_R121_BUNDLE_QA_READBACK_ROUTE'
pattern=r"const "+tag+r"=require\([^\n]+\)\.createQARouter\(\{qaAuthorized,pool:BF2026_R121_STAGE_POOL\}\);"
if len(re.findall(pattern,s))!=1:sys.exit("R121_PG_ROUTE_DECLARATION_NOT_UNIQUE")
export_module=str(module.parent/'getcourse-export-readback.cjs')
new=(
"const BF2026_R122_EXPORT_READER=(()=>{"
"const key=process.env.BF2026_GETCOURSE_API_KEY;"
"if(typeof key!=='string'||key.length<20||!BF2026_R121_STAGE_POOL)return null;"
"const x=require("+repr(export_module)+");"
"return x.createGetCourseExportReader({apiKeyProvider:()=>key,budget:x.createPostgresBudget(BF2026_R121_STAGE_POOL)});"
"})();\n"+
"const "+tag+"=require("+repr(str(module))+").createQARouter({qaAuthorized,pool:BF2026_R121_STAGE_POOL,exportReader:BF2026_R122_EXPORT_READER});"
)
updated,n=re.subn(pattern,lambda _:new,s)
if n!=1:sys.exit("R122_EXPORT_ROUTE_PATCH_MISMATCH")
server.write_text(updated)
print("R122_STAGE_OPTIONAL_READONLY_EXPORT_READER_WIRED")
