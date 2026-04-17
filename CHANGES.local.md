# Local changes

Personal tweaks on top of upstream `pingdotgg/t3code`. Living on the `personal` branch.

## Convention

- Commit each local change as a small, focused commit prefixed with `[local]`, e.g.
  `[local] tweak agent picker default to claude`
- Keep each commit self-contained so it rebases cleanly.
- When a tweak becomes obsolete (upstream adopts the same change), drop it during rebase.

## Active tweaks

- **[local] rename app to Jass Code** — full rename across every user-visible surface:
  - `apps/desktop/src/appBranding.ts` → runtime `APP_BASE_NAME` (About panel, Electron `app.getName()`)
  - `apps/desktop/src/appBranding.test.ts` → test assertion updated
  - `apps/desktop/package.json` → `productName` drives `CFBundleName` (macOS menu bar, Dock, bundle filename)
  - `scripts/build-desktop-artifact.ts` → nightly hardcoded fallback and default
  - `apps/web/index.html` → static `<title>` and splash screen aria-label/alt (what shows before JS runs)
  - `apps/web/src/branding.ts` → fallback string for when branding isn't injected
  - **Bundle filename changes** from `T3 Code (Alpha).app` to `Jass Code (Alpha).app`. The bundle ID (`com.t3tools.t3code`) and Electron userData path (`~/Library/Application Support/T3 Code (Alpha)`, legacy-detected) are unchanged — so your existing chats, settings, and secrets carry over with zero migration.
  - **One-time cleanup on first install:** after running `install-local.sh`, remove the stale `/Applications/T3 Code (Alpha).app` manually: `rm -rf "/Applications/T3 Code (Alpha).app"`.

<!--
Example entry:

- **[local] <short title>** — one-line description of what changed and why.
  - Commit: `<sha>`
  - Files touched: `path/to/file.ts`
-->
