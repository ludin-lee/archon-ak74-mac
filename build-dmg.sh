#!/bin/sh
# Builds dist/Archon AK74 (Mac).dmg for Apple Silicon.
set -e
cd "$(dirname "$0")"

ELECTRON=33.2.1
OUT=dist
APP="$OUT/dmg/Archon AK74.app"

npm install --omit=dev
rm -rf "$OUT" && mkdir -p "$OUT/dmg"
curl -sSL -o "$OUT/electron.zip" "https://github.com/electron/electron/releases/download/v$ELECTRON/electron-v$ELECTRON-darwin-arm64.zip"
ditto -x -k "$OUT/electron.zip" "$OUT/electron"
mv "$OUT/electron/Electron.app" "$APP"

mkdir -p "$APP/Contents/Resources/app"
cp -R main.js preload.js index.html package.json node_modules "$APP/Contents/Resources/app/"

PLIST="$APP/Contents/Info.plist"
plutil -replace CFBundleName -string "Archon AK74" "$PLIST"
plutil -replace CFBundleDisplayName -string "Archon AK74" "$PLIST"
plutil -replace CFBundleIdentifier -string "com.local.archon-ak74" "$PLIST"
codesign --force --deep -s - "$APP"

ln -s /Applications "$OUT/dmg/Applications"
hdiutil create -volname "Archon AK74" -srcfolder "$OUT/dmg" -ov -format UDZO "$OUT/Archon AK74 (Mac).dmg"
