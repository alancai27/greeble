---
name: roblox-review-council
description: Use when a Roblox dev has to make a ship decision and wants a hard second opinion first, i.e. "should we ship this?", "is this update ready?", "review this before launch", or "go or no-go on the new shop". Runs a blind multi-agent review, one lens per reviewer, and merges it into one verdict that keeps the dissent.
---

# Review council: blind lenses, one verdict

The council is 3 to 5 `review-member` subagents, each looking through one
lens, plus one `review-chair` that merges them. Members answer alone. None of
them sees another's answer, so they can't anchor on each other or agree for
the sake of it. The chair turns their answers into one verdict and keeps
every disagreement in plain words.

## When to use it

- A ship decision: release an update, open a game to the public, turn on a
  new paid item, change a live economy, run an event.
- The dev asks for a go or no-go and the stakes are real players or Robux.

## When not to use it

- Everyday code review, a bug hunt or a style question. Review it yourself.
- A question with one right answer ("how do I save data?"). Use the
  `roblox-knowledge-lookup` agent instead.
- Nothing is built yet. A council needs a concrete thing to judge.
- The dev wants it done fast. A council costs several agents' worth of time.

## The lenses

- **player**: is it fun, clear and fair to a new player in their first minutes?
- **security**: can an exploiter abuse it? Remotes, server trust, datastores.
- **economy**: does it inflate, leak or pay to win? Prices, sinks, Robux.
- **performance**: does it hold up on a cheap phone and a full server?
- **art**: does it look finished and consistent with the rest of the game?

## Order: pick lenses, run members blind, chair, report

1. **Pick lenses.** Choose 3 to 5 that fit the decision. A shop change needs
   economy, security and player; a new map needs art, performance and player.
   Always include security when anything touches remotes, data or Robux.
   Write the question once, in one or two sentences, with what is shipping
   and the paths or places to look. Every member gets the same question.
2. **Run members blind.** Start one `review-member` per lens, all in the same
   turn so they run in parallel. Give each only its lens and the question.
   Don't pass your own opinion, another member's answer or a hint about
   which way to lean. Don't start a member after reading another's answer.
3. **Chair.** Start one `review-chair` with the question and every member's
   answer exactly as returned, each labelled with its lens. Don't edit,
   trim or summarise them first.
4. **Report with dissent.** Give the dev the chair's verdict, its top risks
   and the dissent, as the chair wrote them. Don't soften a dissent or drop
   it because the verdict went the other way. Add one line on what you'd
   do next, labelled as your own view.

## Rules

- The council only reads. No member, chair or you, while running it,
  edits files, runs commands, publishes or changes the place.
- One council per decision. If the dev changes the build, run a fresh one;
  don't feed the old answers back in.
- If a member can't see what it needs to judge, it says so in its answer.
  Pass that on as a gap; don't guess on its behalf.
- The verdict is advice. The dev makes the ship call.
