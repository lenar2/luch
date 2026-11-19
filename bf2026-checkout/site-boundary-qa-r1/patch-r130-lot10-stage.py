#!/usr/bin/env python3
"""R130 Lot10 one-shot route patch for a SEPARATE isolated copy of R129 site.
Does not touch existing shared stage or another R130 versioned-manifest worker.
"""
from pathlib import Path
import sys
ROOT=Path('/srv/factory-scratch/bf2026-r130-lot10-stage-20261119').resolve()
SITE=ROOT/'server.js'
if len(sys.argv)!=2 or Path(sys.argv[1]).resolve()!=SITE or not SITE.is_file():
 sys.exit('R130_LOT10_REFUSE_NON_ISOLATED_STAGE')
s=SITE.read_text()
if 'BF2026_R130_LOT10_SET_ROUTER' in s:sys.exit('R130_LOT10_ALREADY_PATCHED')
setup=(
 "const BF2026_R130_LOT10_SET_ROUTER=require("
 +repr('/srv/factory-scratch/bf2026-r118-relay-stage-20261119/site-boundary-qa-r1/r130-set-http.cjs')
 +").createSetRouter({quoteFn:compute,qaAuthorized,origin:BASE_ORIGIN});\n"
)
anchor='const server=http.createServer(async(req,res)=>{'
if s.count(anchor)!=1:sys.exit('R130_LOT10_SERVER_ANCHOR_UNIQUE_REQUIRED')
s=s.replace(anchor,setup+anchor,1)
route=" if(path.startsWith('/api/checkout/_qa/consent-boundary/')||path.startsWith('/api/checkout/_qa/manifest/')"
if s.count(route)!=1:sys.exit('R130_LOT10_R130_MANIFEST_GATE_ANCHOR_MISSING')
s=s.replace(route,
 " if(path.startsWith('/api/checkout/_qa/set-order/')||path.startsWith('/api/checkout/set/'))return BF2026_R130_LOT10_SET_ROUTER(req,res,path);\n"+route,1)
backup=SITE.with_name('server.js.before-r130-lot10-stage.backup')
tmp=SITE.with_name('server.js.r130-lot10.tmp')
if backup.exists() or tmp.exists():sys.exit('R130_LOT10_ALREADY_INITIALIZED')
backup.write_text(SITE.read_text())
backup.chmod(SITE.stat().st_mode&0o777)
tmp.write_text(s);tmp.chmod(SITE.stat().st_mode&0o777);tmp.replace(SITE)
print('R130_LOT10_ISOLATED_SERVER_ROUTE_PATCHED')
print('PUBLIC_SET_PLAN_ONLY; NO_IMPORT_WRITE_OR_PAYMENT_ENABLED')
