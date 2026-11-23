# Plan: Greeble

Leads only. Written by the human with Claude on 2026-11-22. The planning lead
keeps the areas, milestones and decisions here, writes `docs/contracts.md`
from `docs/contract-draft.md`, and creates issues for milestone 1 only.

## How the system fits together

    Studio plugin  <-- jobs (poll) -->  server  <-- MCP -->  dev's own agent   (Door 1)
         |                                 ^
         +-- chat panel --> hosted agent --+                                   (Door 2)

- Every action in Studio is a job. A door queues it; the plugin, in Listen
  mode, runs it and reports back. Map data goes plugin -> server directly and
  never through a model.
- The hosted agent and a dev's own agent call the same tools.
- Each request carries a studio key. All data is scoped to that key.

## Areas

| Area | Paths it owns | Purpose |
|------|---------------|---------|
| platform | `server/` | API, keys and accounts, job queue, MCP endpoint, placement and profiles, usage metering |
| studio | `plugin/` | Studio plugin: dress, Listen mode, profile learning from a selected map, chat panel |
| agent | `agent/` | Hosted agent for Door 2: prompts, Roblox rules, model calls, tool use, cost limits. A library the server imports |
| pack | `pack/` | Door 1 installer, Roblox rules and skills, project template |
| site | `site/` | The public website. Depends on nothing else, so it runs alongside milestone 1 |

`docs/` belongs to the planning lead. Contract changes follow `agents/lead.md`.

## Milestones

| # | What works end to end | How we check it |
|---|-----------------------|-----------------|
| 1 | In Studio, select a finished map, learn its profile, press Dress on a blocked-out zone, get editable instances with undo | Human runs it in Studio on a test place, then on Matt's map |
| 2 | Door 1: Claude Code with the pack installed dresses a zone through MCP while the plugin listens | Human runs `claude` in a test project and watches Studio |
| 3 | Door 2: chat panel in Studio sends a request, hosted agent answers and can queue a dress job; per-key spend cap enforced | Human uses the panel; a test proves the cap stops a run |
| 4 | Six-dev test: server deployed, keys issued by a script, usage logged per key, free trial limit with upgrade message | A second machine installs and runs both doors against the deployed server |
| 5 | Paid: checkout unlocks a key's plan; studio owner invites seats | Test-mode payment flips a key from free to paid |

### Milestone 1 detail (the only one to write issues for now)

- platform: `/v1/profile` accepts instances grouped by zone label; profile
  stored per key instead of in the plugin; placement honours surface normal
  (no assets on steep slopes); request validation with clear errors.
- studio: "Learn style" button that reads a selected Folder or Model and
  posts instances; kit read from a configurable folder; settings widget for
  URL and key instead of command-bar calls; errors shown in a widget.
- pack: nothing yet. agent: nothing yet.
- site: build to the "Site" section below, starting with the hero prototype.
- The plugin cannot be tested by agents without Studio. Every studio issue
  must end with a short manual test script for the human in the pull request.

### Later milestones, in brief

