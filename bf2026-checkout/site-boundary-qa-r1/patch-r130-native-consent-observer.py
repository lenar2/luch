#!/usr/bin/env python3
"""One-shot wiring of the optional R130 native-consent observer into R130 stage."""
from pathlib import Path
import sys
ROOT=Path('/srv/factory-scratch/bf2026-r118-relay-stage-20261119').resolve()
SITE=ROOT/'server.js'
if len(sys.argv)!=2 or Path(sys.argv[1]).resolve()!=SITE or not SITE.is_file():
 sys.exit('R130_CONSENT_OBSERVER_REFUSE_NON_STAGE_SITE')
s=SITE.read_text()
marker='loadConfiguredNativeConsentVerifier(process.env)'
if marker in s:sys.exit('R130_CONSENT_OBSERVER_ALREADY_WIRED')
old='nativeConsentVerifier:null,callbackGuard:BF2026_R130_VERSIONED_REGISTRY.assertCallback'
if s.count(old)!=1:sys.exit('R130_CONSENT_OBSERVER_R127_BOUNDARY_ANCHOR_MISSING')
module=str(ROOT/'site-boundary-qa-r1'/'r130-native-consent-observer.cjs')
new='nativeConsentVerifier:require('+repr(module)+').loadConfiguredNativeConsentVerifier(process.env),callbackGuard:BF2026_R130_VERSIONED_REGISTRY.assertCallback'
backup=SITE.with_name('server.js.before-r130-consent-observer.backup')
temp=SITE.with_name('server.js.r130-consent-observer.tmp')
if backup.exists() or temp.exists():sys.exit('R130_CONSENT_OBSERVER_BACKUP_OR_TEMP_EXISTS')
backup.write_text(SITE.read_text())
backup.chmod(SITE.stat().st_mode&0o777)
temp.write_text(s.replace(old,new,1))
temp.chmod(SITE.stat().st_mode&0o777)
temp.replace(SITE)
print('R130_OPTIONAL_NATIVE_CONSENT_OBSERVER_WIRED')
print('FLAG_OFF_OR_PRIVATE_FILES_ABSENT => verifier NULL; public consent remains HOLD')
print('TRANSPORT MUST BE OWNER-AUDITED READONLY; no provider call is made by this patch')
