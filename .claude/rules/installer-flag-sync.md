---
paths:
  - bin/install.*
  - src/main.ts
---

# Installer flag sync

All three installers (`bin/install.sh`, `bin/install.js`, `bin/install.ts`) use a whitelist of known flags. When adding a new CLI flag to the binary (`src/main.ts`), you MUST also add it to all three installers:
- Help text
- Flag parsing logic (`valueFlags` / case branches)
