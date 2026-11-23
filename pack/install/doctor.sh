#!/usr/bin/env bash
# Usage: pack/install/doctor.sh
# Read-only health check for Greeble's Door 1 on macOS. Changes nothing.
# Prints "ok|warn|fail <name>: <detail>" per check; exits 1 if any fail.
set -u

CLAUDE_DIR="${GREEBLE_CLAUDE_DIR:-$HOME/.claude}"
VAULTS_DIR="${GREEBLE_VAULTS_DIR:-$HOME/Documents/Obsidian}"
failed=0

ok()   { printf 'ok %s: %s\n' "$1" "$2"; }
warn() { printf 'warn %s: %s\n' "$1" "$2"; }
fail() { printf 'fail %s: %s\n' "$1" "$2"; failed=1; }

have() { command -v "$1" >/dev/null 2>&1; }

version_of() {
  case "$1" in
    perl) perl -e 'print substr($^V, 1)' 2>/dev/null ;;
    *) "$1" --version 2>/dev/null | head -n 1 ;;
  esac
}

# tools
for t in claude node git perl; do
  if have "$t"; then ok "$t" "$(version_of "$t")"; else fail "$t" "missing, install it"; fi
done
for t in rojo selene stylua; do
  if have "$t"; then ok "$t" "$(version_of "$t")"; else warn "$t" "missing, install it for Luau checks"; fi
done

# env (names only, never values)
for v in GREEBLE_URL GREEBLE_KEY; do
  if [ -n "$(eval "printf '%s' \"\${$v:-}\"")" ]; then
    ok "$v" "set"
  else
    fail "$v" "not set, source ~/.greeble/env"
  fi
done

# key file
key_file="$HOME/.greeble/env"
if [ ! -f "$key_file" ]; then
  warn "key file" "$key_file missing, run the installer"
else
  # GNU stat first: its -f means filesystem status and exits 0 with junk.
  mode=$(stat -c '%a' "$key_file" 2>/dev/null || stat -f '%Lp' "$key_file" 2>/dev/null)
  case "$mode" in
    600|400) ok "key file" "mode $mode" ;;
    *[1-7]|*[1-7]?) fail "key file" "mode $mode is readable by others, chmod 600 $key_file" ;;
    *) warn "key file" "mode $mode, expected 600" ;;
  esac
fi

# files
for f in "$CLAUDE_DIR/skills/greeble/SKILL.md" \
         "$CLAUDE_DIR/hooks/greeble/luau-check.sh" \
         "$VAULTS_DIR/Roblox Knowledge/CLAUDE.md"; do
  if [ -f "$f" ]; then ok "file" "$f"; else fail "file" "$f missing, run the installer"; fi
done

# server
if [ -z "${GREEBLE_URL:-}" ] || [ -z "${GREEBLE_KEY:-}" ]; then
  fail "server" "skipped, GREEBLE_URL or GREEBLE_KEY not set"
elif ! have curl; then
  fail "server" "curl missing"
else
  # The key goes to curl on stdin as a config line, never as an argument.
  esc_key=$(printf '%s' "$GREEBLE_KEY" | sed 's/\\/\\\\/g; s/"/\\"/g')
  code=$(printf 'header = "Authorization: Bearer %s"\n' "$esc_key" |
    curl -s -o /dev/null -w '%{http_code}' --max-time 5 -K - "${GREEBLE_URL%/}/v1/profile" 2>/dev/null)
  case "$code" in
    200) ok "server" "${GREEBLE_URL%/} answered 200" ;;
    401) fail "server" "key not accepted, check GREEBLE_KEY" ;;
    000|"") fail "server" "server not reachable at ${GREEBLE_URL%/}" ;;
    *) fail "server" "unexpected HTTP $code from ${GREEBLE_URL%/}" ;;
  esac
fi

# mcp entry
if have claude; then
  if claude mcp get greeble >/dev/null 2>&1; then
    ok "mcp entry" "greeble is registered"
  else
    fail "mcp entry" "greeble not registered, run the installer"
  fi
else
  warn "mcp entry" "skipped, claude missing"
fi

exit "$failed"
