# Greeble pack

Greeble's pack for Claude Code: our skills, rules, hooks and vault files for Roblox work.
One script copies it into place on your Mac and connects Claude Code to the Greeble server.

## Before you start

- macOS, with Claude Code installed so `claude` runs in your terminal.
- Roblox Studio with the Greeble plugin installed.
- A studio key and the server URL, from whoever runs your Greeble server.

Paths below use `<CLAUDE>` for Claude Code's folder (default `$HOME/.claude`) and `<VAULTS>`
for your Obsidian vaults folder (default `$HOME/Documents/Obsidian`). To use other folders,
set `GREEBLE_CLAUDE_DIR` or `GREEBLE_VAULTS_DIR` before running the installer.

## Install

From the folder that holds `pack/`, run:

    bash pack/install/install.sh

It asks these questions, in this order. Every yes/no question defaults to no: pressing
Enter, or running with no terminal, means no. A question is skipped when its answer is already in place.

1. `<path> differs from the pack. overwrite?` once for each pack file you already have
   and have changed. Yes puts the pack's copy in; no keeps yours.
2. `turn on the Luau check after each Write/Edit (PostToolUse hook)?` Yes adds the hook
   to `<CLAUDE>/settings.json`; no leaves it off.
3. `turn on the greeble session start hook (SessionStart)?` Yes adds it; no leaves it off.
4. `turn on the greeble status line?` or, if you already have one,
   `replace the status line already set (...) with greeble's?` Yes sets Greeble's; no keeps yours.
   The first change to `settings.json` saves a backup as `settings.json.greeble-bak`.
5. `add Greeble's rules to <CLAUDE>/CLAUDE.md?` Yes adds the rules block between
   `greeble:start` and `greeble:end` markers; no leaves the file alone and skips question 6.
6. `turn on full PC access?` Yes lets Claude open and restart Studio, run playtests, install tools
   and save the place without asking each time; it still asks before spending, publishing,
   deleting or a login. No keeps it off. If it is already on, the question is
   `full PC access is on. keep it?` with yes as the default; no removes it.
7. `greeble server URL:` type the server URL. Skipped if `GREEBLE_URL` is set.
8. `greeble key (hidden):` paste your key; nothing shows as you type. Skipped if `GREEBLE_KEY` is set.
9. `add a line to ~/.zshrc that loads it?` Yes adds one line so new shells load your key;
   no prints the line for you to add yourself.
10. `the greeble MCP entry in Claude Code differs from the pack. replace?` only if you
    already have a different `greeble` entry. Yes replaces it; no keeps yours.

It ends by printing how many files it copied, kept and skipped, then checks that Claude Code
connects to the server. It is safe to run twice: files that match are skipped, and nothing you said no to is changed.
To update, get the latest pack (in a clone, `git pull`) and run the same command again.

## Check it works

Open a new terminal, so your key is loaded, and run:

    bash pack/install/doctor.sh

It changes nothing and prints one line per check:
- `ok` the check passed.
- `warn` it works, but something is missing that you may want, such as `rojo`, `selene` or `stylua`.
- `fail` it will not work until you fix this. The line says what to do. The script exits 1 if any check fails.

Then open Claude Code in your game's folder, with Studio open, and say:
1. "learn the style of <path>", where `<path>` is an area of your place you already built.
2. "dress the zone", to fill a new zone in that style.

## What gets installed

