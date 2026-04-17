#!/usr/bin/env bash
# Sync `personal` branch with upstream/main via rebase.
#
# Flow:
#   1. Fetch upstream
#   2. Fast-forward local `main` to upstream/main (and push to fork's origin/main)
#   3. Rebase `personal` onto updated main
#   4. If rebase succeeds cleanly, push personal to origin (force-with-lease)
#   5. If conflicts: leave you in the rebase so you can resolve (yours vs theirs),
#      then run `git rebase --continue` and this script again to push.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "→ Fetching upstream..."
git fetch upstream

echo "→ Updating main from upstream..."
git checkout main
git merge --ff-only upstream/main
git push origin main

echo "→ Rebasing personal onto main..."
git checkout personal
if git rebase main; then
  echo "→ Rebase clean. Pushing personal to origin (force-with-lease)..."
  git push --force-with-lease origin personal
  echo "✓ Sync complete."
else
  echo
  echo "⚠ Rebase paused on a conflict."
  echo "  Resolve each conflict, then:"
  echo "    git add <files> && git rebase --continue"
  echo "  (or 'git rebase --abort' to bail out)"
  echo "  Once the rebase finishes, re-run this script to push."
  exit 1
fi
