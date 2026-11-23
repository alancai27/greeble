#!/usr/bin/env bash
# Usage: pack/install/mcp.sh
# Adds the greeble MCP entry to Claude Code at user scope, then checks that it
# connects. The entry holds the ${GREEBLE_URL} and ${GREEBLE_KEY} placeholders
# literally; Claude Code fills them from the environment, which comes from
# $HOME/.greeble/env (written by install.sh). No URL or key value is ever put
# in Claude's config, in a process argument or in this script's output.
#
# If a different greeble entry exists, asks "replace? [y/N]" on stdin. With no
# input (no terminal) it keeps the existing entry.
set -uo pipefail

die() {
  echo "mcp: $1" >&2
  exit 1
}

[ "$#" -eq 0 ] || die "takes no arguments"
[ -n "${HOME:-}" ] || die "HOME is not set"
command -v claude >/dev/null 2>&1 || die "install Claude Code first, then run this again"

NAME=greeble
# Single quotes: the placeholders must stay literal.
ENTRY='{"type":"http","url":"${GREEBLE_URL}/mcp","headers":{"Authorization":"Bearer ${GREEBLE_KEY}"}}'
EXPECTED='  Type: http
  URL: ${GREEBLE_URL}/mcp
  Headers:
    Authorization: Bearer ${GREEBLE_KEY}'

# Run claude with no greeble values in its environment, so nothing it stores
# or prints can hold them.
bare() {
  env -u GREEBLE_URL -u GREEBLE_KEY claude "$@"
}

# ask "question" -> 0 on y/yes, 1 otherwise (including no input).
ask() {
  local ans=""
  printf '%s [y/N] ' "$1" >&2
  if ! IFS= read -r ans; then
    echo >&2
    return 1
  fi
  case "$ans" in
    y | Y | yes | YES | Yes) return 0 ;;
    *) return 1 ;;
  esac
}

add() {
  bare mcp add-json -s user "$NAME" "$ENTRY" >/dev/null 2>&1 ||
    die "claude mcp add-json failed for $NAME"
}

if current="$(bare mcp get "$NAME" 2>/dev/null)"; then
  # The Type line through the first blank line describes the entry.
  shape="$(printf '%s\n' "$current" | awk '/^  Type:/{on=1} on&&/^[[:space:]]*$/{exit} on')"
  if [ "$shape" = "$EXPECTED" ]; then
    echo "$NAME MCP entry already there"
  elif ask "the $NAME MCP entry in Claude Code differs from the pack. replace?"; then
    bare mcp remove "$NAME" -s user >/dev/null 2>&1 || die "claude mcp remove failed for $NAME"
    add
    echo "replaced the $NAME MCP entry"
  else
    echo "kept the existing $NAME MCP entry"
  fi
else
  add
  echo "added the $NAME MCP entry (user scope)"
fi

# Check, with the values loaded the way a new shell loads them.
envfile="$HOME/.greeble/env"
[ -f "$envfile" ] || die "no $envfile; run pack/install/install.sh first"
listing="$(
  # shellcheck disable=SC1090
  . "$envfile" || exit 1
  claude mcp list 2>/dev/null
)" || die "claude mcp list failed"
line="$(printf '%s\n' "$listing" | grep -m1 "^$NAME: ")" || die "$NAME entry missing from claude mcp list"

case "$line" in
  *"(HTTP 401)"* | *" 401 "* | *"401 Unauthorized"*) die "$NAME key not accepted (401)" ;;
  *Failed* | *failed*) die "$NAME server not reachable" ;;
  *Connected*) echo "ok $NAME connected" ;;
  *) die "$NAME server not reachable" ;;
esac
exit 0
