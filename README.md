# T3 Code

> [!NOTE]
> **This is a personal fork of [`pingdotgg/t3code`](https://github.com/pingdotgg/t3code).**
>
> Upstream ships updates on its own cadence, so I maintain small local tweaks here without waiting. The goal is to stay as close to upstream as possible while keeping a few personal behavioral changes.
>
> **How it's structured:**
>
> - `main` — clean mirror of `upstream/main`, never modified directly.
> - `personal` — default working branch. Local tweaks live here as commits prefixed with `[local]`.
> - Sync + rebuild + install in one shot: `./scripts/refresh.sh`. Conflict handling, per-step flags, and first-time setup live in [`WORKFLOW.md`](./WORKFLOW.md).
>
> See [`CHANGES.local.md`](./CHANGES.local.md) for the running list of local tweaks and [`WORKFLOW.md`](./WORKFLOW.md) for the full workflow. Everything below is upstream's README, unchanged.
>
> ---

T3 Code is a minimal web GUI for coding agents (currently Codex, Claude, and OpenCode, more coming soon).

## Installation

> [!WARNING]
> T3 Code currently supports Codex, Claude, and OpenCode.
> Install and authenticate at least one provider before use:
>
> - Codex: install [Codex CLI](https://developers.openai.com/codex/cli) and run `codex login`
> - Claude: install [Claude Code](https://claude.com/product/claude-code) and run `claude auth login`
> - OpenCode: install [OpenCode](https://opencode.ai) and run `opencode auth login`

### Run without installing

```bash
npx t3
```

### Desktop app

Install the latest version of the desktop app from [GitHub Releases](https://github.com/pingdotgg/t3code/releases), or from your favorite package registry:

#### Windows (`winget`)

```bash
winget install T3Tools.T3Code
```

#### macOS (Homebrew)

```bash
brew install --cask t3-code
```

#### Arch Linux (AUR)

```bash
yay -S t3code-bin
```

## Some notes

We are very very early in this project. Expect bugs.

We are not accepting contributions yet.

Observability guide: [docs/observability.md](./docs/observability.md)

## If you REALLY want to contribute still.... read this first

Before local development, prepare the environment and install dependencies:

```bash
# Optional: only needed if you use mise for dev tool management.
mise install
bun install .
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening an issue or PR.

Need support? Join the [Discord](https://discord.gg/jn4EGJjrvv).
