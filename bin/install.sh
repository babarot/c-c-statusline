#!/usr/bin/env bash
set -euo pipefail

REPO="babarot/c-c-statusline"
BINARY_NAME="c-c-statusline"
CLAUDE_DIR="$HOME/.claude"
BINARY_DEST="$CLAUDE_DIR/$BINARY_NAME"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"

# Colors
blue='\033[38;2;0;153;255m'
green='\033[38;2;0;175;80m'
red='\033[38;2;255;85;85m'
yellow='\033[38;2;230;200;0m'
dim='\033[2m'
reset='\033[0m'

log()     { printf "  %b\n" "$1"; }
success() { printf "  ${green}✓${reset} %b\n" "$1"; }
warn()    { printf "  ${yellow}!${reset} %b\n" "$1"; }
fail()    { printf "  ${red}✗${reset} %b\n" "$1" >&2; }

detect_platform() {
  local os arch
  case "$(uname -s)" in
    Darwin) os="darwin" ;;
    Linux)  os="linux" ;;
    *)      fail "Unsupported OS: $(uname -s)"; exit 1 ;;
  esac
  case "$(uname -m)" in
    arm64|aarch64) arch="arm64" ;;
    x86_64|amd64)  arch="x86_64" ;;
    *)             fail "Unsupported arch: $(uname -m)"; exit 1 ;;
  esac
  PLATFORM_OS="$os"
  PLATFORM_ARCH="$arch"
  ASSET_NAME="${BINARY_NAME}-${os}-${arch}"
}

