---
name: roblox-worldbuilding
description: Use when a Roblox dev wants a map or area to read as designed rather than scattered, i.e. "lay out this level", "the map feels empty", "where should the landmarks go", "props are floating", or "make players find their way". Plans landmarks, paths, sightlines and prop density, then checks the build in Studio. Works alongside the roblox-map skill if it is installed.
---

# Worldbuilding: maps that read as designed

A designed map tells the player where to go without a sign. You plan the
big shapes first, then paths, then props, then check what is actually in
Studio. Rules on map checks and game design live in the Roblox Knowledge
vault at `<VAULTS>/Roblox Knowledge/rules/` (`map-checks.md`,
`game-design.md`). Read those; don't restate them to the dev.

If the `roblox-map` skill is installed, it owns map generation and layout
tooling. Use it for that and use this skill for the design pass and checks.

## When to use it

- A new area needs a layout before anything is built.
- An existing area feels empty, cluttered or confusing.
- Props float, clip or block paths.

## Steps

1. **Ask the purpose.** What does the player do here, and where do they
   enter and leave? One line each. Don't guess a genre.
2. **Pick landmarks.** One main landmark visible from every entrance, and
   one smaller one per sub-area. Write them down as a short list with
   rough positions before placing anything.
3. **Draw paths.** Connect entrances to landmarks with a main path, then
   side paths to optional spots. Every dead end should hold a reward or a
   view. Keep the main path wide enough for two characters side by side.
4. **Check sightlines.** From each entrance, the next goal or landmark
   should be in view. Use the Studio MCP to stand a camera at the entrance
   and take a screenshot. If a wall or prop hides the goal, move the prop,
   not the goal.
5. **Dress by density.** Dense near paths and landmarks, sparse in the
   open. Cluster props in groups of three to five rather than spreading
   singles evenly. If the Greeble skill is installed, use it to dress
   zones instead of placing props by hand.
6. **Ground every prop.** For each prop model, cast a short ray down from
   its bounding box (`Model:GetBoundingBox`, then
   `workspace:Raycast(origin, direction, params)`). A prop whose base sits
   more than a small gap above the hit point is floating. Report the list
   to the dev; fix only what they approve.
7. **Clear the paths.** Use `workspace:GetPartBoundsInBox(cframe, size,
   overlapParams)` along each path to find props that block it.
8. **Report.** Two or three lines: landmarks, paths, anything still off.

## Reading the build

- Use the Studio MCP to inspect the tree and run read-only Luau for the
  checks above. Read-only first: list problems before moving anything.
- Set `Anchored` on static props. Unanchored decoration falls or drifts.
- Small decoration that players don't stand on can have `CanCollide` and
  `CanTouch` off so it doesn't snag movement.

## Ask first

- Moving, deleting or regenerating anything the dev already built.
- Inserting assets from the Toolbox or Creator Store, or anything that
  spends Robux or publishes the place.

## Finish checklist

- [ ] Purpose, entrances and exits confirmed with the dev
- [ ] One main landmark visible from every entrance (screenshot taken)
- [ ] Every path connects; no empty dead ends
- [ ] No floating props; no props blocking a main path
- [ ] Static props anchored
- [ ] Vault `map-checks.md` reviewed against the build
- [ ] Dev told what changed and what is left, in a few lines
