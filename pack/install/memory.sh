#!/usr/bin/env bash
# Usage: pack/install/memory.sh
# Offers to add Greeble's rules block (pack/claude/CLAUDE.block.md) to the
# dev's global <CLAUDE>/CLAUDE.md, between the lines "<!-- greeble:start -->"
# and "<!-- greeble:end -->", with <VAULTS> replaced by the resolved path.
#   <CLAUDE> = $GREEBLE_CLAUDE_DIR or $HOME/.claude
#   <VAULTS> = $GREEBLE_VAULTS_DIR or $HOME/Documents/Obsidian
# One "[y/N]" question on stdin when the markers are absent; with no input (no
# terminal) nothing changes. Markers already there: the text between them is
# replaced when it differs, without asking; identical: skipped. Text outside
# the markers is never changed. The file is created if missing.
# Once the rules block is in place, a second question offers full PC access
# (pack/claude/CLAUDE.full-access.md) between "<!-- greeble-full-access:start -->"
# and "<!-- greeble-full-access:end -->": "[y/N]" when off, "keep it? [Y/n]"
# when on, where n removes the section. No input: nothing changes.
# This script never touches any Claude Code setting file.
set -uo pipefail

die() {
  echo "memory: $1" >&2
  exit 1
}

[ "$#" -eq 0 ] || die "takes no arguments"
[ -n "${HOME:-}" ] || die "HOME is not set"
command -v perl >/dev/null 2>&1 || die "perl not found"

BLOCK="$(cd "$(dirname "$0")/.." && pwd)/claude/CLAUDE.block.md"
[ -f "$BLOCK" ] || die "cannot find $BLOCK"
FULL="$(dirname "$BLOCK")/CLAUDE.full-access.md"
[ -f "$FULL" ] || die "cannot find $FULL"

