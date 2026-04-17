# Local changes

Personal tweaks on top of upstream `pingdotgg/t3code`. Living on the `personal` branch.

## Convention

- Commit each local change as a small, focused commit prefixed with `[local]`, e.g.
  `[local] tweak agent picker default to claude`
- Keep each commit self-contained so it rebases cleanly.
- When a tweak becomes obsolete (upstream adopts the same change), drop it during rebase.

## Active tweaks

- **[local] rename app to Jass Code** — changes `APP_BASE_NAME` in `apps/desktop/src/appBranding.ts`. Propagates to window title, dock name, About panel, and the web UI's injected branding (via `apps/web/src/branding.ts` reading `injectedDesktopAppBranding.baseName`). Test at `apps/desktop/src/appBranding.test.ts` updated to match.

<!--
Example entry:

- **[local] <short title>** — one-line description of what changed and why.
  - Commit: `<sha>`
  - Files touched: `path/to/file.ts`
-->
