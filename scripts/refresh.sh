#!/usr/bin/env bash
# One-shot refresh: sync with upstream, then build and install the desktop app.
# This is what you run when you want to pull the latest upstream changes and
# get them running as the installed app with your local tweaks on top.
#
# Flags:
#   --skip-sync      skip the upstream sync step
#   --skip-build     skip the electron-builder step (use the last build)
#   --skip-install   skip copying the app to /Applications
#
# Typical usage:
#   ./scripts/refresh.sh                 # full refresh
#   ./scripts/refresh.sh --skip-sync     # just rebuild + reinstall (e.g. after a local tweak)
#   ./scripts/refresh.sh --skip-build    # reinstall last-built .app
#
# On an upstream conflict during sync, the script stops and leaves you in the
# rebase. Resolve each conflict, run `git rebase --continue`, then re-run this
# script (optionally with --skip-sync if you already finished the rebase + push
# manually).

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

SKIP_SYNC=0
SKIP_BUILD=0
SKIP_INSTALL=0
for arg in "$@"; do
  case "$arg" in
    --skip-sync) SKIP_SYNC=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --skip-install) SKIP_INSTALL=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

if [[ "$SKIP_SYNC" -eq 0 ]]; then
  echo "════════════════════════════════════════"
  echo " Step 1/2  Sync with upstream"
  echo "════════════════════════════════════════"
  ./scripts/sync-upstream.sh
else
  echo "(skipping sync)"
fi

if [[ "$SKIP_INSTALL" -eq 1 && "$SKIP_BUILD" -eq 1 ]]; then
  echo "(skipping build and install)"
  exit 0
fi

echo
echo "════════════════════════════════════════"
echo " Step 2/2  Build + install"
echo "════════════════════════════════════════"
INSTALL_ARGS=()
if [[ "$SKIP_BUILD" -eq 1 ]]; then
  INSTALL_ARGS+=(--skip-build)
fi
if [[ "$SKIP_INSTALL" -eq 1 ]]; then
  # No --skip-install flag in install-local.sh; just run the build manually.
  if [[ "$SKIP_BUILD" -eq 0 ]]; then
    bun run dist:desktop:dmg:arm64
  fi
  exit 0
fi
./scripts/install-local.sh "${INSTALL_ARGS[@]}"

echo
echo "✓ Refresh complete. Jass Code is launched with the latest upstream + your tweaks."
