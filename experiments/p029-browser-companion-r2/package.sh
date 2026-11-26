#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
node --test tests/*.test.mjs >/dev/null
node security-qa.mjs >/dev/null
node --check extension/background.js
node --check extension/dom-ops.js
node --check extension/extended-dom-ops.js
node --check extension/popup.js
node --check broker/server.mjs
node --check bridge-integration/integrate.mjs
node --check bridge-integration/browser-companion-routes.mjs
python3 -m json.tool extension/manifest.json >/dev/null
mkdir -p dist
name="LUCH-Browser-Companion-v$(node -p 'require("./extension/manifest.json").version').zip"
rm -f "dist/$name"
python3 - "$name" <<'PY'
from pathlib import Path
from zipfile import ZipFile,ZipInfo,ZIP_DEFLATED,ZIP_STORED
import sys
root=Path('extension')
dst=Path('dist')/sys.argv[1]
files=['manifest.json','background.js','dom-ops.js','extended-dom-ops.js','popup.html','popup.css','popup.js']
files+=['assets/icon-16.png','assets/icon-32.png','assets/icon-48.png','assets/icon-128.png']
files+=['_locales/en/messages.json','_locales/ru/messages.json']
stamp=(2026,11,27,0,0,0)
with ZipFile(dst,'w') as z:
 info=ZipInfo('assets/',date_time=stamp);info.create_system=3;info.external_attr=(0o755 << 16)|0x10;info.compress_type=ZIP_STORED;z.writestr(info,b'')
 for name in sorted(files):
  info=ZipInfo(name,date_time=stamp);info.create_system=3;info.external_attr=0o644 << 16;info.compress_type=ZIP_DEFLATED
  z.writestr(info,(root/name).read_bytes(),compress_type=ZIP_DEFLATED,compresslevel=9)
PY
python3 - "$name" <<'PY'
import zipfile,sys,json
from pathlib import Path
target=Path('dist')/sys.argv[1]
with zipfile.ZipFile(target) as z:
    manifest=json.loads(z.read('manifest.json'))
    assert manifest['name']=='LUCH Browser Companion'
    assert manifest['version']=='0.8.0'
    assert manifest['default_locale']=='en'
    assert manifest['description']=='__MSG_appDescription__'
    assert 'debugger' not in manifest['permissions']
    assert 'debugger' in manifest['optional_permissions']
    assert sorted(manifest.get('optional_permissions',[]))==['debugger','downloads','tabs']
    assert z.testzip() is None
    assert sorted(z.namelist())==sorted(['manifest.json','background.js','dom-ops.js','extended-dom-ops.js','popup.html','popup.css','popup.js','assets/','assets/icon-16.png','assets/icon-32.png','assets/icon-48.png','assets/icon-128.png','_locales/en/messages.json','_locales/ru/messages.json'])
PY
sha256sum "dist/$name" > "dist/$name.sha256"
printf 'PACKAGE=%s\n' "$PWD/dist/$name"
cat "dist/$name.sha256"