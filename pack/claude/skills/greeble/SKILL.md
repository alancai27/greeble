---
name: greeble
description: Use when a Roblox dev wants to fill a zone with set dressing in the style of an area they already built, i.e. "dress this zone", "make this look like the market", "add props here", or "redo that with a different seed". Drives the greeble MCP tools to learn a style, dress a zone and check the result.
---

# Greeble: learn, dress, check

Greeble learns the style of a built area and dresses empty zones to match.
You drive it through the `greeble` MCP server. You never place assets yourself.

## The tools

- `greeble_learn_profile { path, label? }` learns a style from a built area.
  `path` is the instance path, e.g. `Workspace/Map/Market`.
- `greeble_dress_zone { zone, maxInstances?, seed? }` dresses one zone.
  `zone` is the name of the zone Part.
- `greeble_job_status { id }` returns `{ id, status, result }`.
  `status` is `queued`, `running`, `done` or `failed`.

Learn and dress return a job `{ id, status }` at once; the work runs in Studio.

**Labels.** A style is stored per label. A zone uses the style for its own
`Label`, or `default` if it has none. Learning with no label stores `default`.
Pass `label` only when the dev names one, or says the zone they want dressed
has that Label. Otherwise omit it. Never invent one from the map's name or path.

## Order: learn, then dress, then poll

1. **Learn.** Ask the dev which built area has the look they want, unless they
   said. Call `greeble_learn_profile` with its path (a `label` only per the
   rule above) and poll until `done`. Skip this if that look is learned already.
2. **Dress.** Zones are Parts named `GreebleZone`. Their `ZoneId`, `Label`,
   `MaxInstances` and `Seed` attributes are the defaults. Call
   `greeble_dress_zone` with the zone name. Pass `maxInstances` or `seed` only
   when the dev asked for a change.
3. **Poll.** Call `greeble_job_status` every few seconds until the status is
   `done` or `failed`. Don't start a second dress on the same zone meanwhile.
4. **Check.** See below, then tell the dev in one or two lines what changed.

## If a dress fails with "no profile"

The error reads `no profile for label "<x>"; learned labels: <a>, <b>`.
Compare `<x>`, the zone's label, with the learned labels.
- None learned: go back to step 1, then dress again.
- `<x>` is `default` and a style exists under another label: either re-learn
  with no label, or tell the dev which Label to set on the zone Part. Say
  which you chose and why.
- Otherwise tell the dev the zone's label and the learned ones, and ask which
  look they want. Never re-learn with a label that just failed to match.

## When a job stays queued

Jobs only run while Studio is open with the Greeble plugin in Listen mode.
If a job is still `queued` after about 30 seconds, stop polling and tell the dev:

> Greeble is waiting for Studio. Open the place in Studio, open the Greeble
> plugin and switch it to Listen. I'll pick the job up as soon as it runs.

Once they confirm, poll the same job id again. Don't submit a duplicate job.

## Checking the result

- If the Roblox Studio MCP is connected, use it to look at the zone: count
  what was added, confirm it sits inside the zone, and confirm any Parts
  tagged `GreebleKeepClear` were left empty. A screenshot helps the dev see it.
- Otherwise report the job `result` and ask the dev to look in Studio.
- Never place, move or delete assets by hand, with the Studio MCP or any other
  tool, to fill gaps or fix a result. If it's wrong, retry through Greeble.

## Retrying

- **Different layout, same density:** dress again with a new integer `seed`.
- **Too busy or too sparse:** dress again with a lower or higher
  `maxInstances`. Keep the seed if the dev liked the layout otherwise.
- **Wrong look altogether:** learn from a different area, then dress again.
- On `failed` with any other message, tell the dev the message in one line
  and ask how they want to proceed. Don't retry the same call in a loop.
- **New kinds of props:** Greeble uses only the dev's kit folder (default
  `ServerStorage/GreebleKit`). Once the dev adds them, learn and dress again.
