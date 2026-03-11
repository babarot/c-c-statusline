---
paths:
  - bin/install.ts
---

# Deno remote module cache

Users run `bin/install.ts` via `deno run -A https://raw.githubusercontent.com/...`.
Deno caches remote modules locally, so updates to `install.ts` are NOT picked up automatically — users will keep running the stale cached version.

When modifying `bin/install.ts`:
- Remind the user (in PR description, release notes, or README) to run with `--reload` to bust the Deno cache:
  ```
  deno run --reload -A https://raw.githubusercontent.com/babarot/c-c-statusline/main/bin/install.ts
  ```
