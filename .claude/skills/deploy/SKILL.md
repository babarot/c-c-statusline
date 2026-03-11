---
description: Compile and install the binary to ~/.claude/
allowed-tools: Bash(deno task compile:*), Bash(install:*), Bash(~/.claude/c-c-statusline --version:*)
---

# Deploy: Compile & Install

Run the following steps in order.

## 1. Compile

```
deno task compile
```

## 2. Install

`install` atomically replaces the destination file, avoiding the `com.apple.provenance` xattr issue that `/bin/cp` causes (macOS Gatekeeper SIGKILL on adhoc-signed binaries).

```
install -v c-c-statusline ~/.claude/c-c-statusline
```

## 3. Verify

```
~/.claude/c-c-statusline --version
```

Success if the version string is printed.
