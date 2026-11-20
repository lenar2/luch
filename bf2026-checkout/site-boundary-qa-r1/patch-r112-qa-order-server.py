#!/usr/bin/env python3
"""Patch an isolated copy of R112 site server.js, never its production location."""
import sys
from pathlib import Path

if len(sys.argv) != 3:
    sys.exit("usage: python3 patch-r112-qa-order-server.py /path/to/isolated/server.js /absolute/path/to/module.cjs")
target = Path(sys.argv[1]).resolve()
module = Path(sys.argv[2]).resolve()
if str(target).startswith("/srv/factory-scratch/bf2026-checkout-r2-20261119/"):
    sys.exit("REFUSE_PRODUCTION_SITE_WRITE")
if not module.is_file() or not target.is_file():
    sys.exit("MISSING_MODULE_OR_STAGE")
s = target.read_text()
if "BF2026_R112_NATIVE_ORDER_QA" in s:
    sys.exit("ALREADY_PATCHED")
needle = "const server=http.createServer(async(req,res)=>{"
if s.count(needle) != 1:
    sys.exit("UNEXPECTED_SITE_SERVER_SHAPE")
insert = """const BF2026_R112_NATIVE_ORDER_QA=process.env.BF2026_ORDER_QA_ENABLED==='1'
 ? require(%r).createSiteQARouter({
   quoteFn:compute,manifest,qaAuthorize:qaAuthorized,
   hmacKeyHex:process.env.BF2026_QA_ORDER_HMAC_HEX
 }) : null;
""" % str(module)
s=s.replace(needle,insert+needle)
head = """ if(path.startsWith('/api/checkout/_qa/native-order/')){
   if(!BF2026_R112_NATIVE_ORDER_QA)return reply(res,404,{ok:false,code:'NOT_FOUND'});
   return BF2026_R112_NATIVE_ORDER_QA(req,res,path);
 }
"""
probe = " if(req.method==='GET'&&path==='/api/checkout/catalog'){"
if s.count(probe) != 1:
    sys.exit("UNEXPECTED_SITE_HTTP_ROUTE")
s=s.replace(probe,head+probe)
target.write_text(s)
print("ISOLATED_R112_NATIVE_QA_PATCH_INSTALLED", str(target))
