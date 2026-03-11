# c-c-statusline

A Deno-powered status line for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI.

Shows model info, context usage, rate limits, git status, session duration, and more — right in your terminal.

## Install

### Binary (recommended)

Downloads a precompiled binary from GitHub Releases. No runtime dependencies needed.

```bash
# Deno
deno run -A https://raw.githubusercontent.com/babarot/c-c-statusline/main/install.ts

# npx
npx @babarot/c-c-statusline
```

### Options

Pass options during install to customize the statusline:

```bash
deno run -A https://raw.githubusercontent.com/babarot/c-c-statusline/main/install.ts \
  --bar-style block --path-style short
```

| Option | Values | Default | Description |
|---|---|---|---|
| `--bar-style` | `dot`, `block`, `fill` | `dot` | Progress bar style |
| `--path-style` | `parent`, `full`, `short`, `basename` | `parent` | Directory display style |

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

## What it shows

**Line 1:** Model name, context usage %, directory, git branch, session duration, effort level

**Lines 2+:** Rate limit usage (current 5-hour window, weekly, extra credits when active)

## Uninstall

```bash
# Deno
deno run -A https://raw.githubusercontent.com/babarot/c-c-statusline/main/install.ts --uninstall

# npx
npx @babarot/c-c-statusline --uninstall
```

## License

MIT
