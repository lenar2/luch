#!/usr/bin/env python3
"""Patch only the isolated BF2026 R118 staging copy to load R121 with its PG pool."""
import re,sys
from pathlib import Path
if len(sys.argv)!=3:sys.exit("usage: patch-r122-stage-route.py STAGE/server.js R121_MODULE")
server,module=(Path(x).resolve() for x in sys.argv[1:])
root=Path('/srv/factory-scratch/bf2026-r118-relay-stage-20261119').resolve()
if root not in server.parents:sys.exit("REFUSE_NON_ISOLATED_STAGE")
if not server.is_file() or not module.is_file():sys.exit("R122_STAGE_INPUT_MISSING")
s=server.read_text()
tag='BF2026_R121_BUNDLE_QA_READBACK_ROUTE'
pattern=r"const "+tag+r"=require\([^\n]+\)\.createQARouter\(\{qaAuthorized\}\);"
if s.count(tag)!=1:sys.exit("R121_ROUTE_TAG_NOT_UNIQUE")
new=(
"const BF2026_R121_STAGE_POOL=(()=>{"
"const p=process.env.BF2026_R115_DB_POOL_MODULE;"
"if(!p||!require('node:path').isAbsolute(p))return null;"
"const x=require(p);return typeof x.getPool==='function'?x.getPool():x.pool;"
"})();\n"+
"const "+tag+"=require("+repr(str(module))+").createQARouter({qaAuthorized,pool:BF2026_R121_STAGE_POOL});"
)
updated,n=re.subn(pattern,lambda _:new,s)
if n!=1:sys.exit("R121_ROUTE_PATCH_MISMATCH")
server.write_text(updated)
print("R122_STAGE_R121_ROUTE_PG_WIRED")
