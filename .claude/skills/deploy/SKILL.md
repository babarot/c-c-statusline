---
description: Compile and install the binary to ~/.claude/
allowed-tools: Bash(deno task compile:*), Bash(rm:*), Bash(cp:*)
---

# Deploy: Compile & Install

Run the following steps in order.

## 1. Compile

```
deno task compile
```

## 2. Remove existing binary, then copy

Using `/bin/cp` adds the `com.apple.provenance` xattr, causing macOS Gatekeeper to SIGKILL adhoc-signed binaries.
Always `rm` first, then `cp`.

```
rm ~/.claude/c-c-statusline
cp c-c-statusline ~/.claude/c-c-statusline
```

## 3. Verify

```
~/.claude/c-c-statusline --version
```

Success if the version string is printed.
