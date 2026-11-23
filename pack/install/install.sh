#!/usr/bin/env bash
# Usage: pack/install/install.sh
# Copies the greeble pack into ~/.claude and the Obsidian vaults folder, then
# stores the dev's server URL and key in ~/.greeble/env. Safe to run twice.
#
# Environment:
#   GREEBLE_URL, GREEBLE_KEY   used instead of prompting (the key is never printed)
#   GREEBLE_CLAUDE_DIR         default $HOME/.claude
#   GREEBLE_VAULTS_DIR         default $HOME/Documents/Obsidian
#
# Prompts are read from stdin. With no input (no terminal), every question
# takes its default: keep the existing file, don't touch ~/.zshrc.
set -uo pipefail

die() {
  echo "install: $1" >&2
  exit 1
}

[ "$#" -eq 0 ] || die "takes no arguments; set GREEBLE_URL and GREEBLE_KEY in the environment or answer the prompts"
[ -n "${HOME:-}" ] || die "HOME is not set"

PACK="$(cd "$(dirname "$0")/.." && pwd)" || die "cannot find the pack folder"
CLAUDE="${GREEBLE_CLAUDE_DIR:-$HOME/.claude}"
VAULTS="${GREEBLE_VAULTS_DIR:-$HOME/Documents/Obsidian}"

copied=0
kept=0
skipped=0

# ask "question" -> returns 0 on y/yes, 1 otherwise (including no input).
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

# install_file SRC DEST
install_file() {
  local src="$1" dest="$2"
  if [ -e "$dest" ]; then
    if cmp -s "$src" "$dest"; then
      skipped=$((skipped + 1))
      return
    fi
    if ask "$dest differs from the pack. overwrite?"; then
      cp -p "$src" "$dest" || die "cannot write $dest"
      copied=$((copied + 1))
    else
      kept=$((kept + 1))
    fi
    return
  fi
  mkdir -p "$(dirname "$dest")" || die "cannot create $(dirname "$dest")"
  cp -p "$src" "$dest" || die "cannot write $dest"
  copied=$((copied + 1))
}

# install_tree SRCDIR DESTDIR: every file under SRCDIR, keeping its path.
install_tree() {
  local src="$1" dest="$2" f rel
  [ -d "$src" ] || return 0
  mkdir -p "$dest" || die "cannot create $dest"
  while IFS= read -r -d '' f <&3; do
    rel="${f#"$src"/}"
    install_file "$f" "$dest/$rel"
  done 3< <(find "$src" -type f -print0 | sort -z)
}

# install_children SRCDIR DESTDIR: each subfolder of SRCDIR as its own tree.
install_children() {
  local src="$1" dest="$2" d
  [ -d "$src" ] || return 0
  for d in "$src"/*/; do
    [ -d "$d" ] || continue
    d="${d%/}"
    install_tree "$d" "$dest/$(basename "$d")"
  done
}

install_children "$PACK/claude/skills" "$CLAUDE/skills"
if [ -d "$PACK/claude/commands" ]; then
  for f in "$PACK/claude/commands"/*.md; do
    [ -f "$f" ] || continue
    mkdir -p "$CLAUDE/commands" || die "cannot create $CLAUDE/commands"
    install_file "$f" "$CLAUDE/commands/$(basename "$f")"
  done
fi
if [ -d "$PACK/claude/agents" ]; then
  for f in "$PACK/claude/agents"/*.md; do
    [ -f "$f" ] || continue
    mkdir -p "$CLAUDE/agents" || die "cannot create $CLAUDE/agents"
    install_file "$f" "$CLAUDE/agents/$(basename "$f")"
  done
fi
install_tree "$PACK/claude/hooks" "$CLAUDE/hooks/greeble"
install_children "$PACK/vaults" "$VAULTS"

# Offer to turn the pack's hooks on in settings.json. A failure there (say, a
# settings.json that does not parse) is reported and the install goes on.
if [ -f "$PACK/install/hooks.sh" ]; then
  GREEBLE_CLAUDE_DIR="$CLAUDE" bash "$PACK/install/hooks.sh" || true
fi

# Offer to add Greeble's rules block to the global CLAUDE.md. A failure there
# is reported and the install goes on.
if [ -f "$PACK/install/memory.sh" ]; then
  GREEBLE_CLAUDE_DIR="$CLAUDE" GREEBLE_VAULTS_DIR="$VAULTS" bash "$PACK/install/memory.sh" || true
fi

# Server URL and key.
url="${GREEBLE_URL:-}"
key="${GREEBLE_KEY:-}"
if [ -z "$url" ]; then
  printf 'greeble server URL: ' >&2
  IFS= read -r url || true
  [ -n "$url" ] || echo >&2
fi
[ -n "$url" ] || die "no server URL; set GREEBLE_URL or answer the prompt"
while [ "${url%/}" != "$url" ]; do url="${url%/}"; done
[ -n "$url" ] || die "server URL is only slashes"

if [ -z "$key" ]; then
  printf 'greeble key (hidden): ' >&2
  IFS= read -r -s key || true
  echo >&2
fi
[ -n "$key" ] || die "no key; set GREEBLE_KEY or answer the prompt"

# Single-quote a value for a shell file.
squote() {
  local q="'\\''"
  printf "'%s'" "${1//\'/$q}"
}

envdir="$HOME/.greeble"
envfile="$envdir/env"
mkdir -p "$envdir" || die "cannot create $envdir"
chmod 700 "$envdir" 2>/dev/null || true
(
  umask 077
  {
    printf 'export GREEBLE_URL=%s\n' "$(squote "$url")"
    printf 'export GREEBLE_KEY=%s\n' "$(squote "$key")"
  } >"$envfile"
) || die "cannot write $envfile"
chmod 600 "$envfile" || die "cannot set mode 600 on $envfile"
unset key GREEBLE_KEY

# Shell startup line.
srcline='[ -f "$HOME/.greeble/env" ] && . "$HOME/.greeble/env"'
zshrc="$HOME/.zshrc"
if [ -f "$zshrc" ] && grep -Fqx "$srcline" "$zshrc"; then
  : # already there
elif ask "add a line to ~/.zshrc that loads it?"; then
  if [ -s "$zshrc" ] && [ -n "$(tail -c 1 "$zshrc")" ]; then
    echo >>"$zshrc" || die "cannot write $zshrc"
  fi
  printf '%s\n' "$srcline" >>"$zshrc" || die "cannot write $zshrc"
  echo "added the loader line to $zshrc"
else
  echo "to load the key in new shells, add this line to ~/.zshrc:"
  echo "  $srcline"
fi

echo "copied $copied, kept $kept, skipped $skipped"

# Last step: the greeble MCP entry and its connection check.
if [ -f "$PACK/install/mcp.sh" ]; then
  exec bash "$PACK/install/mcp.sh"
fi
exit 0
