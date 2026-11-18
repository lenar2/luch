#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/desktop-mac-preview"
APP="$OUT/LUCH Browser Companion Setup.app"
rm -rf "$OUT"
mkdir -p "$OUT"
osacompile -o "$APP" "$ROOT/installer/first-run.applescript"
RES="$APP/Contents/Resources"
mkdir -p "$RES/luch/installer" "$RES/luch/broker" "$RES/luch/bridge-integration" "$RES/luch/bridge-adapter"
cp "$ROOT/installer/"*.mjs "$RES/luch/installer/"
cp "$ROOT/broker/server.mjs" "$RES/luch/broker/"
cp "$ROOT/bridge-integration/"*.mjs "$RES/luch/bridge-integration/"
cp "$ROOT/bridge-adapter/consented-tab-adapter.mjs" "$RES/luch/bridge-adapter/"
cp "$ROOT/installer/install-browser-companion.sh" "$RES/"
chmod 755 "$RES/install-browser-companion.sh"
ICONSET="$OUT/LUCH.iconset"
mkdir -p "$ICONSET"
for size in 16 32 128 256 512; do
  sips -s format png -z "$size" "$size" "$ROOT/extension/assets/icon-128.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  dbl=$((size*2))
  sips -s format png -z "$dbl" "$dbl" "$ROOT/extension/assets/icon-128.png" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$RES/LUCH.icns"
/usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string LUCH.icns" "$APP/Contents/Info.plist" 2>/dev/null || /usr/libexec/PlistBuddy -c "Set :CFBundleIconFile LUCH.icns" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName LUCH Browser Companion Setup" "$APP/Contents/Info.plist" 2>/dev/null || true

codesign --force --sign - "$APP"
codesign --verify --deep --strict "$APP"
ditto -c -k --keepParent "$APP" "$OUT/LUCH-Browser-Companion-Setup-0.6.0-preview.zip"
shasum -a 256 "$OUT/LUCH-Browser-Companion-Setup-0.6.0-preview.zip"
echo "UNNOTARIZED_PREVIEW_ONLY=$APP"
