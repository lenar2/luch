#!/usr/bin/env python3
"""R115: install an authenticated callback HINT route into an ISOLATED R112 copy."""
import sys,json
from pathlib import Path
if len(sys.argv)!=4: sys.exit("usage: patch-r115-event-http.py STAGE/server.js MODULE.cjs STORE_MODULE.cjs")
server,module,store=[Path(x).resolve() for x in sys.argv[1:]]
if str(server).startswith("/srv/factory-scratch/bf2026-checkout-r2-20261119/"):
    sys.exit("REFUSE_PRODUCTION_WRITE")
if not all(x.is_file() for x in (server,module,store)):
    sys.exit("STAGING_INPUT_MISSING")
text=server.read_text()
if "BF2026_R115_EVENT_HINT_ROUTER" in text: sys.exit("ALREADY_INSTALLED")
needle="const server=http.createServer(async(req,res)=>{"
if text.count(needle)!=1: sys.exit("UNEXPECTED_R112_SOURCE")
lines=[
 "const BF2026_R115_EVENT_HINT_ROUTER=process.env.BF2026_R115_RELAY_ENABLED==='1'",
 " ? require("+json.dumps(str(module))+").createRelayHttpHandler({",
 "   secret:Buffer.from(process.env.BF2026_R115_RELAY_KEY_HEX||'', 'hex'),",
 "   store:require("+json.dumps(str(store))+").createInboxStore()",
 " }) : null;"
]
text=text.replace(needle,"\n".join(lines)+"\n"+needle)
marker=" if(path.startsWith('/api/checkout/_qa/native-order/'))"
if text.count(marker)!=1: sys.exit("EXISTING_QA_ROUTE_NOT_FOUND")
guard=[
 " if(path==='/api/checkout/_relay/payment-hint'){",
 "   if(!BF2026_R115_EVENT_HINT_ROUTER)return reply(res,404,{ok:false,code:'NOT_FOUND'});",
 "   return BF2026_R115_EVENT_HINT_ROUTER(req,res);",
 " }"
]
text=text.replace(marker,"\n".join(guard)+"\n"+marker)
server.write_text(text)
print("R115_ISOLATED_EVENT_HINT_ROUTE_PATCHED")
