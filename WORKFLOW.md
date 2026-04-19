# Fork workflow

This doc is the single reference for how to work with this fork of `pingdotgg/t3code`. Written so either you or an agent can execute any of these flows without re-deriving the approach each time.

## Repository layout

- **Upstream:** `pingdotgg/t3code` (remote: `upstream`, SSH: `git@github.jass:pingdotgg/t3code.git`)
- **Your fork:** `jassuwu/t3code` (remote: `origin`, SSH: `git@github.jass:jassuwu/t3code.git`)
- **Branches:**
  - `main` — clean mirror of `upstream/main`. Never modified directly. Tracks `upstream/main`.
  - `personal` — default working branch. All your tweaks live here as commits prefixed `[local]`.

## Scripts you care about

| Script                     | What it does                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `scripts/sync-upstream.sh` | Fetch upstream, fast-forward `main`, rebase `personal`, push to fork.                                  |
| `scripts/install-local.sh` | Build the macOS arm64 artifact and install it to `/Applications`, replacing the current installed app. |
| `scripts/refresh.sh`       | One-shot: runs `sync-upstream` then `install-local`.                                                   |

All three live at the repo root under `scripts/`. All accept `--help`-like flags documented in their own headers.

## Daily flows

### A. "I want the latest version installed, with my tweaks on top"

```bash
./scripts/refresh.sh
```

That's it. This:

1. Fetches upstream, fast-forwards `main`, rebases `personal` onto `main`, pushes to your fork.
2. Runs `bun run dist:desktop:dmg:arm64` (builds a fresh `.dmg` + `.zip` under `./release/`).
3. Extracts `Jass Code (Alpha).app` from the zip, quits the running app, replaces `/Applications/Jass Code (Alpha).app`, clears macOS quarantine, relaunches.

If the rebase hits a conflict, the script stops mid-rebase. You resolve each conflict, run `git rebase --continue` until done, then re-run `./scripts/refresh.sh --skip-sync` to do just the build+install half.

### B. "I want to make a new local tweak"

1. Make sure you're on `personal`: `git checkout personal`
2. Edit files.
3. Commit with the `[local]` prefix (small, self-contained commits rebase cleaner):
   ```bash
   git commit -am "[local] describe the tweak"
   ```
4. Push: `git push`
5. Rebuild + install:
   ```bash
   ./scripts/refresh.sh --skip-sync
   ```
6. Add an entry to [`CHANGES.local.md`](./CHANGES.local.md) describing what you changed and why, so future rebases know what to preserve. Commit that too.

### C. "I already pulled upstream manually, just rebuild"

```bash
./scripts/refresh.sh --skip-sync
```

### D. "I built recently; just reinstall"

```bash
./scripts/refresh.sh --skip-sync --skip-build
```

## Conflict resolution during sync

When upstream touches a file you modified locally, the rebase in `sync-upstream.sh` pauses. The conflict looks like a normal git merge conflict with `<<<<<<<`/`=======`/`>>>>>>>` markers. For each:

- **You want to keep upstream's version:** accept upstream's hunk, drop your change. Consider whether the corresponding `[local]` commit is still needed — if upstream adopted the same intent, remove your commit during rebase.
- **You want to keep your version:** accept your hunk. If upstream's change is useful too, merge by hand.
- **Both apply:** combine them manually.

After resolving, `git add <files> && git rebase --continue`. When the rebase ends, re-run `./scripts/refresh.sh --skip-sync` to build and install.

**Reference: [`CHANGES.local.md`](./CHANGES.local.md)** lists every local tweak with the reasoning — read this before resolving conflicts so you know whether each tweak is still intentional.

## First-time setup (new machine, reference only)

You've already done this, but for future reference:

```bash
# Clone the upstream
gcl git@github.jass:pingdotgg/t3code.git
cd t3code

# Reshape remotes: upstream + your fork
git remote rename origin upstream
git remote add origin git@github.jass:jassuwu/t3code.git

# Pull personal branch from the fork
git fetch origin
git checkout -b personal origin/personal

# main tracks upstream
git branch --set-upstream-to=upstream/main main

# Install deps + first build
bun install
./scripts/refresh.sh --skip-sync
```

## Troubleshooting

**Sync script fails with "non-fast-forward" pushing main:** someone/something pushed to `origin/main` on your fork. Reset it: `git push -f origin upstream/main:main`. `main` should only ever mirror upstream.

**Build succeeds but installed app still shows old behavior:** macOS Gatekeeper occasionally caches bundle metadata. Force a fresh launch: `killall 'Jass Code (Alpha)' 2>/dev/null ; open '/Applications/Jass Code (Alpha).app'`.

**Build fails on `turbo` cache errors:** `bun run clean && bun install && ./scripts/refresh.sh --skip-sync`.

**Upstream changed something fundamental (e.g. build system rewrite):** read the upstream commit, then decide whether your tweak still applies. `CHANGES.local.md` tells you _why_ each tweak exists so you can judge.

## Agent instructions

If you're an agent invoked to run this workflow:

- **"Sync my fork and reinstall"** → `./scripts/refresh.sh`
- **"Make a tweak to X"** → flow B above; don't forget `CHANGES.local.md`
- **"Resolve the rebase conflict"** → read `CHANGES.local.md` to decide per-tweak, finish the rebase, then `./scripts/refresh.sh --skip-sync`
- **Never change:** `LEGACY_USER_DATA_DIR_NAME` in `apps/desktop/src/main.ts`, the `localStorage` key prefixes starting with `t3code:`, or the `com.t3tools.t3code` bundle ID — all three preserve user data and settings across upstream versions.
- **Always commit with `[local] …` prefix** for any tweak that isn't a pure rebase of an upstream change.
