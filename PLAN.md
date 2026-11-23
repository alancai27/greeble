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

1. Team seats.
2. Door 2, if model cost per active user is above what a plan can charge.

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
- 2026-11-23: Every site section gets its own 3D world (meadow, desert, neon, snow) from one themed builder; between sections the plate turns 90 degrees and rebuilds in the new theme, and the world alternates sides with the copy (human's call). This takes "worlds beyond the first two" off the cut list.
- 2026-11-23: Site: the figure appears only in the hero and first world; the footer is a strip on the last section; all worlds sit on the right with copy on the left (no alternating); sections carry real copy, demo-video slots and three pricing tier cards (Trial, Solo, Studio) with prices left as "coming soon" until the human sets them.
- 2026-11-23: Studio's built-in MCP server is connected on the human's machine as `Roblox_Studio` (user scope), so agents can run plugin tests in Studio themselves (human's call). This replaces "the plugin cannot be tested by agents without Studio": studio issues now require the worker to run the test in Studio and say so in the pull request. One Studio session is shared, so only one agent uses it at a time, and only on a test place, never Matt's map. The human still judges how a result looks.
- 2026-11-23: The plugin has a hidden test hook (`GreebleTestHook`, a BindableFunction in CoreGui) that calls the same functions as its buttons, because agents cannot click plugin buttons in Edit mode. Studio issues are tested through it.
- 2026-11-23: A changed plugin build is loaded into Studio without a restart by the dev loader in `plugin/DEV.md`. It needs `localhost:8787` in Studio's Assistant MCP internet allowlist, which only the human can add.
- 2026-11-23: Milestone 1 passes in Studio on a test place and the human judged the dressed zone good. It still needs one run on Matt's map and kit. Milestone 2 issues are written (human's go-ahead).
- 2026-11-23: Learning from an agent is a job like dressing: `greeble_learn_profile { path, label? }` queues a `learn_profile` job that the plugin runs in Listen mode. Map data still never passes through a model.
- 2026-11-23: The dev's agent reads its key from the `GREEBLE_KEY` environment variable through the MCP entry's header; the key is never written into a config file or the pack.
- 2026-11-23: Pack layout is in `docs/contracts.md`. Workers on pack issues may read only the line range of `pack/source/workflow-brief.md` their issue names, since a section is too long to paste.
- 2026-11-23: The planning lead leads platform. Pack has no lead until the human starts one.
- 2026-11-23: The pack installer targets macOS first (human's call), replacing "Windows first". It is a shell script tested on the human's Mac; the PowerShell versions of the installer and the Luau hook wait until a Windows user needs them. The pack lead is running.
- 2026-11-23: On macOS the dev's key is stored in `$HOME/.greeble/env` (mode 600), sourced from `~/.zshrc` after the installer asks (pack lead's choice, accepted). A plain file, as other developer tools do; the Keychain can replace it later if a studio asks.
- 2026-11-23: Pack layout gains `pack/claude/agents/<name>.md`, installed to `<CLAUDE>/agents/`, for the brief's three agents (pack lead's request).
- 2026-11-23: Door 1 end to end ran with a real Claude Code client (#88): learn and the Listen-off message pass; dress failed on a label mismatch the skill caused. Fixes: the skill passes a label only when the dev names one or the zone has it; the no-profile error names the label looked up and the learned labels. No fallback to "the only learned style", since it would hide mislabelled zones.
- 2026-11-23: Dressing a zone again replaces that zone's earlier result inside the same undo step (studio lead's choice, accepted).
- 2026-11-23: Pack layout gains `pack/vaults/_tools/`, installed to `<VAULTS>/_tools/` (pack lead's request). The brief's "Full PC access" rules are left out of the pack until the human decides whether to offer them as a default-no question.
- 2026-11-23: The brief's "Full PC access" rules ship as an opt-in (human's call): the installer asks a separate question, default no, and says plainly what yes allows. It never changes the permission mode. This replaces the line above that left them out.
- 2026-11-23: Door 1 passes end to end with a real Claude Code client on unlabelled and labelled zones (#127). Milestone 2 now needs the human's own run with the pack installed.
- 2026-11-23: `PlaceStats` gains `label`, the label whose style was actually used, so an agent can tell the dev when a labelled zone fell back to the default style.
- 2026-11-23: Until Matt's files arrive, milestone 1's real-map check runs on a public map with its own public kit from the Creator Store (human's call). Prefer assets published by Roblox itself; record each asset's id and creator. The brief's first "good" test, Matt shipping a zone of his own game, still stands for later.
- 2026-11-23: First run on a real public map (a Creator Store pine forest, #137) placed only 25 props, with several overhanging the zone, path and slope. Rulings: the placer treats each prop as a circle of its footprint and keeps the whole circle inside the zone, off keep-clear boxes and off steep ground; an asset too large for the zone is left out and reported; Learn matches by name and shape and takes scale from the size ratio, so one generic name ("Model") can no longer stand for many different props. Milestone 1 is not met on a real map until a re-run looks right.
- 2026-11-23: Measured the pine-forest run (#146): the placer met 14 of 15 targets; the targets were wrong. Density was divided by the map's bounding box (720k sq studs) when props occupy half of it, and 70% of the forest's footprint is 39 multi-tree clumps that non-touching circles cannot fit. Rulings: learned area comes from occupied grid cells; spacing between props follows the map's own nearest-neighbour distances (new `clearance` per asset), not footprints; footprint is half the XZ diagonal; an asset is "too large" only when it cannot fit the zone at all. Lesson logged: measure before ordering a placement fix.
