---
name: roblox-debugging
description: Use when Roblox code is broken and the cause isn't obvious, i.e. "Infinite yield possible", something works in Studio but not live, works for one player but not two, fails only sometimes, a part jitters or teleports, or "it just stopped working". Reproduces, isolates, bisects and verifies the fix, using the Studio MCP and the rbx-debug skill for breakpoints.
---

# Roblox debugging: reproduce, isolate, bisect, verify

Don't guess-and-patch. Each step ends with evidence you can show the dev.
Before retrying anything that failed before, read
`<VAULTS>/Roblox Knowledge/rules/traps.md`. For how project code is laid out
and checked, follow `rules/code.md`; this skill doesn't repeat it.

## 1. Reproduce

1. Write the bug as one line: what you did, what you expected, what happened.
2. Find the smallest setup that shows it: Studio Play, **Server & Clients**
   with two clients, or a live server. Note which one.
3. Make it fail on demand. If it fails only sometimes, run it ten times and
   write down the rate. A fix is only proven against that rate.
4. Capture the evidence: the Output text, or in a live game the Developer
   Console (F9) Log, switching between Client and Server. Server logs need
   edit permission on the game.

## 2. Isolate

Narrow it to one side, one script, one moment.

- **Client or server?** Check which Log view shows the error. Print
  `RunService:IsServer()` beside the failing line if unsure.
- **Which script?** Disable scripts until it stops, then turn them back on.
- **Which moment?** Add `print` with `os.clock()` at each step, or use the
  `rbx-debug` skill to set a breakpoint and inspect the thread.

## 3. Common causes, by symptom

- **"Infinite yield possible"**: a `WaitForChild` waited over 5 seconds with
  no timeout. The name is wrong, the child is created later or never, it lives
  somewhere that doesn't replicate (`ServerStorage`), or streaming hasn't sent
  it yet. Check the path in the live tree with the Studio MCP before
  changing code. Add a timeout only where missing is a valid state.
- **Race on join or spawn**: code connects `PlayerAdded` or `CharacterAdded`
  after it already fired. Handle players already present from
  `Players:GetPlayers()`, and a character already present, then connect.
- **Order changed between events**: with deferred signal behaviour an event
  fired from another handler runs later, not inline. Don't rely on handler
  order; pass the state you need.
- **Jitter, rubber-banding, wrong physics**: check the network owner. In
  Studio turn on **Network owners** in the viewport visualization options, or
  print `part:GetNetworkOwner()` on the server. Fix ownership with
  `SetNetworkOwner` on the server, not by fighting it each frame. For lag
  symptoms, use the `rbx-network-simulator` skill.
- **Remote argument arrives nil or wrong**: functions, metatables and
  instances the receiver can't see don't cross the boundary. Mixed or
  non-string table keys change in transit.
- **Live-only bugs**: Studio can't reach data stores unless the game enables
  Studio access to API services. Ask the dev before changing that setting,
  and only on a test place, never the live one. Also check streaming,
  real latency, more players, and code gated on `RunService:IsStudio()`.

## 4. Bisect

When it used to work:

1. Find a known-good commit and the first known-bad one.
2. `git bisect` between them, running the step-1 reproduction at each stop.
3. Read only the diff of the first bad commit.

When there is no history, bisect the code instead: comment out half of the
suspect path, test, and keep the half that still fails.

## 5. Fix and verify

1. Write down the cause in one sentence before writing the fix.
2. Fix the cause, not the symptom. No `task.wait()` to dodge a race; wait
   for the actual thing.
3. Run the exact step-1 reproduction. For an intermittent bug, run it as many
   times as before and show the new failure rate is zero.
4. Re-run with **Server & Clients** if the bug touched replication.
5. Remove debug prints and breakpoints you added.

Don't publish to reproduce a live-only bug without asking the dev first.

## Finish checklist

- [ ] One-line bug statement and a reproduction that fails on demand
- [ ] Failing side (client or server), script and moment identified
- [ ] Cause written in one sentence, backed by a log, print or breakpoint
- [ ] Fix verified with the same reproduction, same number of runs
- [ ] Debug prints and breakpoints removed; the project's checks pass
- [ ] If it took more than one try, a traps entry was added to
      `<VAULTS>/Roblox Knowledge/rules/traps.md` in its format
