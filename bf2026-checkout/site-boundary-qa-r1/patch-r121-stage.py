#!/usr/bin/env python3
"""Patch ONLY isolated R118 site-server copy. Never modify public/prod server."""
import sys, json
from pathlib import Path
if len(sys.argv)!=3: sys.exit("usage: patch-r121-stage.py STAGE/server.js R121_QA_MODULE")
server, mod = (Path(v).resolve() for v in sys.argv[1:])
if "bf2026-r118-relay-stage-20261119" not in str(server):
    sys.exit("REFUSE_NON_ISOLATED_STAGE")
if not server.is_file() or not mod.is_file(): sys.exit("INPUT_MISSING")
s=server.read_text()
tag="BF2026_R121_BUNDLE_QA_READBACK_ROUTE"
if tag in s:
    print("R121_ALREADY_INSTALLED");sys.exit(0)
needle="const server=http.createServer(async(req,res)=>{"
if s.count(needle)!=1: sys.exit("UNEXPECTED_SITE_SERVER_SOURCE")
s=s.replace(needle,"const "+tag+"=require("+json.dumps(str(mod))+").createQARouter({qaAuthorized});\n"+needle)
marker=" if(path.startsWith('/api/checkout/_qa/native-bundle/'))"
if s.count(marker)!=1: sys.exit("NATIVE_BUNDLE_ROUTE_NOT_FOUND")
s=s.replace(marker," if(path.startsWith('/api/checkout/_qa/native-bundle-readback/'))return "+tag+"(req,res,path);\n"+marker)
server.write_text(s)
print("R121_QA_READBACK_ROUTE_PATCHED_NO_PRODUCTION")
