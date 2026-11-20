#!/usr/bin/env python3
"""Mount only the QA durable prepare endpoint on the R130 Lot10 isolated copy."""
from pathlib import Path
import sys
ROOT=Path('/srv/factory-scratch/bf2026-r130-lot10-stage-20261119').resolve()
SITE=ROOT/'server.js'
if len(sys.argv)!=2 or Path(sys.argv[1]).resolve()!=SITE or not SITE.is_file():
 sys.exit('R131_LOT10_REFUSE_NON_ISOLATED_STAGE')
s=SITE.read_text()
if 'BF2026_R131_LOT10_QA_PREPARE' in s:sys.exit('R131_ALREADY_PATCHED')
root='/srv/factory-scratch/bf2026-r118-relay-stage-20261119/site-boundary-qa-r1'
anchor='const server=http.createServer(async(req,res)=>{'
if s.count(anchor)!=1:sys.exit('R131_SERVER_ANCHOR_MISSING')
setup=(
 "const BF2026_R131_LOT10_QA_PREPARE=require("+repr(root+'/r131-lot10-qa-intent-http.cjs')
 +").createQaIntentRouter({pool:BF2026_R121_STAGE_POOL,quoteFn:compute,qaAuthorized});\n"
)
s=s.replace(anchor,setup+anchor,1)
route=" if(path.startsWith('/api/checkout/_qa/set-order/')||path.startsWith('/api/checkout/set/'))return BF2026_R130_LOT10_SET_ROUTER(req,res,path);"
if s.count(route)!=1:sys.exit('R131_LOT10_SET_ROUTER_ANCHOR_MISSING')
s=s.replace(route,
 " if(path==='/api/checkout/_qa/set-order/prepare'||path==='/api/checkout/_qa/set-order/intent')return BF2026_R131_LOT10_QA_PREPARE(req,res,path);\n"+route,1)
backup=SITE.with_name('server.js.before-r131-qa-stage.backup')
temp=SITE.with_name('server.js.r131-qa.tmp')
if backup.exists() or temp.exists():sys.exit('R131_BACKUP_EXISTS')
backup.write_text(SITE.read_text())
backup.chmod(SITE.stat().st_mode&0o777)
temp.write_text(s)
temp.chmod(SITE.stat().st_mode&0o777)
temp.replace(SITE)
print('R131_QA_INTENT_ONLY_MOUNTED_IN_ISOLATED_STAGE')
print('NO_EXTERNAL_ORDER_PAYMENT_OR_ACCESS_WRITES')
