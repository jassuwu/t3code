#!/usr/bin/env bash
# Build the macOS desktop app and install it to /Applications, replacing
# the currently installed version. Designed for personal use on arm64 Macs.
#
# Flow:
#   1. Run the electron-builder arm64 build (skippable with --skip-build)
#   2. Locate the built .app bundle in ./release
#   3. Quit any running instance
#   4. Replace /Applications/<App>.app with the fresh build
#   5. Relaunch

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
  esac
done

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "→ Building desktop artifact (arm64)..."
  bun run dist:desktop:dmg:arm64
fi

echo "→ Locating built artifact..."
# electron-builder's dmg target produces a .zip alongside the .dmg containing
# the raw .app bundle. Extract from the .zip (faster and more reliable than
# mounting the .dmg).
ZIP=$(ls -1t release/*-arm64.zip 2>/dev/null | head -n 1)
if [[ -z "$ZIP" ]]; then
  echo "✗ No arm64 zip found under ./release. Check build output."
  exit 1
fi
EXTRACT_DIR="$(mktemp -d -t t3code-install-XXXXXX)"
trap 'rm -rf "$EXTRACT_DIR"' EXIT
echo "   zip:     $ZIP"
echo "   extract: $EXTRACT_DIR"
unzip -q "$ZIP" -d "$EXTRACT_DIR"
BUILT_APP=$(find "$EXTRACT_DIR" -maxdepth 2 -type d -name "*.app" | head -n 1)
if [[ -z "$BUILT_APP" ]]; then
  echo "✗ No .app bundle inside $ZIP."
  exit 1
fi
APP_NAME=$(basename "$BUILT_APP")
INSTALLED_PATH="/Applications/$APP_NAME"
echo "   built:     $BUILT_APP"
echo "   installed: $INSTALLED_PATH"

echo "→ Quitting running instance (if any)..."
# Derive a likely process name from the bundle name (strip .app)
PROC_NAME="${APP_NAME%.app}"
osascript -e "tell application \"$PROC_NAME\" to quit" 2>/dev/null || true
# Also try the upstream bundle name in case this is a rename transition
osascript -e 'tell application "T3 Code (Alpha)" to quit' 2>/dev/null || true
# Give it a beat to actually exit
sleep 1
pkill -f "$PROC_NAME" 2>/dev/null || true
pkill -f "T3 Code" 2>/dev/null || true

echo "→ Replacing installed app..."
rm -rf "$INSTALLED_PATH"
cp -R "$BUILT_APP" "$INSTALLED_PATH"

echo "→ Clearing macOS quarantine attribute (unsigned local build)..."
xattr -dr com.apple.quarantine "$INSTALLED_PATH" 2>/dev/null || true

echo "→ Launching..."
open "$INSTALLED_PATH"

echo "✓ Installed $APP_NAME from local build."
