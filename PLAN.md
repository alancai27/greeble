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
| pack | `pack/`, `site/` | Door 1 installer, Roblox rules and skills, project template; later the one-page site |

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
- Hosting account and domain before milestone 4.
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

1. `site/` (share a repo link and a clip instead).
2. Team seats.
3. Door 2, if model cost per active user is above what a plan can charge.

## Decisions

- 2026-11-21: Plugin is a thin client; all logic and style data on the server.
- 2026-11-21: Greeble uses a studio's own assets; it does not generate meshes.
- 2026-11-22: Two doors on one backend; all Studio actions are jobs.
- 2026-11-22: First buyers are devs without an AI setup, reached through the team's contacts.
- 2026-11-22: We do not train generation models. Hosted tools may wrap existing image and mesh models once licences are checked (replaces the earlier "generation out of scope").
- 2026-11-22: The pack starts from Matt's workflow brief, Windows first.
