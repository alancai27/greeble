# Shared helpers. Sourced by the other scripts; not run directly.
# Written for bash 3.2, which is what macOS ships.

STATES="todo claimed needs-review changes-requested blocked"

die() {
  echo "error: $*" >&2
  exit 1
}

# Path of the main checkout, even when called from inside a worktree.
main_root() {
  git worktree list --porcelain | sed -n '1s/^worktree //p'
}

# Where the worktree for issue N lives: ../<repo>-wt/issue-N
wt_dir() {
  local root
  root=$(main_root)
  echo "$(dirname "$root")/$(basename "$root")-wt/issue-$1"
}

# Comma-separated labels on issue N.
issue_labels() {
  gh issue view "$1" --json labels --jq '[.labels[].name] | join(",")'
}

# has_label "a,b,c" b
has_label() {
  case ",$1," in
    *",$2,"*) return 0 ;;
    *) return 1 ;;
  esac
}

# set_state N new-state: remove any other state label, add the new one.
set_state() {
  local n="$1" new="$2" cur s
  local args=()
  cur=$(issue_labels "$n")
  for s in $STATES; do
    if [ "$s" != "$new" ] && has_label "$cur" "$s"; then
      args+=(--remove-label "$s")
    fi
  done
  gh issue edit "$n" ${args[@]+"${args[@]}"} --add-label "$new" >/dev/null
}
