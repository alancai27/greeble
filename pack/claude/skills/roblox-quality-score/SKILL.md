---
name: roblox-quality-score
description: Use when a Roblox asset or feature is about to be called done, i.e. "is this good enough", "score this model", "rate the UI", or before a release. Scores each model, animation, UI, system, world or VFX piece 0-10 on a fixed rubric, holds it to a minimum of 8.5 and records the score in the game repo's ledger.
---

# Quality score: rate, fix, record

A score is a second opinion, not a gate on its own. It never replaces the
game's own checks: tests, `scripts/check`, lint or playtests still have to
pass. A high score on a failing build means nothing.

## Steps

1. **Pick the type.** Each piece gets one type: `model`, `animation`, `ui`,
   `system`, `world` or `vfx`. A feature with several parts gets one score
   per part.
2. **Open the matching rules** in `<VAULTS>/Roblox Knowledge/rules/` and judge
   against them: model and world use `map-checks.md`, animation uses
   `animation.md`, ui uses `ui.md`, system uses `code.md` and `traps.md`, vfx
   uses `vfx.md` and `sound.md`. Don't copy their text into the ledger.
3. **Look at the real thing.** Inspect it in Studio, play it, or read the
   code. Never score from a description or a file name.
4. **Score each criterion 0-10** from the table below, then average them.
   Round to one decimal. Any criterion under 6 caps the total at 7.9.
5. **Minimum is 8.5.** Below that, list the lowest criteria, fix them (or ask
   the owner to), and score again. Stop after three rounds and report.
6. **Record it** (see Ledger), then run the game's own checks.

## Rubric

Each row is four criteria. 10 means nothing to improve, 8 is shippable with
minor notes, 5 works but players will notice, 2 is broken.

| Type | Criteria |
| --- | --- |
| model | silhouette reads at play distance; scale matches the character; under 20,000 triangles per mesh; collision fits how players touch it |
| animation | weight and timing; clean loop or clean end; reads from the default camera; no foot sliding or clipping |
| ui | readable on phone and console; stays clear of system UI (`ScreenGui.ScreenInsets`); one obvious primary action; feedback on every press |
| system | server decides anything that matters; survives a rejoin or crash; handles bad input; costs fit the performance budget |
| world | player knows where to go; landmarks and sightlines; no holes, stuck spots or out-of-bounds; matches the art direction |
| vfx | reads at a glance; fits the event's importance; ends cleanly; stays cheap on low-end devices |

## Ledger

Append one JSON object per score, one line each, to `.roblox-ai/ledger.jsonl`
at the root of the game repo. Create the folder if it's missing. Never
rewrite or delete earlier lines; a re-score is a new line.

    {"ts":"2026-01-31T14:02:00Z","asset":"Workspace/Map/Market/Stall",
     "type":"model","criteria":[9,8,10,8],"score":8.8,"pass":true,
     "round":1,"notes":"collision box a little wide"}

Keep it on one line in the file. `asset` is the instance path or the source
file. `notes` is one short sentence, no logs.

## Rules for the scorer

- Score the work, not the effort. Don't round up to reach 8.5.
- If you can't inspect a piece, write no score; say what you couldn't see.
- Scores in the ledger are honest history. A failed round stays in it.
- Anything outside the repo (installing a plugin, publishing, changing
  settings) needs the owner's yes first.

## Finish checklist

- [ ] Every piece has a type and was looked at directly
- [ ] All four criteria scored against the vault rules for that type
- [ ] Total is 8.5 or above, or the report says why it stopped
- [ ] One new line per score in `.roblox-ai/ledger.jsonl`
- [ ] The game's own checks were run and pass
