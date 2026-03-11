# c-c-statusline

A Deno-powered status line for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI.

Shows model info, context usage, rate limits, git status, session duration, and more — right in your terminal.

## Install

### Binary (recommended)

Downloads a precompiled binary from GitHub Releases. No runtime dependencies needed.

```bash
# Deno
deno run -A https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.ts

# npx
npx @babarot/c-c-statusline
```

### Options

Pass options during install to customize the statusline:

```bash
deno run -A https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.ts \
  --bar-style block --path-style short --theme tokyo-night
```

| Option | Values | Default | Description |
|---|---|---|---|
| `--bar-style` | `dot`, `block`, `fill` | `dot` | Progress bar style |
| `--path-style` | `parent`, `full`, `short`, `basename` | `parent` | Directory display style |
| `--theme` | See [Themes](#themes) | `default` | Color theme |
| `--time-style` | `absolute`, `relative` | `absolute` | Reset time format |
| `--ctx-label` | `ctx`, `unicode`, `minimal` | `ctx` | Context window label |

**Bar styles:**

| Style | Example |
|---|---|
| `dot` | `●●●●○○○○○○` |
| `block` | `▰▰▰▰▱▱▱▱▱▱` |
| `fill` | `████░░░░░░` |

**Path styles** (for `/Users/you/src/github.com/you/project`):

| Style | Example |
|---|---|
| `parent` | `you/project` |
| `full` | `~/src/github.com/you/project` |
| `short` | `~/s/g/you/project` |
| `basename` | `project` |

**Time styles:**

| Style | Example |
|---|---|
| `absolute` | `8:00pm`, `Mar 12, 2:00pm` |
| `relative` | `1h 30m left`, `2d 5h left` |

**Context window labels:**

| Style | Example |
|---|---|
| `ctx` | `ctx 32%` |
| `unicode` | `◈ 32%` |
| `minimal` | `32%` |

### Themes

Built-in color themes using 24-bit True Color (RGB). Each theme defines 8 semantic color roles (`primary`, `secondary`, `success`, `warning`, `caution`, `danger`, `muted`, `accent`), so every theme can map any color to any role.

| Theme | Description |
|---|---|
| `default` | Original palette |
| `tokyo-night` | [Tokyo Night](https://github.com/enkia/tokyo-night-vscode-theme) Dark |
| `tokyo-night-storm` | Tokyo Night Storm |
| `tokyo-night-light` | Tokyo Night Light |
| `catppuccin-mocha` | [Catppuccin](https://github.com/catppuccin/catppuccin) Mocha |
| `dracula` | [Dracula](https://draculatheme.com/) |
| `solarized-dark` | [Solarized](https://ethanschoonover.com/solarized/) Dark |
| `gruvbox-dark` | [Gruvbox](https://github.com/morhetz/gruvbox) Dark |
| `nord` | [Nord](https://www.nordtheme.com/) |
| `one-dark` | [One Dark](https://github.com/Binaryify/OneDark-Pro) |
| `github-dark` | [GitHub Dark](https://github.com/primer/primitives) |
| `kanagawa` | [Kanagawa](https://github.com/rebelot/kanagawa.nvim) |
| `rose-pine` | [Rosé Pine](https://rosepinetheme.com/) |

## What it shows

**Line 1:** Model name, context usage %, directory, git status, session duration, effort level

**Lines 2+:** Rate limit usage (current 5-hour window, weekly, extra credits when active)

### Git status

Inspired by [git-prompt.sh](https://github.com/git/git/blob/master/contrib/completion/git-prompt.sh). Displays branch name and rich status indicators:

```
(main *+$% ↑1↓2|REBASE 3/5)
```

| Symbol | Meaning |
|---|---|
| `*` | Unstaged changes |
| `+` | Staged changes |
| `$` | Stash entries exist |
| `%` | Untracked files |
| `↑N` | N commits ahead of upstream |
| `↓N` | N commits behind upstream |
| `\|REBASE` | Rebase in progress (with step/total) |
| `\|MERGING` | Merge in progress |
| `\|CHERRY-PICKING` | Cherry-pick in progress |
| `\|REVERTING` | Revert in progress |
| `\|BISECTING` | Bisect in progress |
| `\|AM` | `git am` in progress |

Detached HEAD is shown in red with a tag or short SHA.

## Uninstall

```bash
# Deno
deno run -A https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.ts --uninstall

# npx
npx @babarot/c-c-statusline --uninstall
```

## License

MIT
