---
name: roblox-onboarding
description: Use when a Roblox dev wants new players taught the game, i.e. "add a tutorial", "players quit in the first minute", "add guide arrows" or "track where new players drop off". Designs and builds the first 60 to 90 seconds with guide arrows, stuck hints, skip and resume, and onboarding funnel events.
---

# Roblox onboarding

Get a new player from spawn to the core loop in 60 to 90 seconds, show them
the way without walls of text, and measure where they stop.

## Before you start

- Read `<VAULTS>/Roblox Knowledge/rules/game-design.md`, `ui.md` and
  `reward-juice.md`. Design to them; don't repeat them to the dev.
- Ask the dev what the core loop is and what "onboarded" means for this game,
  if they didn't say.
- Ask before publishing, changing game settings or turning on anything
  outside the place. Editing the place is fine.

## Steps

1. **Pick the steps.** Write 4 to 7 steps, each one player action, e.g.
   spawned, moved, picked up tool, first hit, first reward, joined loop.
   Time them against 60 to 90 seconds in total. Show the dev; get a yes.
2. **Step state on the server.** A server module tracks each player's
   current step and advances only when the server sees the action happen.
   The client never says "I finished step 3".
3. **Guide arrows.** Point to the next goal with a Beam between an
   Attachment on the character and one at the goal; set `TextureSpeed` so
   the texture flows toward the goal. Both attachments must be in Workspace.
   Add an on-screen pointer for goals off camera. Remove both on arrival.
4. **Stuck hints.** If a player hasn't advanced after a set time, show one
   short hint for that step. If still stuck, make the hint stronger (highlight,
   closer arrow). Never block movement or the camera.
5. **Skip and resume.** Offer a skip button from the first screen. Save the
   current step and a done flag in the player's data, so a player who leaves
   resumes where they were and a player who finished or skipped never sees
   it again.
6. **Funnel events.** From the server, call
   `AnalyticsService:LogOnboardingFunnelStepEvent(player, step, stepName)`
   when each step completes. Steps start at 1, go up by one, and stay within
   1 to 100; log step 1 on join. This is a one-time funnel: repeats by the
   same player count once, and a skipped number counts the earlier steps as
   done, so log a skip with `AnalyticsService:LogCustomEvent` rather than jumping
   ahead. Keep step
   names stable once live. The `rbx-instrument-analytics` skill covers the
   wider analytics setup, if it is installed.
7. **Play test.** Through the Studio MCP, run once as a new player and time
   it; once going idle at each step to see the hints; once skipping; once
   leaving mid-way and rejoining. Read the output for errors.
8. **Report.** Tell the dev the steps, the measured time, and that the funnel
   appears in the Analytics dashboard once real players arrive.

## Finish checklist

- [ ] 4 to 7 steps, each one action, finishing in 60 to 90 seconds.
- [ ] Steps advance only on what the server observed.
- [ ] A guide arrow shows the next goal and disappears on arrival.
- [ ] Idle players get a hint, then a stronger one, and are never locked.
- [ ] Skip works from the first screen; leaving and rejoining resumes.
- [ ] Finished or skipped players never see onboarding again.
- [ ] Each step logs `LogOnboardingFunnelStepEvent` from the server, in
      order from 1.
- [ ] The four play tests ran with no errors in the output.
