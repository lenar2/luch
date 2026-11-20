#!/usr/bin/env python3
"""Patch a TEST COPY of the currently deployed BF2026 R112 site checkout, not production."""
from pathlib import Path
import sys
if len(sys.argv)!=3: raise SystemExit("usage: patch-r112-native-bundle-qa.py /isolated/server.js /absolute/native-bundle-site-qa-http.cjs")
target=Path(sys.argv[1]).resolve()
module=Path(sys.argv[2]).resolve()
if target.parent==Path('/srv/factory-scratch/bf2026-checkout-r2-20261119') or str(target).startswith('/srv/factory-scratch/bf2026-checkout-r2-20261119/'):
 raise SystemExit('PRODUCTION_CHANGE_BLOCKED_BY_TEST_PATCHER')
if not target.is_file() or not module.is_file():raise SystemExit('MISSING_FILES')
body=target.read_text()
if "BF2026_R112_NATIVE_BUNDLE_QA_ROUTE" in body:raise SystemExit('ALREADY_INSTALLED')
root="const server=http.createServer(async(req,res)=>{"
route=" if(req.method==='GET'&&path==='/api/checkout/catalog'){"
if body.count(root)!=1 or body.count(route)!=1:raise SystemExit('SERVER_SHAPE_CHANGED')
init=("const BF2026_R112_NATIVE_BUNDLE_QA_ROUTE=require("+repr(str(module)) + ").createNativeBundleQARouter({\n"
      " quoteFn:compute,manifest,qaAuthorized,\n"
      " secretHex:crypto.createHmac('sha256',Buffer.from(qaSecret))\n"
      " .update('bf2026:r112:native-bundle:qa-only:v1').digest('hex')\n"
      "});\n")
body=body.replace(root,init+root)
body=body.replace(route,
 " if(path.startsWith('/api/checkout/_qa/native-bundle/'))return BF2026_R112_NATIVE_BUNDLE_QA_ROUTE(req,res,path);\n"+route)
target.write_text(body)
print('ISOLATED_BUNDLE_HTTP_ROUTE_INSTALLED',str(target))
