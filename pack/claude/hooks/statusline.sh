#!/bin/sh
# Usage: a Claude Code status line payload on stdin (reads workspace.current_dir,
# then cwd). Prints one line: "<game> | <stage> | <branch> | studio <open|closed>".
# Game = folder name of the git root, or of the working folder outside a repo.
# Stage = text after "Stage:" on the first such line of the newest HANDOFF.md in
# the game folder or its vault ($GREEBLE_VAULTS_DIR, else
# $HOME/Documents/Obsidian), else "-". Branch is "-" outside a repo.
# Studio = whether a RobloxStudio process is running. No network, writes nothing.
# POSIX sh: runs under bash and zsh. JSON and file work use perl; macOS ships it.

input=
[ -t 0 ] || input=$(cat 2>/dev/null)

studio=closed
if pgrep -x RobloxStudio >/dev/null 2>&1; then
  studio=open
fi

GREEBLE_HOOK_INPUT=$input GREEBLE_STUDIO=$studio perl - <<'PERL' 2>/dev/null || echo "- | - | - | studio $studio"
use strict;
use warnings;
use JSON::PP;
use Cwd qw(abs_path);
use File::Basename qw(basename);

my $j = eval { decode_json($ENV{GREEBLE_HOOK_INPUT} // '') };
my $cwd;
if (ref $j eq 'HASH') {
  my $w = $j->{workspace};
  $cwd = $w->{current_dir} if ref $w eq 'HASH' && !ref $w->{current_dir};
  $cwd = $j->{cwd} if (!defined $cwd || !length $cwd) && !ref $j->{cwd};
}
$cwd = $ENV{PWD} unless defined $cwd && length $cwd && -d $cwd;
$cwd = abs_path($cwd) // $cwd if defined $cwd && -d $cwd;
$cwd //= '/';

my $root;
for (my $d = $cwd; ; ) {
  if (-e "$d/.git") { $root = $d; last }
  last if $d eq '/' || $d eq '';
  (my $up = $d) =~ s{/[^/]*$}{};
  $d = length $up ? $up : '/';
}
my $folder = $root // $cwd;
my $game = basename($folder);
$game = '-' unless length $game && $game ne '/';

sub slurp {
  open my $fh, '<', $_[0] or return '';
  local $/;
  my $s = <$fh>;
  return $s // '';
}

my $branch = '-';
if (defined $root) {
  my $gitdir = "$root/.git";
  if (-f $gitdir) {
    my ($p) = slurp($gitdir) =~ /^gitdir:\s*(.+?)\s*$/m;
    $gitdir = defined $p ? ($p =~ m{^/} ? $p : "$root/$p") : '';
  }
  my $head = slurp("$gitdir/HEAD");
  if ($head =~ m{^ref:\s*refs/heads/(.+?)\s*$}m) { $branch = $1 }
  elsif ($head =~ /^([0-9a-f]{7})/) { $branch = $1 }
}

# Newest HANDOFF.md under the folders: three levels deep, skipping heavy
# dirs, and at most 2000 folders so a large tree stays fast.
sub newest_handoff {
  my ($best, $best_m);
  my @queue = map { [$_, 0] } grep { -d } @_;
  my $seen = 0;
  while (my $item = shift @queue) {
    last if ++$seen > 2000;
    my ($dir, $depth) = @$item;
    opendir(my $dh, $dir) or next;
    for my $e (readdir $dh) {
      next if $e eq '.' || $e eq '..';
      my $p = "$dir/$e";
      if ($e eq 'HANDOFF.md' && -f $p) {
        my $m = (stat _)[9];
        ($best, $best_m) = ($p, $m) if !defined $best_m || $m > $best_m;
      } elsif ($depth < 3 && !-l $p && -d _
               && $e !~ /^(\.git|node_modules|\.obsidian|\.trash|Library)$/) {
        push @queue, [$p, $depth + 1];
      }
    }
    closedir $dh;
  }
  return $best;
}

my $stage = '-';
if ($game ne '-') {
  my $home = $ENV{HOME} // '';
  my $vaults = length($ENV{GREEBLE_VAULTS_DIR} // '')
    ? $ENV{GREEBLE_VAULTS_DIR} : "$home/Documents/Obsidian";
  my @dirs = ($folder);
  push @dirs, "$vaults/$game" if $folder ne '/';
  my $handoff = newest_handoff(@dirs);
  if (defined $handoff && slurp($handoff) =~ /Stage:(.*)$/m) {
    (my $s = $1) =~ s/^[\s*_]+|[\s*_]+$//g;
    $stage = $s if length $s;
  }
}

print "$game | $stage | $branch | studio $ENV{GREEBLE_STUDIO}\n";
PERL

exit 0
