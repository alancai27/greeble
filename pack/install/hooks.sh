#!/usr/bin/env bash
# Usage: pack/install/hooks.sh
# Offers to turn the pack's hooks on in Claude Code's settings.json
# (<CLAUDE>/settings.json, <CLAUDE> = $GREEBLE_CLAUDE_DIR or $HOME/.claude):
#   1. PostToolUse on Write|Edit|MultiEdit runs hooks/greeble/luau-check.sh
#   2. SessionStart runs hooks/greeble/session-start.sh
#   3. the status line runs hooks/greeble/statusline.sh
# One "[y/N]" question per item on stdin; with no input (no terminal) nothing
# changes. An item already there is skipped without asking. The file is parsed,
# merged and rewritten with perl's JSON::PP; every other key is kept. The first
# change backs the file up once to settings.json.greeble-bak.
set -uo pipefail

die() {
  echo "hooks: $1" >&2
  exit 1
}

[ "$#" -eq 0 ] || die "takes no arguments"
[ -n "${HOME:-}" ] || die "HOME is not set"
command -v perl >/dev/null 2>&1 || die "perl not found"

CLAUDE="${GREEBLE_CLAUDE_DIR:-$HOME/.claude}"
case "$CLAUDE" in /*) ;; *) CLAUDE="$PWD/$CLAUDE" ;; esac
if [ -d "$CLAUDE" ]; then
  CLAUDE="$(cd "$CLAUDE" && pwd -P)" || die "cannot resolve $CLAUDE"
fi
SETTINGS="$CLAUDE/settings.json"
BACKUP="$SETTINGS.greeble-bak"
export GREEBLE_HOOKS_SETTINGS="$SETTINGS"
export GREEBLE_HOOKS_DIR="$CLAUDE/hooks/greeble"

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

# The merge. Mode "status" prints one line per item: "<item> present", or
# "<item> absent" (statusline may add a tab and the current command).
# Mode "apply" adds the items named in GREEBLE_HOOKS_ITEMS and writes the file.
# Exit 3 means the file does not parse as a JSON object.
PERL='
use strict; use warnings; use JSON::PP;
my ($mode) = @ARGV;
my $file = $ENV{GREEBLE_HOOKS_SETTINGS};
my $dir = $ENV{GREEBLE_HOOKS_DIR};
my $s = {};
if (-e $file) {
  open(my $fh, "<:raw", $file) or exit 3;
  local $/; my $raw = <$fh>; close $fh;
  $s = eval { JSON::PP->new->utf8->decode($raw) };
  exit 3 unless ref($s) eq "HASH";
}
exit 3 if exists $s->{hooks} && ref($s->{hooks}) ne "HASH";
for my $ev (qw(PostToolUse SessionStart)) {
  exit 3 if $s->{hooks} && exists $s->{hooks}{$ev} && ref($s->{hooks}{$ev}) ne "ARRAY";
}
my %cmd = (
  luau => "$dir/luau-check.sh",
  session => "$dir/session-start.sh",
  statusline => "$dir/statusline.sh",
);
my %event = (luau => "PostToolUse", session => "SessionStart");
sub has_hook {
  my ($ev, $c) = @_;
  my $list = $s->{hooks} && $s->{hooks}{$ev} or return 0;
  for my $m (@$list) {
    next unless ref($m) eq "HASH" && ref($m->{hooks}) eq "ARRAY";
    for my $h (@{$m->{hooks}}) {
      return 1 if ref($h) eq "HASH" && defined $h->{command} && !ref($h->{command}) && $h->{command} eq $c;
    }
  }
  return 0;
}
my $sl = $s->{statusLine};
my $sl_cmd = ref($sl) eq "HASH" && defined $sl->{command} && !ref($sl->{command}) ? $sl->{command} : undef;
if ($mode eq "status") {
  for my $i (qw(luau session)) {
    print "$i ", (has_hook($event{$i}, $cmd{$i}) ? "present" : "absent"), "\n";
  }
  if (defined $sl_cmd && $sl_cmd eq $cmd{statusline}) { print "statusline present\n" }
  elsif (defined $sl) {
    my $cur = defined $sl_cmd ? $sl_cmd : JSON::PP->new->canonical->encode($sl);
    $cur =~ s/[\r\n\t]+/ /g;
    print "statusline absent\t$cur\n";
  }
  else { print "statusline absent\n" }
  exit 0;
}
my %want = map { $_ => 1 } split / /, ($ENV{GREEBLE_HOOKS_ITEMS} // "");
if ($want{luau} && !has_hook("PostToolUse", $cmd{luau})) {
  push @{$s->{hooks}{PostToolUse}}, {
    matcher => "Write|Edit|MultiEdit",
    hooks => [{ type => "command", command => $cmd{luau}, timeout => 30 }],
  };
}
if ($want{session} && !has_hook("SessionStart", $cmd{session})) {
  push @{$s->{hooks}{SessionStart}}, { hooks => [{ type => "command", command => $cmd{session} }] };
}
if ($want{statusline}) {
  $s->{statusLine} = { type => "command", command => $cmd{statusline} };
}
my $out = JSON::PP->new->utf8->canonical->pretty->indent_length(2)->encode($s);
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
  3) die "$SETTINGS does not parse as a JSON object; changed nothing" ;;
  *) die "cannot read $SETTINGS" ;;
esac

state() {
  printf '%s\n' "$status" | awk -v i="$1" '$1 == i { print $2 }'
}
current_statusline="$(printf '%s\n' "$status" | awk -F '\t' '/^statusline absent\t/ { print $2 }')"

items=""
if [ "$(state luau)" = present ]; then
  echo "Luau check hook already on"
elif ask "turn on the Luau check after each Write/Edit (PostToolUse hook)?"; then
  items="$items luau"
fi
if [ "$(state session)" = present ]; then
  echo "session start hook already on"
elif ask "turn on the greeble session start hook (SessionStart)?"; then
  items="$items session"
fi
if [ "$(state statusline)" = present ]; then
  echo "greeble status line already on"
else
  if [ -n "$current_statusline" ]; then
    q="replace the status line already set ($current_statusline) with greeble's?"
  else
    q="turn on the greeble status line?"
  fi
  if ask "$q"; then
    items="$items statusline"
  fi
fi

if [ -z "$items" ]; then
  echo "settings.json unchanged"
  exit 0
fi

mkdir -p "$CLAUDE" || die "cannot create $CLAUDE"
if [ -e "$SETTINGS" ] && [ ! -e "$BACKUP" ]; then
  cp -p "$SETTINGS" "$BACKUP" || die "cannot back up $SETTINGS"
fi
GREEBLE_HOOKS_ITEMS="${items# }" perl -e "$PERL" apply
case $? in
  0) ;;
  3) die "$SETTINGS does not parse as a JSON object; changed nothing" ;;
  *) rm -f "$SETTINGS.greeble-tmp"; die "cannot write $SETTINGS" ;;
esac
echo "turned on in $SETTINGS:${items}"
exit 0
