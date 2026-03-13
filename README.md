# c-c-statusline

[![Test](https://github.com/babarot/c-c-statusline/actions/workflows/test.yml/badge.svg)](https://github.com/babarot/c-c-statusline/actions/workflows/test.yml)

A Deno-powered status line for Claude Code CLI.

Shows model info, context usage, rate limits, git status, session duration, and more — right in your terminal.

![screenshot](docs/demo-r.png)

## Install

Downloads a precompiled binary from GitHub Releases. No runtime dependencies needed.

```bash
# curl
curl -fsSL https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.sh | bash

# npx
npx @babarot/c-c-statusline

# deno
deno run -A https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.ts
```

## Configure

### Config file (recommended)

Generate `~/.claude/statusline.yaml` with defaults:

```bash
# After install
~/.claude/c-c-statusline --init-config
```

Or during install:

```bash
# curl
curl -fsSL https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.sh | bash -s -- --init-config

# npx
npx @babarot/c-c-statusline --init-config

# deno
deno run -A https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.ts --init-config
```

Then edit to your liking:

```yaml
# ~/.claude/statusline.yaml
options:
  bar-style: block
  path-style: short
  theme: tokyo-night-storm
  time-style: relative
  ctx-format: 'ctx {used}/{total} ({pct}%)'
  git-symbols:
    stash: "-"
    untracked: "?"
```

`settings.json` stays clean — no flags in the command:

```jsonc
// ~/.claude/settings.json
{
  "statusLine": {
    "type": "command",
    "command": "\"$HOME/.claude/c-c-statusline\""
  }
}
```

### CLI flags

CLI flags override config file values. Pass flags during install to bake them into `settings.json`:

```bash
# curl
curl -fsSL https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.sh \
  | bash -s -- --bar-style block --path-style short --theme tokyo-night

# npx
npx @babarot/c-c-statusline --bar-style block --path-style short --theme tokyo-night

# deno
deno run -A https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.ts \
  --bar-style block --path-style short --theme tokyo-night
```

This writes the flags directly into the command:

```jsonc
// ~/.claude/settings.json
{
  "statusLine": {
    "type": "command",
    "command": "\"$HOME/.claude/c-c-statusline\" --bar-style block --path-style short --theme tokyo-night"
  }
}
```

## Options

| Option | Values | Default | Description |
|---|---|---|---|
| `bar-style` | `dot`, `block`, `fill` | `dot` | Progress bar style |
| `path-style` | `parent`, `full`, `short`, `basename` | `parent` | Directory display style |
| `theme` | See [Themes](#themes) | `default` | Color theme |
| `time-style` | `absolute`, `relative` | `absolute` | Reset time format |
| `ctx-format` | Format string | `ctx {used}/{total} ({pct}%)` | Context display format |
| `vim-mode` | `auto`, `always`, `off` | `auto` | Vim mode indicator display |
| `git-symbols` | Map or `key=val,...` | See [below](#git-symbols) | Override git status symbols |

### bar-style

| Input | Output |
|---|---|
| `--bar-style dot` | `●●●●○○○○○○` |
| `--bar-style block` | `▰▰▰▰▱▱▱▱▱▱` |
| `--bar-style fill` | `████░░░░░░` |

### path-style

For `/Users/you/src/github.com/you/project`:

| Input | Output |
|---|---|
| `--path-style parent` | `you/project` |
| `--path-style full` | `~/src/github.com/you/project` |
| `--path-style short` | `~/s/g/you/project` |
| `--path-style basename` | `project` |

### time-style

| Input | Output |
|---|---|
| `--time-style absolute` | `8:00pm`, `Mar 12, 2:00pm` |
| `--time-style relative` | `1h 30m left`, `2d 5h left` |

### ctx-format

Use `{used}`, `{total}`, `{pct}`, `{compact}` placeholders.

| Placeholder | Description |
|---|---|
| `{used}` | Tokens used (e.g. `28k`) |
| `{total}` | Context window size (e.g. `200k`) |
| `{pct}` | Usage percentage (e.g. `14`) |
| `{compact}` | Remaining % until auto-compact (based on 80% usable threshold) |

| Input | Output |
|---|---|
| `--ctx-format 'ctx {used}/{total} ({pct}%)'` | `ctx 28k/200k (14%)` |
| `--ctx-format '{pct}% ({used}/{total})'` | `14% (28k/200k)` |
| `--ctx-format '{pct}% compact:{compact}%'` | `14% compact:83%` |
| `--ctx-format '{used} of {total}'` | `28k of 200k` |

### vim-mode

Shows the current Vim mode when Claude Code's Vim keybinding is enabled. The indicator is appended to the end of line 1.

| Value | Behavior |
|---|---|
| `auto` | Show only in `NORMAL` mode (hides in `INSERT` to reduce noise) |
| `always` | Show in all modes (`NORMAL`, `INSERT`, etc.) |
| `off` | Never show |

Mode colors: `NORMAL` uses the theme's primary color, `INSERT` uses success (green).

```yaml
# ~/.claude/statusline.yaml
options:
  vim-mode: auto
```

### Themes

Built-in color themes using 24-bit True Color (RGB). Each theme defines 8 semantic color roles (`primary`, `secondary`, `success`, `warning`, `caution`, `danger`, `muted`, `accent`).

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

### Git symbols

Override any git status symbol. In the config file, use a map; with CLI flags, use `key=val,...` format.

| Key | Default | Description |
|---|---|---|
| `unstaged` | `*` | Unstaged changes |
| `staged` | `+` | Staged changes |
| `stash` | `$` | Stash entries exist |
| `untracked` | `%` | Untracked files |
| `ahead` | `↑` | Ahead of upstream |
| `behind` | `↓` | Behind upstream |

| Input | Output |
|---|---|
| `--git-symbols "stash=-,untracked=?"` | `(main *+ -?)` |
| `--git-symbols "unstaged=~,staged=+,stash=-,untracked=?,ahead=+,behind=-"` | `(main ~+ -? +1-2)` |

Config file:
```yaml
options:
  git-symbols:
    stash: "-"
    untracked: "?"
```

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

## Uninstall

```bash
# curl
curl -fsSL https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.sh | bash -s -- --uninstall

# npx
npx @babarot/c-c-statusline --uninstall

# deno
deno run -A https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.ts --uninstall
```

## License

MIT