get_latest_tag() {
  local url="https://api.github.com/repos/${REPO}/releases/latest"
  local response
  response=$(curl -fsSL -H "Accept: application/vnd.github.v3+json" "$url" 2>/dev/null) || {
    fail "Failed to fetch latest release"
    exit 1
  }
  LATEST_TAG=$(printf '%s' "$response" | grep '"tag_name"' | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
  if [[ -z "$LATEST_TAG" ]]; then
    fail "Could not parse release tag"
    exit 1
  fi
}

download_and_verify() {
  local base_url="https://github.com/${REPO}/releases/download/${LATEST_TAG}"
  local binary_url="${base_url}/${ASSET_NAME}"
  local checksum_url="${base_url}/checksums.txt"
  TMPDIR_CLEANUP=$(mktemp -d)
  local tmpdir="$TMPDIR_CLEANUP"
  trap 'rm -rf "${TMPDIR_CLEANUP:-}"' EXIT

  curl -fsSL -o "$tmpdir/$ASSET_NAME" "$binary_url" 2>/dev/null || {
    fail "Failed to download $ASSET_NAME"
    exit 1
  }

  local checksums
  if checksums=$(curl -fsSL "$checksum_url" 2>/dev/null); then
    local expected actual
    expected=$(printf '%s' "$checksums" | grep "$ASSET_NAME" | awk '{print $1}')
    if [[ -n "$expected" ]]; then
      actual=$(shasum -a 256 "$tmpdir/$ASSET_NAME" | awk '{print $1}')
      if [[ "$actual" != "$expected" ]]; then
        fail "Checksum mismatch!\n  expected: $expected\n  actual:   $actual"
        exit 1
      fi
    else
      warn "Checksum entry not found, skipping verification"
    fi
  else
    warn "Checksum file not found, skipping verification"
  fi

  DOWNLOADED_BINARY="$tmpdir/$ASSET_NAME"
}

read_settings() {
  if [[ -f "$SETTINGS_FILE" ]]; then
    cat "$SETTINGS_FILE"
  else
    echo '{}'
  fi
}

write_settings() {
  printf '%s\n' "$1" > "$SETTINGS_FILE"
}

update_settings() {
  local command="\"$BINARY_DEST\""
  if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
    command="$command ${EXTRA_ARGS[*]}"
  fi

  local settings
  settings=$(read_settings)

  if command -v jq >/dev/null 2>&1; then
    settings=$(printf '%s' "$settings" | jq --arg cmd "$command" '.statusLine = {type: "command", command: $cmd}')
    write_settings "$settings"
    success "Updated ${dim}${SETTINGS_FILE}${reset}"
  else
    warn "jq not found — add the following to ${dim}${SETTINGS_FILE}${reset} manually:"
    echo
    log "  \"statusLine\": {\"type\": \"command\", \"command\": \"${command}\"}"
    echo
  fi
}

do_uninstall() {
  echo
  log "${blue}Claude Code Statusline Uninstaller${reset}"
  log "${dim}──────────────────────────────────${reset}"
  echo

  local backup="${BINARY_DEST}.bak"
  if [[ -f "$backup" ]]; then
    mv "$backup" "$BINARY_DEST"
    success "Restored previous statusline from ${dim}backup${reset}"
  elif [[ -f "$BINARY_DEST" ]]; then
    rm "$BINARY_DEST"
    success "Removed ${dim}${BINARY_NAME}${reset}"
  else
    warn "No statusline binary found — nothing to remove"
  fi

  if command -v jq >/dev/null 2>&1; then
    local settings
    settings=$(read_settings)
    if printf '%s' "$settings" | jq -e '.statusLine' >/dev/null 2>&1; then
      settings=$(printf '%s' "$settings" | jq 'del(.statusLine)')
      write_settings "$settings"
      success "Removed statusLine from ${dim}settings.json${reset}"
    else
      success "Settings already clean"
    fi
  else
    warn "jq not found — remove \"statusLine\" from ${dim}${SETTINGS_FILE}${reset} manually"
  fi

  echo
  log "${green}Done!${reset} Restart Claude Code to apply changes."
  echo
}

do_install() {
  echo
  log "${blue}Claude Code Statusline Installer${reset}"
  log "${dim}────────────────────────────────${reset}"
  echo

  detect_platform
  success "Platform: ${PLATFORM_OS}/${PLATFORM_ARCH}"

  get_latest_tag
  success "Latest release: ${LATEST_TAG}"

  log "Downloading ${dim}${ASSET_NAME}${reset}..."
  download_and_verify
  success "Downloaded and verified"

  mkdir -p "$CLAUDE_DIR"

  if [[ -f "$BINARY_DEST" ]]; then
    mv "$BINARY_DEST" "${BINARY_DEST}.bak"
    warn "Backed up existing binary to ${dim}${BINARY_NAME}.bak${reset}"
  fi

  cp "$DOWNLOADED_BINARY" "$BINARY_DEST"
  chmod 755 "$BINARY_DEST"
  success "Installed to ${dim}${BINARY_DEST}${reset}"

  update_settings

  if $INIT_CONFIG; then
    if [[ -f "$CLAUDE_DIR/statusline.yaml" ]]; then
      warn "Config already exists: ${dim}${CLAUDE_DIR}/statusline.yaml${reset}"
    else
      "$BINARY_DEST" --init-config
      success "Generated ${dim}${CLAUDE_DIR}/statusline.yaml${reset}"
    fi
  fi

  echo
  log "${green}Done!${reset} Restart Claude Code to see your new status line."
  if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
    log "${dim}Options: ${EXTRA_ARGS[*]}${reset}"
  fi
  echo
}

# ── Main ──────────────────────────────────────────────────

EXTRA_ARGS=()
UNINSTALL=false
INIT_CONFIG=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      echo
      log "${blue}Claude Code Statusline${reset}"
      echo
      log "${dim}Usage:${reset}"
      log "  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/bin/install.sh | bash"
      log "  curl -fsSL ... | bash -s -- --bar-style block --path-style short"
      echo
      log "${dim}Options:${reset}"
      log "  --bar-style <dot|block|fill>              Bar style (default: dot)"
      log "  --path-style <parent|full|short|basename> Path style (default: parent)"
      log "  --theme <name>                            Color theme (default: default)"
      log "  --time-style <absolute|relative>          Time format (default: absolute)"
      log "  --ctx-format <format>                     Context display format"
      log "  --git-symbols <key=val,...>               Override git symbols"
      log "  --init-config                             Generate ~/.claude/statusline.yaml"
      log "  --uninstall                               Remove statusline"
      log "  --help                                    Show this help"
      echo
      exit 0
      ;;
    --uninstall)
      UNINSTALL=true
      shift
      ;;
    --init-config)
      INIT_CONFIG=true
      shift
      ;;
    --bar-style|--path-style|--theme|--time-style|--ctx-format|--git-symbols)
      EXTRA_ARGS+=("$1" "$2")
      shift 2
      ;;
    *)
      fail "Unknown option: $1"
      exit 1
      ;;
  esac
done

if $UNINSTALL; then
  do_uninstall
else
  do_install
fi