- 2: pack built from `pack/source/workflow-brief.md` (Matt's working setup):
  an installer that does what the brief describes, Windows first, plus the
  MCP entry with the dev's key; only our own skills, rules, hooks and vault
  templates ship in it (see "Pack source" below); `greeble_learn_profile`
  tool; real-client MCP test.
- 2b: hosted asset tools, so a dev needs no Cloudflare or Hugging Face keys:
  `greeble_image` and `greeble_mesh` wrap existing models behind our key
  check and per-key limits. Blocked until the licence check is done.
- 3: `agent/` loop with tool calling; chat widget; token and cost accounting
  per key; hard cap; prompts and rules never sent to the client.
- 4: deploy target chosen by the human; persistent storage for keys, jobs,
  profiles and usage (jobs are in memory today); trial limits.
- 5: checkout webhook; seats; shared studio rules and profiles.

## Site

One scrolling page. The scroll tells the product's story: a bare block of
ground gets detailed into a world, which is what Greeble does to a map.

Story, top to bottom:

1. Hero. White background, the wordmark, one line of copy, an install
   button. A small blocky figure hangs from one letter of the title by a
   string and sways slightly.
2. The drop. As the user scrolls, the string snaps and the figure falls,
   tied to scroll position. It lands on a flat strip of ground at the top of
   the next section, with a squash on impact.
3. First world. As the user keeps scrolling, that strip grows into a full
   world: terrain rises, then props, foliage and lighting arrive in layers.
   The copy here explains map dressing.
4. More worlds. Each later section is a different, vivid world with its own
   palette and biome (for example desert, neon city, snow, candy), and the
   figure walks or drops from one into the next. One section each for: the
   pack and workflow, the hosted tools, pricing and install.
5. Footer on white again.

Rules for building it:

- The figure and every world are original art. Do not use Roblox's avatar,
  logo, typeface or any real game's assets, and don't imply Roblox endorses
  us. The human checks Roblox's brand guidelines before launch.
- All copy is real text in the page, readable with scripts off and by screen
  readers. The animation decorates the page; it never gates content.
- The page snaps from section to section with CSS scroll snap. No script
  takes over the scroll wheel or touch.
- Honour `prefers-reduced-motion` with static illustrations per section.
- Must run smoothly on a mid-range phone. The figure and worlds are real 3D
  (WebGL, `three`) in one fixed canvas behind the copy, driven by scroll
  position. Without WebGL the copy still shows on plain backgrounds.
- No dependencies beyond the framework and `three` unless an issue names one.
- First issue: use the `prototype` skill for three structurally different
  takes on the hero and drop, then escalate the choice to the human. Use the
  `frontend-design` skill for art direction, and `webapp-testing` to check
  each section at phone and desktop sizes.
- Copy placeholders are fine until pricing and the name's tagline are set.

Checks: a phone-sized and a desktop-sized run show every section's copy; the
drop lands on the ground at any scroll speed, forwards and backwards;
reduced-motion mode shows no movement; no console errors.

## Pack source

`pack/source/workflow-brief.md` is the setup Matt runs today. Leads read it;
workers get only the section their issue pastes in. Sort every part into:

- Ours, ship it: the Roblox Knowledge vault rules, the "extra skills" in its
  section 6, hooks, slash commands, vault templates, doctor and secrets scripts.
- Third party, install from the official source and never copy: the base
  skill pack in its section 4, graphify, gbrain, Rojo and the other tools.
- Hosted by us: image and mesh generation, placement.

The brief tells an agent to take full control of the PC and suggests bypass
permissions. The installer must ask before each of those and default to off.

## Needs the human

- Matt's files: one finished map and its asset kit as a Studio file; his
  agent config, rules and skills for the pack.
- Running every Studio-facing change in Studio.
- A commercial model API key before milestone 3; a spend limit on it.
- Hosting account and domain before milestone 4 (the site can deploy earlier).
- The site's wordmark, tagline and final copy; picking the hero prototype.
- Payment account owner before milestone 5.
- Licence check before the pack installs any third-party tool; install from
  official sources, never redistribute copies. First: who owns the base skill
  pack in section 4 of the brief, and may it be used in a paid product.
- Terms check before hosting generation: the image and mesh models' licences
  and each provider's rules on serving other people's requests.
- Talking to the six test developers and collecting what they ask for.

## Open questions (human decides; don't guess)

1. Which specialized tool comes second. Wait for what test devs fail at.
2. Pricing and trial size.
3. Whether Door 2 is worth its model cost once numbers exist from milestone 3.

## Cut list

1. Any site world beyond the first two.
2. Team seats.
3. Door 2, if model cost per active user is above what a plan can charge.

## Decisions

- 2026-11-21: Plugin is a thin client; all logic and style data on the server.
- 2026-11-21: Greeble uses a studio's own assets; it does not generate meshes.
- 2026-11-22: Two doors on one backend; all Studio actions are jobs.
- 2026-11-22: First buyers are devs without an AI setup, reached through the team's contacts.
- 2026-11-22: We do not train generation models. Hosted tools may wrap existing image and mesh models once licences are checked (replaces the earlier "generation out of scope").
- 2026-11-22: The pack starts from Matt's workflow brief, Windows first.
- 2026-11-22: The site is in scope now, as its own area, with a scroll story of a figure falling into worlds that build themselves.
- 2026-11-23: Profiles are stored on the server per key and per zone label; `/v1/place` no longer takes a profile. A zone with no label uses "default".
- 2026-11-23: Slope limit is one number per request (`maxSlopeDeg`, default 35), not per asset.
- 2026-11-23: The plugin stays one file until the human decides on a Rojo build, so studio issues run one at a time.
- 2026-11-23: The site is static HTML with Vite and TypeScript, no UI framework.
- 2026-11-23: Site hero is layout A (Poster). B and C are dropped.
- 2026-11-23: The figure is a Roblox-style blocky character and the worlds are Roblox-style, built from bricks with studs (human's call). We draw them ourselves: still no Roblox logo, typeface or copied assets, and the brand-guideline check before launch still applies.
- 2026-11-23: The site is real 3D throughout (human's call): a 3D blocky character in the classic Roblox build and 3D studded worlds, using `three`. This takes 3D off the cut list and drops the 2D SVG hero and world. We model everything ourselves; no Roblox logo, typeface, face decal or copied mesh.
- 2026-11-23: Site sections snap (CSS scroll snap), replacing "no scroll hijacking" (human's call). The figure falls out of the hero and lands in the next section, where the world then grows.
- 2026-11-23: Site gets a simple logo mark: favicon and fixed top-right. Hero title drops to a lighter weight.
