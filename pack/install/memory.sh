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
export GREEBLE_MEMORY_FILE="$FILE" GREEBLE_MEMORY_BLOCK="$BLOCK" GREEBLE_MEMORY_VAULTS="$VAULTS"

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

# Mode "status" prints "absent", "same" or "differs".
# Mode "apply" writes the block: in place between the markers, or appended.
# Exit 3: the markers are unbalanced. Exit 4: cannot read or write.
PERL='
use strict; use warnings;
my ($mode) = @ARGV;
my $file = $ENV{GREEBLE_MEMORY_FILE};
my $START = "<!-- greeble:start -->";
my $END = "<!-- greeble:end -->";
open(my $bh, "<:raw", $ENV{GREEBLE_MEMORY_BLOCK}) or exit 4;
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
  $out = join("", @lines[0 .. $i]) . $block . join("", @lines[$j .. $#lines]);
} else {
  if ($mode eq "status") { print "absent\n"; exit 0 }
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

status="$(perl -e "$PERL" status)"
case $? in
  0) ;;
  3) die "$FILE has unbalanced greeble markers; changed nothing" ;;
  *) die "cannot read $FILE" ;;
esac

case "$status" in
  same)
    echo "Greeble's rules already in $FILE"
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
perl -e "$PERL" apply
case $? in
  0) ;;
  3) die "$FILE has unbalanced greeble markers; changed nothing" ;;
  *) rm -f "$FILE.greeble-tmp"; die "cannot write $FILE" ;;
esac
if [ "$status" = differs ]; then
  echo "updated Greeble's rules in $FILE"
else
  echo "added Greeble's rules to $FILE"
fi
exit 0
