#!/usr/bin/env bash
# Usage: new-project-vault.sh --name <Name> [--code-path <dir>] [--kind project|roblox]
# Copies <VAULTS>/_templates/<kind>-vault/ to <VAULTS>/<Name>/.
# <VAULTS> is $GREEBLE_VAULTS_DIR, or $HOME/Documents/Obsidian.
set -euo pipefail

usage() {
  echo "Usage: new-project-vault.sh --name <Name> [--code-path <dir>] [--kind project|roblox]" >&2
  exit 2
}

name=""
code_path=""
kind="project"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --name) [ "$#" -ge 2 ] || usage; name="$2"; shift 2 ;;
    --code-path) [ "$#" -ge 2 ] || usage; code_path="$2"; shift 2 ;;
    --kind) [ "$#" -ge 2 ] || usage; kind="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done

[ -n "$name" ] || usage
case "$kind" in
  project|roblox) ;;
  *) echo "Kind must be project or roblox, not: $kind" >&2; exit 2 ;;
esac
case "$name" in
  */*|.|..|_templates|_tools) echo "Invalid vault name: $name" >&2; exit 2 ;;
esac

vaults="${GREEBLE_VAULTS_DIR:-$HOME/Documents/Obsidian}"
template="$vaults/_templates/$kind-vault"
target="$vaults/$name"

if [ ! -d "$template" ]; then
  echo "Template not found: $template" >&2
  exit 1
fi
if [ -e "$target" ]; then
  echo "Vault already exists, nothing changed: $target" >&2
  exit 1
fi

mkdir -p "$target"
cp -R "$template/." "$target/"
echo "Created vault: $target"

echo "Skipped code map and brain source: those tools are not part of this pack."

if [ "$kind" = "roblox" ] && [ -n "$code_path" ]; then
  mkdir -p "$code_path"
  if git -C "$code_path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Git repo already present: $code_path"
  else
    git init -q "$code_path"
    echo "Initialised git repo: $code_path"
  fi
  if [ -e "$code_path/.gitignore" ]; then
    echo "Kept existing .gitignore"
  else
    # printf writes plain UTF-8 with no BOM.
    printf '%s\n' \
      "# Roblox / Rojo" \
      "*.rbxl" \
      "*.rbxlx" \
      "*.rbxm" \
      "*.rbxmx" \
      "*.rbxl.lock" \
      "*.rbxlx.lock" \
      "sourcemap.json" \
      "Packages/" \
      "ServerPackages/" \
      "DevPackages/" \
      "" \
      "# Tooling and OS" \
      "node_modules/" \
      ".env" \
      ".env.local" \
      ".DS_Store" \
      > "$code_path/.gitignore"
    echo "Added Roblox .gitignore"
  fi
fi

echo "Next: open $target once in Obsidian (Manage vaults -> Open folder as vault)."
