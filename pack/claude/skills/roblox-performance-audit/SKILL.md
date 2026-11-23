---
name: roblox-performance-audit
description: Use when a Roblox game is slow, stutters, lags, crashes on phones or loads slowly, or before a launch to check it fits low-end mobile, i.e. "why is it laggy", "FPS drops here", "it crashes on mobile", "audit performance". Measures first with the MicroProfiler, Developer Console and Scene Analysis (via the rbx-perf-profiling and rbx-scene-analysis skills), then fixes only what the numbers point at.
---

# Performance audit: measure, fix, measure again

No fix without a number before and after. Rules about meshes and triangle
counts live in `<VAULTS>/Roblox Knowledge/rules/map-checks.md`; code layout
lives in `rules/code.md`. Point at them, don't restate them.

## 1. Set the budget

1. Ask the dev for the lowest device they want to support. If they don't
   know, assume a low-end Android phone: most players are on one.
2. Write the budget: frame time (16.67 ms for 60 FPS, 33.33 ms for 30),
   client memory with headroom on that device, server heartbeat near 60,
   and a join time in seconds.
3. Find the device's limits by playing a heavy area on it with debug stats
   on, and write down draw calls and triangles where FPS starts to drop.
   Those become the scene budget.

Studio runs client and server on one PC, so its memory and FPS are skewed.
Use it to find causes; confirm numbers on a client, ideally the device.

## 2. Measure

Record each number with where and how it was taken.

- **Frame time**: MicroProfiler (Ctrl+F6, Cmd+F6 on Mac). Find spike frames
  in the bar graph, then the widest child task in the timeline. Orange bars
  point at scripts, physics or animation; blue and red at rendering. Wrap
  suspect code in `debug.profilebegin`/`debug.profileend` to label it. Use the
  `rbx-perf-profiling` skill to capture and read dumps through the Studio MCP.
- **Server**: Developer Console (F9), Server Jobs, Heartbeat steps per
  second; or a server MicroProfiler recording from the console. Server
  memory should stay under half its total.
- **Memory**: Developer Console Memory tab on the client. Look at
  GraphicsMeshParts, GraphicsTexture and Sounds under PlaceMemory first.
- **Scene**: the `rbx-scene-analysis` skill for instance counts, rendering
  cost and which instances own them, client and server.
- **Network**: Server Stats for data ping versus network ping; the
  MicroProfiler `ProcessPackets` scope for incoming remote cost.
- **Load**: a stopwatch from Play to first control, three runs, on the
  device. **Print Join Size Breakdown** in Studio's Network settings shows the
  biggest instances.

## 3. Fix what the numbers point at

Pick the single largest cost, fix it, re-measure, then the next.

- **Scripts**: move per-frame work to events; split long work across frames
  with `task.wait()`; `Disconnect` connections you no longer need; `Destroy`
  instances you are done with (it also drops their connections). Player and
  character objects aren't destroyed on leave by default, so clear their
  connections and any per-player table entries in `PlayerRemoving`.
- **Rendering**: reuse the same mesh and texture asset IDs so they batch;
  use `RenderFidelity` Automatic or Performance; turn off `CastShadow` on
  small or distant parts and `Shadows` on lights that don't need them; avoid
  partial transparency stacking.
- **Memory and load**: enable instance streaming for large worlds; keep in
  `ReplicatedStorage` only what clients need; prefer built-in materials over
  custom textures; remove duplicate assets.
- **Network**: send changes, not every frame; send the item, not the whole
  inventory; throttle input-driven remotes; tween and spawn effects on the
  client; strip leftover animation data from rigs.
- **Physics**: anchor what doesn't move; set `CollisionFidelity` to Box or
  Hull on small or non-interactive meshes; keep adaptive physics stepping.

Turning on streaming, changing graphics or game settings, or buying extra
server compute changes things outside the code: ask the dev first.

## 4. Verify

1. Re-take every number from step 2 the same way, on the same device.
2. Put before, after and budget side by side in one table.
3. For long sessions, play 10 to 15 minutes on the phone and check frame time
   doesn't climb (thermal throttling) and memory doesn't keep growing (leak).

## Finish checklist

- [ ] Budget written: device, frame time, memory, heartbeat, join time
- [ ] Every fix has a before and after number from the same tool and device
- [ ] Largest MicroProfiler cost named, with its scope label
- [ ] Memory checked on a client, not only in Studio
- [ ] Remote traffic checked for per-frame or oversized sends
- [ ] Long-session run shows no climbing frame time or memory
- [ ] Settings changes, streaming or paid compute were approved by the dev
