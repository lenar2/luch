#!/usr/bin/env python3
"""Patch only a copy of R128 Lot10 iframe under dedicated R130 preview."""
from pathlib import Path
import hashlib,sys
root=Path('/srv/factory-scratch/bf2026-r130-lot10-frontend-20261119').resolve()
p=root/'www/assets/lot10-set/index.html'
src=Path('/srv/factory-scratch/bf2026-r118-relay-stage-20261119/site-boundary-qa-r1/r130-lot10-preview.js')
if len(sys.argv)!=2 or Path(sys.argv[1]).resolve()!=p or not p.is_file() or not src.is_file():
 sys.exit('R130_ISOLATED_PREVIEW_REQUIRED')
s=p.read_text()
a='<script src="assets/checkout-r109-set.js" defer></script></body></html>'
if s.count(a)!=1 or 'r130-lot10-preview.js' in s:sys.exit('R130_PREVIEW_SOURCE_MISMATCH')
p.write_text(s.replace(a,'<script src="assets/checkout-r109-set.js" defer></script><script src="assets/r130-lot10-preview.js" defer></script></body></html>'))
dest=p.parent/'assets/r130-lot10-preview.js'
if dest.exists():sys.exit('R130_PREVIEW_ALREADY_INSTALLED')
dest.write_bytes(src.read_bytes())
print('R130_IFRAME_SHA256',hashlib.sha256(p.read_bytes()).hexdigest())
print('R130_PREVIEW_JS_SHA256',hashlib.sha256(dest.read_bytes()).hexdigest())
print('NO_PUBLIC_SITE_OR_PROVIDER_WRITE')
