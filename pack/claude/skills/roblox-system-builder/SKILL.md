---
name: roblox-system-builder
description: Use when a Roblox dev wants a whole custom system built end to end, i.e. "make a shop", "add a quest system", "build daily rewards" or "add an inventory". Plans and builds config, server, client, remotes, saving, UI and tests in that order, then checks it in a play test.
---

# Roblox system builder

Build one gameplay system from data to screen. The server owns the truth;
the client only asks and shows. Finish each layer before starting the next.

## Before you start

- Read the vault rules that apply, and follow them instead of guessing:
  `<VAULTS>/Roblox Knowledge/rules/code.md` always, plus `ui.md`,
  `monetization.md`, `reward-juice.md` or `game-design.md` when the system
  touches those areas.
- Ask the dev for anything you can't infer: what the player does, what is
  saved, what it costs, and how they'll know it worked.
- Ask before anything that publishes, spends Robux, creates products or
  passes, installs a plugin or changes game settings. Editing the place is fine.

## Steps

1. **Name it and sketch it.** Pick one short system name, e.g. `Shop`. Write
   the dev a five-line plan: data, server actions, client view, what saves,
   how it's tested. Get a yes before building.
2. **Config.** One ModuleScript in `ReplicatedStorage/<Name>/Config` holding
   only data: items, prices, cooldowns, limits. No logic. Both sides read it,
   so never put secrets or server-only values here.
3. **Remotes.** Create them in one place, `ReplicatedStorage/<Name>/Remotes`.
   Use a RemoteEvent for actions and a RemoteFunction only when the client
   truly needs an answer. Use an UnreliableRemoteEvent only for cosmetic,
   frequent updates: it may drop or reorder events and drops payloads over
   1000 bytes.
4. **Server.** A Script in `ServerScriptService/<Name>`. Every remote handler
   treats its arguments as hostile: check types, ranges, ownership, distance
   and cooldown, then act. The server decides prices and rewards from Config,
   never from what the client sent.
5. **Saving.** Use DataStoreService with one key per player. Write with
   `UpdateAsync`: its callback gets the current value, must not yield, and
   returning nil cancels the write. Load on join, save on leave and on a timer,
   and in `game:BindToClose`, which gets about 30 seconds before shutdown.
   Wrap every call in `pcall` and retry with backoff. Keep the saved table
   small; one key holds about 4 MB of JSON at most.
6. **Client.** A LocalScript under `StarterPlayerScripts` that listens to
   remotes, keeps a local copy of the state for display, and sends requests.
   It never decides an outcome.
7. **UI.** Build the screens the plan named. Then run the `roblox-ui-review`
   skill on them.
8. **Tests.** Put pure logic (pricing, cooldowns, reward rolls) in
   ModuleScripts so it can be tested without a player. Write unit tests for
   it; the `rbx-unit-test` skill covers how, if it is installed.
9. **Play test.** Start a play session through the Studio MCP. Do the main
   action, leave, rejoin and confirm the state came back. Try one bad request
   (wrong price, spam, far away) and confirm the server refused it. Read the
   output for errors.
10. **Report.** Tell the dev in a few lines what exists, where it lives, and
    anything you couldn't check.

## Finish checklist

- [ ] Config, Remotes, server Script and client LocalScript exist under the
      system's name, and nothing else of it is scattered elsewhere.
- [ ] Every remote handler validates its input on the server.
- [ ] No price, reward or result is taken from the client.
- [ ] Data loads on join and saves on leave, on a timer and on close, each
      inside `pcall`.
- [ ] Rejoining in a play test restores the state.
- [ ] Unit tests cover the pure logic and pass.
- [ ] The UI passed `roblox-ui-review`.
- [ ] The output showed no errors or warnings from this system.
- [ ] Nothing was published, bought or installed without the dev's yes.
