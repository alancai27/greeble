#!/bin/sh
# Usage: luau-check.sh <file>
#    or: a Claude Code PostToolUse payload on stdin (reads tool_input.file_path)
# Runs selene and stylua --check when installed, then every rule in
# luau-rules.tsv. Prints "<file>:<line>: <message>" to stderr.
# Exit 2 on any finding, 0 when clean. Non-Luau files exit 0 untouched.
# POSIX sh: runs under bash and zsh. Rules are Perl regexes; macOS ships perl.

here=$(cd "$(dirname "$0")" && pwd)
file=${1:-}

if [ -z "$file" ] && [ ! -t 0 ]; then
  file=$(perl -MJSON::PP -0777 -ne '
    my $j = eval { decode_json($_) } or exit 0;
    my $t = $j->{tool_input} || {};
    print $t->{file_path} // "";
  ')
fi

case "$file" in
  *.lua | *.luau) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

rc=0

if command -v selene >/dev/null 2>&1; then
  if ! out=$(selene --display-style quiet "$file" 2>&1); then
    printf '%s\n' "$out" >&2
    rc=2
  fi
fi

if command -v stylua >/dev/null 2>&1; then
  if ! stylua --check "$file" >/dev/null 2>&1; then
    printf '%s:1: not formatted; run stylua on it\n' "$file" >&2
    rc=2
  fi
fi

perl - "$here/luau-rules.tsv" "$file" <<'PERL' || rc=2
use strict;
use warnings;

my ($rules, $file) = @ARGV;
open my $fh, '<', $file or exit 0;
my $src = do { local $/; <$fh> };
close $fh;

# Blank out comments, keeping offsets and newlines, so rules skip them.
$src =~ s{--\[(=*)\[.*?\]\1\]}{ (my $c = $&) =~ tr/\n/ /c; $c }gse;
$src =~ s{--[^\n]*}{ ' ' x length($&) }ge;

open my $rf, '<', $rules or die "cannot read $rules\n";
my $found = 0;
while (my $row = <$rf>) {
  chomp $row;
  $row =~ s/\r$//;
  next if $row eq '' || $row =~ /^#/;
  my ($id, $re, $msg) = split /\t/, $row, 3;
  next if $id eq 'id';
  my $rx = qr/$re/m;
  while ($src =~ /$rx/g) {
    my $line = 1 + (substr($src, 0, $-[0]) =~ tr/\n//);
    print STDERR "$file:$line: $msg [$id]\n";
    $found = 1;
  }
}
exit($found ? 2 : 0);
PERL

exit "$rc"
