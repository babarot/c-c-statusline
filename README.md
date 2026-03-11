# c-c-statusline

A Deno-powered status line for Claude Code CLI.

Shows model info, context usage, rate limits, git status, session duration, and more — right in your terminal.

![screenshot](ss.png)

## Install

### Binary (recommended)

Downloads a precompiled binary from GitHub Releases. No runtime dependencies needed.

```bash
# curl
curl -fsSL https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.sh | bash

# npx
npx @babarot/c-c-statusline

# Deno
deno run -A https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.ts
```

### Options

Pass options during install to customize the statusline:

```bash
curl -fsSL https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.sh \
  | bash -s -- --bar-style block --path-style short --theme tokyo-night
```

| Option | Values | Default | Description |
|---|---|---|---|
| `--bar-style` | `dot`, `block`, `fill` | `dot` | Progress bar style |
| `--path-style` | `parent`, `full`, `short`, `basename` | `parent` | Directory display style |
| `--theme` | See [Themes](#themes) | `default` | Color theme |
| `--time-style` | `absolute`, `relative` | `absolute` | Reset time format |
| `--ctx-format` | Format string | `ctx {used}/{total} ({pct}%)` | Context display format |
| `--git-symbols` | `key=val,...` | See [Git symbols](#git-symbols) | Override git status symbols |

**Bar styles** (`--bar-style`):

| Option | Output |
|---|---|
| `--bar-style dot` | `●●●●○○○○○○` |
| `--bar-style block` | `▰▰▰▰▱▱▱▱▱▱` |
| `--bar-style fill` | `████░░░░░░` |

**Path styles** (`--path-style`, for `/Users/you/src/github.com/you/project`):

| Option | Output |
|---|---|
| `--path-style parent` | `you/project` |
| `--path-style full` | `~/src/github.com/you/project` |
| `--path-style short` | `~/s/g/you/project` |
| `--path-style basename` | `project` |

**Time styles** (`--time-style`):

| Option | Output |
|---|---|
| `--time-style absolute` | `8:00pm`, `Mar 12, 2:00pm` |
| `--time-style relative` | `1h 30m left`, `2d 5h left` |

**Context format** (`--ctx-format`):

Use `{used}`, `{total}`, `{pct}` placeholders to build any format.

| Option | Output |
|---|---|
| `--ctx-format 'ctx {used}/{total} ({pct}%)'` | `ctx 28k/200k (14%)` |
| `--ctx-format '{pct}% ({used}/{total})'` | `14% (28k/200k)` |
| `--ctx-format '{pct}%'` | `14%` |
| `--ctx-format '{used} of {total}'` | `28k of 200k` |

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

**Line 1:** Model name, context usage (tokens + %), directory, git status, session duration, effort level

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

### Git symbols

Override any git status symbol with `--git-symbols "key=val,key=val"`. Only specified keys are overridden; the rest keep their defaults.

| Key | Default | Description |
|---|---|---|
| `unstaged` | `*` | Unstaged changes |
| `staged` | `+` | Staged changes |
| `stash` | `$` | Stash entries exist |
| `untracked` | `%` | Untracked files |
| `ahead` | `↑` | Ahead of upstream |
| `behind` | `↓` | Behind upstream |

**Examples:**

```bash
# Use '-' for stash and '?' for untracked
--git-symbols "stash=-,untracked=?"

# Minimal style
--git-symbols "unstaged=~,staged=+,stash=-,untracked=?,ahead=+,behind=-"
```

## Config file

Options can be set in `~/.claude/statusline.yaml` instead of CLI flags. Generate a config file with defaults:

```bash
# After install
~/.claude/c-c-statusline --init-config

# Or during install
curl -fsSL https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.sh \
  | bash -s -- --init-config
```

Example `~/.claude/statusline.yaml`:

```yaml
options:
  bar-style: block
  path-style: short
  theme: tokyo-night-storm
  time-style: relative
  # git-symbols as a map (instead of CLI string format)
  git-symbols:
    stash: "-"
    untracked: "?"
```

CLI flags override config values. If no config file exists, built-in defaults are used.

## Uninstall

```bash
# curl
curl -fsSL https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.sh | bash -s -- --uninstall

# npx
npx @babarot/c-c-statusline --uninstall

# Deno
deno run -A https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.ts --uninstall
```

## License

MIT