| Part | Where it lands | What it is for |
| --- | --- | --- |
| `skills/greeble` | `<CLAUDE>/skills/greeble` | Learn a built area's style and dress a zone with props in it |
| `skills/new-project` | `<CLAUDE>/skills/new-project` | Start a project or game vault from a template |
| `skills/roblox-anti-exploit-review` | `<CLAUDE>/skills/roblox-anti-exploit-review` | Check features a cheater would profit from |
| `skills/roblox-asset-import` | `<CLAUDE>/skills/roblox-asset-import` | Bring FBX, glTF or OBJ models into Studio |
| `skills/roblox-blender-modeling` | `<CLAUDE>/skills/roblox-blender-modeling` | Get Blender models ready to export for Roblox |
| `skills/roblox-datastore-safety` | `<CLAUDE>/skills/roblox-datastore-safety` | Save and load player data safely |
| `skills/roblox-debugging` | `<CLAUDE>/skills/roblox-debugging` | Find the cause of broken Roblox code |
| `skills/roblox-monetization` | `<CLAUDE>/skills/roblox-monetization` | Game passes, developer products and shops |
| `skills/roblox-onboarding` | `<CLAUDE>/skills/roblox-onboarding` | Teach new players the game |
| `skills/roblox-performance-audit` | `<CLAUDE>/skills/roblox-performance-audit` | Find lag and fit low-end phones |
| `skills/roblox-quality-score` | `<CLAUDE>/skills/roblox-quality-score` | Score work before calling it done |
| `skills/roblox-review-council` | `<CLAUDE>/skills/roblox-review-council` | A hard second opinion before shipping |
| `skills/roblox-secure-remotes` | `<CLAUDE>/skills/roblox-secure-remotes` | Write and review remotes safely |
| `skills/roblox-system-builder` | `<CLAUDE>/skills/roblox-system-builder` | Build a whole system, such as a shop or quests |
| `skills/roblox-trend-game` | `<CLAUDE>/skills/roblox-trend-game` | Build a fast trend-format game |
| `skills/roblox-ui-review` | `<CLAUDE>/skills/roblox-ui-review` | Check UI on phone, tablet and desktop |
| `skills/roblox-worldbuilding` | `<CLAUDE>/skills/roblox-worldbuilding` | Lay out maps so they read as designed |
| `agents/review-chair.md` | `<CLAUDE>/agents` | Turns the council's answers into one verdict |
| `agents/review-member.md` | `<CLAUDE>/agents` | One council member reviewing through one lens |
| `agents/roblox-knowledge-lookup.md` | `<CLAUDE>/agents` | Quick Roblox fact lookup from the knowledge vault |
| `commands/audit.md` | `<CLAUDE>/commands` | `/audit`: check every Luau file, ranked fix list |
| `commands/continue-game.md` | `<CLAUDE>/commands` | `/continue-game`: pick up from HANDOFF.md |
| `commands/learn.md` | `<CLAUDE>/commands` | `/learn`: turn the review ledger into recipes |
| `commands/log-trap.md` | `<CLAUDE>/commands` | `/log-trap`: record a trap and its fix |
| `commands/new-system.md` | `<CLAUDE>/commands` | `/new-system`: build a gameplay system |
| `commands/review-council.md` | `<CLAUDE>/commands` | `/review-council`: put work before the council |
| `commands/trend-game.md` | `<CLAUDE>/commands` | `/trend-game`: plan a game around a trend |
| `hooks/luau-check.sh`, `hooks/luau-rules.tsv` | `<CLAUDE>/hooks/greeble` | Luau checks after each Write or Edit (question 2) |
| `hooks/session-start.sh` | `<CLAUDE>/hooks/greeble` | Loads the game's vault notes at session start (question 3) |
| `hooks/statusline.sh` | `<CLAUDE>/hooks/greeble` | Status line: game, stage, branch, Studio open (question 4) |
| `CLAUDE.block.md` | `<CLAUDE>/CLAUDE.md`, inside markers | Greeble's rules (question 5) |
| `CLAUDE.full-access.md` | `<CLAUDE>/CLAUDE.md`, inside markers | Full PC access rules (question 6) |
| `vaults/Roblox Knowledge` | `<VAULTS>/Roblox Knowledge` | Shared knowledge: `rules`, `setup` and `workflow` notes |
| `vaults/_templates/project-vault` | `<VAULTS>/_templates/project-vault` | Template for a project vault: `changelog`, `decisions`, `rules`, `_graph`, `_templates`, `.obsidian` |
| `vaults/_templates/roblox-vault` | `<VAULTS>/_templates/roblox-vault` | Template for a game vault: the project folders plus `assets` and `style-guide` |
| `vaults/_tools` | `<VAULTS>/_tools` | `new-project-vault.sh`, which makes a vault from a template |

Parts are paths under `pack/claude` or `pack/vaults`.

## Not included

- Third-party tools and skill packs are not shipped or installed. Install `rojo`, `selene`
  and `stylua` yourself if you want the full Luau checks.
- Windows is not supported yet.

## Your key

- The installer stores `GREEBLE_URL` and `GREEBLE_KEY` in `$HOME/.greeble/env`, with mode 600
  so only you can read it.
- Claude Code reads them from the environment. Its config holds only the names, never the values.
- The key is never written to Claude's config, never passed as a command argument and never printed.
