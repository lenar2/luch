#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
node --test tests/*.test.mjs >/dev/null
node security-qa.mjs >/dev/null
node --check extension/background.js
node --check extension/popup.js
python3 -m json.tool extension/manifest.json >/dev/null
mkdir -p dist
name="LUCH-Browser-Companion-v$(node -p 'require("./extension/manifest.json").version').zip"
rm -f "dist/$name"
(cd extension && zip -q -9 -r "../dist/$name" manifest.json background.js popup.html popup.css popup.js assets)
python3 - "$name" <<'PY'
import zipfile,sys,json
from pathlib import Path
target=Path('dist')/sys.argv[1]
with zipfile.ZipFile(target) as z:
    manifest=json.loads(z.read('manifest.json'))
    assert manifest['name']=='LUCH Browser Companion'
    assert manifest['version']=='0.4.0'
    assert z.testzip() is None
    assert sorted(z.namelist())==sorted(['manifest.json','background.js','popup.html','popup.css','popup.js','assets/','assets/icon-16.png','assets/icon-32.png','assets/icon-48.png','assets/icon-128.png'])
PY
sha256sum "dist/$name" > "dist/$name.sha256"
printf 'PACKAGE=%s\n' "$PWD/dist/$name"
cat "dist/$name.sha256"
