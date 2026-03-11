# Data Sources

c-c-statusline gathers information from three sources:

## 1. Statusline JSON (stdin)

Claude Code pipes a JSON object into the statusline command via stdin on every render. This is the primary data source.

### How to inspect

Run with `--debug` to dump the raw JSON:

```bash
~/.claude/c-c-statusline --debug
```

This writes the JSON to `~/.claude/statusline-debug.json`. You can then inspect it:

```bash
cat ~/.claude/statusline-debug.json | python3 -m json.tool
```

### Fields used

| Field | Type | Description |
|---|---|---|
| `model.display_name` | string | Model name (e.g. "Opus 4.6") |
| `context_window.context_window_size` | number | Total context window size in tokens |
| `context_window.used_percentage` | number | Percentage of context used (0-100) |
| `cwd` | string | Current working directory |
| `session.start_time` | string | ISO 8601 session start time |
| `vim.mode` | string | Vim mode (`"NORMAL"` or `"INSERT"`). Only present when vim mode is enabled. |

### Fields available but not used

These fields exist in the JSON but are not currently displayed:

| Field | Type | Description |
|---|---|---|
| `session_id` | string | Session UUID |
| `transcript_path` | string | Path to session transcript |
| `model.id` | string | Model identifier |
| `workspace.project_dir` | string | Project directory |
| `version` | string | Claude Code version |
| `cost.total_cost_usd` | number | Total cost in USD |
| `cost.total_duration_ms` | number | Total session duration |
| `exceeds_200k_tokens` | boolean | Whether context exceeds 200k |

## 2. `~/.claude/settings.json`

Read directly from disk. Used for data that Claude Code does not include in the statusline JSON.

| Field | Type | Description |
|---|---|---|
| `effortLevel` | string | Thinking effort: `"high"`, `"low"`, or absent (default) |

The effort level is set via `/think` commands in Claude Code:
- `/think hard` → `"high"`
- `/think off` → `"low"`
- `/think default` or unset → `"default"`

## 3. Anthropic Usage API

Rate limit data is fetched from `https://api.anthropic.com/api/oauth/usage` using the user's OAuth token.

### Authentication

The OAuth token is resolved in priority order:
1. `CLAUDE_CODE_OAUTH_TOKEN` environment variable
2. macOS Keychain (`security find-generic-password`)
3. `~/.claude/credentials.json`

### Caching

- Cache file: `/tmp/claude/statusline-usage-cache.json`
- TTL: 60 seconds
- On fetch failure, falls back to stale cache

### Data used

| Field | Type | Description |
|---|---|---|
| `five_hour.utilization` | number | Current 5-hour window usage (0-100) |
| `five_hour.resets_at` | string | ISO 8601 reset time |
| `seven_day.utilization` | number | Weekly usage (0-100) |
| `seven_day.resets_at` | string | ISO 8601 reset time |
| `extra_usage.is_enabled` | boolean | Whether extra credits are active |
| `extra_usage.utilization` | number | Extra credit usage (0-100) |
| `extra_usage.used_credits` | number | Credits used (in cents) |
| `extra_usage.monthly_limit` | number | Monthly limit (in cents) |

## 4. Git

Git status is gathered via `git status --porcelain=v2 --branch --show-stash` run against the `cwd` from the statusline JSON. This single command provides branch, upstream ahead/behind, staged/unstaged/untracked status, and stash count.

In-progress operations (rebase, merge, cherry-pick, etc.) are detected by reading files in the `.git` directory.

## Summary

| What | Source | Latency |
|---|---|---|
| Model, context, cwd, session, vim mode | Statusline JSON (stdin) | Instant |
| Effort level | `~/.claude/settings.json` | Disk read |
| Git status | `git status` command | ~50ms |
| Rate limits | Anthropic API (cached 60s) | 0-5s |
