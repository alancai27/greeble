#!/bin/sh
# Usage: a Claude Code SessionStart payload on stdin (reads cwd).
# Game = folder name of the git root, or of the working folder outside a repo.
# Vaults live in $GREEBLE_VAULTS_DIR, else $HOME/Documents/Obsidian.
# If <vaults>/<game>/CLAUDE.md exists, prints it, then the newest HANDOFF.md
# in the game folder or the vault, each under a one-line heading.
# No vault: prints nothing. Always exits 0.
# POSIX sh: runs under bash and zsh. JSON and file work use perl; macOS ships it.

input=
[ -t 0 ] || input=$(cat 2>/dev/null)

GREEBLE_HOOK_INPUT=$input perl - <<'PERL' 2>/dev/null
use strict;
use warnings;
use JSON::PP;
use Cwd qw(abs_path);
use File::Basename qw(basename);

my $j = eval { decode_json($ENV{GREEBLE_HOOK_INPUT} // '') };
my $cwd = ref $j eq 'HASH' && !ref $j->{cwd} ? $j->{cwd} : undef;
$cwd = $ENV{PWD} unless defined $cwd && length $cwd && -d $cwd;
exit 0 unless defined $cwd && -d $cwd;
$cwd = abs_path($cwd) // $cwd;

my $root = $cwd;
for (my $d = $cwd; ; ) {
  if (-e "$d/.git") { $root = $d; last }
  last if $d eq '/' || $d eq '';
  (my $up = $d) =~ s{/[^/]*$}{};
  $d = length $up ? $up : '/';
}
my $game = basename($root);
exit 0 unless length $game && $game ne '/';

my $home = $ENV{HOME} // '';
my $vaults = length($ENV{GREEBLE_VAULTS_DIR} // '')
  ? $ENV{GREEBLE_VAULTS_DIR} : "$home/Documents/Obsidian";
my $vault = "$vaults/$game";
my $claude = "$vault/CLAUDE.md";
exit 0 unless -f $claude;

# Newest HANDOFF.md under the folders: three levels deep, skipping heavy
# dirs, and at most 2000 folders so a large tree stays fast.
sub newest_handoff {
  my ($best, $best_m);
  my @queue = map { [$_, 0] } @_;
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

sub slurp {
  open my $fh, '<', $_[0] or return '';
  local $/;
  my $s = <$fh>;
  return $s // '';
}

my $text = slurp($claude);
$text .= "\n" unless $text =~ /\n\z/;
print "## Vault: $claude\n\n$text";

my $handoff = newest_handoff($root, $vault);
if (defined $handoff) {
  my $h = slurp($handoff);
  $h .= "\n" unless $h =~ /\n\z/;
  print "\n## Handoff: $handoff\n\n$h";
}
PERL

exit 0