# resolve DIR -> absolute path, symlinks resolved when it exists.
resolve() {
  local d="$1"
  case "$d" in /*) ;; *) d="$PWD/$d" ;; esac
  if [ -d "$d" ]; then
    d="$(cd "$d" && pwd -P)" || return 1
  fi
  printf '%s' "$d"
}

CLAUDE="$(resolve "${GREEBLE_CLAUDE_DIR:-$HOME/.claude}")" || die "cannot resolve the Claude folder"
VAULTS="$(resolve "${GREEBLE_VAULTS_DIR:-$HOME/Documents/Obsidian}")" || die "cannot resolve the vaults folder"
FILE="$CLAUDE/CLAUDE.md"
export GREEBLE_MEMORY_FILE="$FILE" GREEBLE_MEMORY_VAULTS="$VAULTS"
RULES_ARGS=("$BLOCK" "<!-- greeble:start -->" "<!-- greeble:end -->")
FULL_ARGS=("$FULL" "<!-- greeble-full-access:start -->" "<!-- greeble-full-access:end -->")

# answer "question" "hint" -> sets $ans to the lowercased reply; 1 on no input.
answer() {
  ans=""
  printf '%s %s ' "$1" "$2" >&2
  if ! IFS= read -r ans; then
    echo >&2
    return 1
  fi
  ans="$(printf '%s' "$ans" | tr '[:upper:]' '[:lower:]')"
  return 0
}

# ask "question" -> 0 on y/yes (any case), 1 otherwise (including no input).
ask() {
  answer "$1" "[y/N]" || return 1
  case "$ans" in
    y | yes) return 0 ;;
    *) return 1 ;;
  esac
}

# Mode "status" prints "absent", "same" or "differs".
# Mode "apply" writes the block: in place between the markers, or appended.
# Mode "remove" deletes the markers and the text between them.
# Args after the mode: block file, start marker, end marker.
# Exit 3: the markers are unbalanced. Exit 4: cannot read or write.
PERL='
use strict; use warnings;
my ($mode, $blockfile, $START, $END) = @ARGV;
my $file = $ENV{GREEBLE_MEMORY_FILE};
open(my $bh, "<:raw", $blockfile) or exit 4;
my $block = do { local $/; <$bh> }; close $bh;
my $vaults = $ENV{GREEBLE_MEMORY_VAULTS};
$block =~ s/<VAULTS>/$vaults/g;
$block .= "\n" unless $block =~ /\n\z/;
my $raw = "";
if (-e $file) {
  open(my $fh, "<:raw", $file) or exit 4;
  $raw = do { local $/; <$fh> }; close $fh;
  $raw = "" unless defined $raw;
}
my @lines = split /(?<=\n)/, $raw;
my (@s, @e);
for my $i (0 .. $#lines) {
  (my $l = $lines[$i]) =~ s/\r?\n\z//;
  push @s, $i if $l eq $START;
  push @e, $i if $l eq $END;
}
exit 3 if @s > 1 || @e > 1 || @s != @e || (@s && $e[0] < $s[0]);
my $out;
if (@s) {
  my ($i, $j) = ($s[0], $e[0]);
  my $inner = join "", @lines[$i + 1 .. $j - 1];
  if ($mode eq "status") { print $inner eq $block ? "same\n" : "differs\n"; exit 0 }
  if ($mode eq "remove") {
    my $pre = join "", @lines[0 .. $i - 1];
    my $post = join "", @lines[$j + 1 .. $#lines];
    # Undo the blank separator line "apply" adds before an appended block.
    chop $pre if $post eq "" && $pre =~ /\n\n\z/;
    $out = $pre . $post;
  } else {
    $out = join("", @lines[0 .. $i]) . $block . join("", @lines[$j .. $#lines]);
  }
} else {
  if ($mode eq "status") { print "absent\n"; exit 0 }
  exit 0 if $mode eq "remove";
  $out = $raw;
  $out .= "\n" if length($out) && $out !~ /\n\z/;
  $out .= "\n" if length($out);
  $out .= "$START\n$block$END\n";
}
my $tmp = "$file.greeble-tmp";
open(my $oh, ">:raw", $tmp) or exit 4;
print $oh $out or exit 4;
close $oh or exit 4;
rename($tmp, $file) or exit 4;
exit 0;
'

# run_perl mode args... -> runs $PERL, dies on unbalanced markers or I/O errors.
run_perl() {
  local mode="$1"
  shift
  perl -e "$PERL" "$mode" "$@"
  case $? in
    0) ;;
    3) die "$FILE has unbalanced greeble markers; changed nothing" ;;
    *) rm -f "$FILE.greeble-tmp"; die "cannot $([ "$mode" = status ] && echo read || echo write) $FILE" ;;
  esac
}

explain_full_access() {
  cat >&2 <<'TXT'
If you say yes, Claude will do these for Roblox work without asking each time: open, close and restart
Roblox Studio; start and stop playtests; start and install tools the work needs; save the place before risky work.
It will still always ask before: spending Robux or money, publishing to a live game, deleting your work,
or a login only you can pass. This adds rules text only; it does not change any permission setting.
TXT
}

# Second question, only once the rules block is in place.
full_access() {
  local st
  st="$(run_perl status "${FULL_ARGS[@]}")" || exit 1
  explain_full_access
  if [ "$st" = absent ]; then
    if ask "turn on full PC access?"; then
      run_perl apply "${FULL_ARGS[@]}"
      echo "full PC access is on in $FILE"
    else
      echo "full PC access is off"
    fi
    return 0
  fi
  if ! answer "full PC access is on. keep it?" "[Y/n]"; then
    echo "full PC access unchanged"
    return 0
  fi
  case "$ans" in
    n | no)
      run_perl remove "${FULL_ARGS[@]}"
      echo "full PC access is off; removed it from $FILE"
      ;;
    *)
      [ "$st" = differs ] && run_perl apply "${FULL_ARGS[@]}"
      echo "full PC access is on"
      ;;
  esac
  return 0
}

status="$(run_perl status "${RULES_ARGS[@]}")" || exit 1

case "$status" in
  same)
    echo "Greeble's rules already in $FILE"
    full_access
    exit 0
    ;;
  differs) ;;
  *)
    if ! ask "add Greeble's rules to $FILE?"; then
      echo "CLAUDE.md unchanged"
      exit 0
    fi
    ;;
esac

mkdir -p "$CLAUDE" || die "cannot create $CLAUDE"
run_perl apply "${RULES_ARGS[@]}"
if [ "$status" = differs ]; then
  echo "updated Greeble's rules in $FILE"
else
  echo "added Greeble's rules to $FILE"
fi
full_access
exit 0
