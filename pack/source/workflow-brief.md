# Brief: set up an AI workflow for making Roblox games with Claude Code

Give this whole file to Claude Code (desktop app or CLI) on your own Windows PC and say: **"Set this up for me, following the brief."** It installs and writes everything below, then checks it all works.

**For the agent:** this brief is portable. Never assume a username, drive or folder. Ask the owner once for the folders in "0. Placeholders", or use the defaults shown. Then always build paths from `$HOME` and those answers. Never hard-code a path.

---

## 0. Placeholders (ask once, then reuse)

| Placeholder | Meaning | Default |
|---|---|---|
| `<CLAUDE>` | Claude Code config folder | `$HOME\.claude` |
| `<VAULTS>` | where the Obsidian vaults live | `$HOME\Documents\Obsidian` |
| `<GAMES>` | where game code projects live | `$HOME\RobloxGames` |
| `<LIBS>` | private libraries the owner harvests (VFX, sounds) | `$HOME\RobloxLibraries` |
| `<OWNER>` | what to call the owner in rule files | ask |

Save the answers as user env vars: `ROBLOX_GAMES_HOME=<GAMES>`, `ROBLOX_VAULTS=<VAULTS>`, `ROBLOX_VFX_LIB=<LIBS>\vfx`, `ROBLOX_SKILLS_DIR=<CLAUDE>\skills`.

---

## 1. How the workflow works

- **Claude Code is the brain.** It runs on the PC, so it can run Python, Blender, Rojo and Roblox Studio itself, and test code before Studio opens. Use Opus for long, many-part jobs.
- **Every discipline gets its own skill and its own way of checking its own work:** code, UI, map, 3D models, textures, VFX, sound and animation. Most AI-made games look the same because one AI writes everything as code. This setup avoids that.
- **Obsidian vaults are the memory**, built on ICM (Interpretable Context Methodology): folders carry context and files carry state. Each vault has a `CLAUDE.md` route table, so Claude loads only the folder it needs.
  - One vault per game: its rules, decisions, changelog, config, remotes and asset registry.
  - One shared **Roblox Knowledge** vault: general rules and a "traps" log, written once and used by every game.
- **Graphify** maps each game's code into a knowledge graph, so Claude asks the graph instead of grepping. **GBrain** is cross-session memory (an MCP server).
- **A manager skill, `create-roblox-game`**, runs one stage per session (research and plan → code → art, animation and sound → playtest → publish). It writes a `HANDOFF.md`, so the chat can be cleared after each approved stage.
- **MCP servers** let Claude drive Roblox Studio (edit, run Luau, screenshot, playtest), Blender and Figma.
- **APIs** take jobs Claude is wrong for:
  - Cloudflare Workers AI with Flux Schnell for images and icons (free tier)
  - Hi3DGen (MIT) for image → 3D mesh, through a Hugging Face Space
  - Roblox Open Cloud for uploads
- **Secrets never go in the chat.** Keys are user env vars set from the owner's own terminal by a prompt script. Skills read them from the environment.

---

## 2. Install the tools

Write `install-tools.ps1`. It checks each tool and installs only what is missing (winget, scoop, pip, bun or rokit). Reload PATH from the registry (Machine + User) at the top of the script and after each install.

| Tool | Version to aim for | Used for |
|---|---|---|
| Python | 3.13 | skill scripts |
| Rokit | latest | pins the Roblox toolchain per project |
| Rojo | 7.6+ | files ↔ Studio sync, build check |
| Wally | 0.3+ | Luau packages (Knit) |
| Lune | 0.11+ | runs Luau tests with no Studio |
| Selene | 0.32+ | Luau linter |
| StyLua | 2.6+ | Luau formatter |
| Blender | 4.4 + its MCP add-on | decimate, UV, bake, animation, headless |
| graphify | latest | code → knowledge graph CLI (check the package name on PyPI) |
| gbrain | latest | memory MCP server (GitHub `garrytan/gbrain`, install with bun) |
| Bun, Node, npm | current LTS | gbrain, Figma bridge |
| Git + GitHub CLI | latest | a repo per game |
| Obsidian | latest | browsing the vaults |
| Roblox Studio | latest | the game |

Rokit setup:
1. `rokit trust <owner/tool>` before `rokit add`.
2. Add each tool globally (`rokit add --global ...`).
3. Keep a `rokit.toml` in every project.

---

## 3. MCP servers

Add these to Claude Code's user MCP config, with paths built from `$HOME` / `%LOCALAPPDATA%`:

| Name | How |
|---|---|
| `Roblox_Studio` | Built into Studio: Assistant → Manage MCP servers → enable. The launcher is `%LOCALAPPDATA%\Roblox\mcp.bat`. It ships its own Roblox skills, listed with `list_roblox_skills`. |
| `gbrain` | `gbrain serve --surface full`, starting with a fresh, empty brain |
| `figma-bridge` | Figma MCP bridge from npm plus its Figma plugin. It reads designs; it is only useful if a human designs in Figma first. |
| Blender | Blender's MCP add-on enabled in Blender preferences |

---

## 4. Get the base skill pack

It installs these skills and agents into `<CLAUDE>\skills` and `<CLAUDE>\agents`:

| Skill | Job |
|---|---|
| `create-roblox-game` | The front door and manager. One stage per session, with HANDOFF.md. Scripts open, close and restart Studio, start and stop multi-client playtests, check that files and Studio are in sync, recover a dropped MCP, and scaffold a new game. |
| `roblox-build-orchestrator` | A timed, logged full build. Fans asset stages out to subagents and keeps every Studio write on one thread. Has a 30-minute stall rule, a ledger and a "debts" gate so a run can't end with known defects. |
| `roblox-code` | Rojo + Wally + Knit project. Server-authoritative, every tunable in Config, pure Core modules with headless specs, four gates (below). |
| `roblox-map` | Headless greybox and terrain from a JSON spec, plus a reachability prover. |
| `roblox-3d-model` | Text → Flux concept → Hi3DGen mesh → headless Blender cleanup → procedural paint → EditableMesh (no upload) or an Open Cloud upload. |
| `roblox-animation` | R15/R6 animation from a JSON pose spec in headless Blender, judged from contact sheets and GIFs. |
| `roblox-ui` | A JSON spec → PNG mockup + Rojo `.model.json` + Luau builder from one tree, plus icon generation. |
| `roblox-vfx` | Harvests VFX packs the owner took into their account into JSON recipes, then a VFXKit runtime. |
| `roblox-sfx` | Finds Creator Store audio by ID and proves it loads in Studio, then emits a SoundBank and an Sfx helper. |
| `roblox-texture-gen` | AI textures applied through the Studio MCP. |
| `roblox-skills-setup` | Checks the machine, writes each skill's `LOCAL.md`, runs a smoke test. **Run it right after install.** |

Agents: `roblox-asset-anim`, `-map`, `-mesh`, `-sfx`, `-ui`, `-vfx`, `roblox-market-scout`.

Patch these known problems after installing:
- The 3D skill's Kaggle GPU route is off; use the Hugging Face Space route.
- `studio_test.ps1` must accept a Studio window title that has an open tab in it (`Place.rbxl - <Tab> - Roblox Studio`).
- The Cloudflare env var names must match between the scripts and the setup notes: pick `CF_ACCOUNT_ID` / `CF_API_TOKEN`.

---

## 5. Write the memory system

### 5a. Global `CLAUDE.md` (in `<CLAUDE>`)

Write these rules, in this wording or close to it:

```
## Projects
- When <OWNER> starts a new project, use the `new-project` skill first: an ICM vault, a Graphify map and a GBrain source. Ask only for the name and the code path.
- In any project with a vault at <VAULTS>\<Name>: read its CLAUDE.md first, load only the folder it routes you to, log finished work to changelog/ and choices to decisions/, and run `graphify query` before grepping code.
- For Roblox games use the `create-roblox-game` skill. Roblox rules and facts live once in <VAULTS>\Roblox Knowledge; read its CLAUDE.md first.
- Before any Roblox task, call the Studio MCP's list_roblox_skills and load every skill that fits. Base API claims on current Roblox docs, not memory.
- Precedence: the game's vault (rules/, decisions/) > Roblox Knowledge > general knowledge. <OWNER>'s own decisions always win.

## Full PC access for Roblox work
Do it yourself; never ask <OWNER> to:
- open, close or restart Roblox Studio (create-roblox-game scripts), then confirm with the Studio MCP
- start or stop playtests
- start rojo serve, Blender, Obsidian or any tool the work needs; install missing tools
- save the place to a file before risky work
Stop and ask only for: anything that spends Robux or money, publishing to a live game, deleting <OWNER>'s work, or a login only <OWNER> can pass.

## Secrets
Never ask for a key in chat. Point <OWNER> to set-secrets.ps1.
```

### 5b. Vault templates (`<VAULTS>\_templates\`)

**`project-vault\`** contains:
- `CLAUDE.md`: a route table of "if asked X, go to folder Y, stop at Z", plus "load only what you are routed to"
- `CONTEXT.md`
- `changelog\`: one entry per finished piece of work
- `decisions\`: one card per choice, with its why
- `rules\`: stable rules with their reason
- `_graph\`: Graphify output
- `_templates\`: `changelog-entry.md`, `decision.md`, `rule.md`
- `.obsidian\` with core plugins and templates turned on

**`roblox-vault\`** is the same, plus:
- `config.md`: the tunables and where they live in code
- `remotes.md`: every remote name, its direction and its validation
- `assets\registry.json`: every asset ID, its source and its licence
- an art style guide with reference screenshots

### 5c. `new-project-vault.ps1` (`<VAULTS>\_tools\`)

Parameters: `-Name`, `-CodePath` (optional) and `-Kind project|roblox`. It:
1. Copies the matching template to `<VAULTS>\<Name>`.
2. Builds the code map: `graphify extract <code> --code-only --out <vault>\_graph`, then `graphify cluster-only <vault>\_graph --no-label`.
3. Creates a GBrain source for the vault. If the brain is held by the running session, it prints the command to run later instead of failing.
4. For `roblox`, runs `git init` in the code folder and adds a Roblox `.gitignore`.

Write files as UTF-8 **without** a BOM (`[IO.File]::WriteAllText` with `UTF8Encoding $false`).

### 5d. Skills to write (`<CLAUDE>\skills\`)

- **`new-project`**: runs the script above with no questions beyond the name and code path. For Roblox it hands off to `create-roblox-game`. It then tells the owner to open the vault once in Obsidian (Manage vaults → Open folder as vault) and works token-efficiently: read the vault's CLAUDE.md, query the graph, log to changelog and decisions, refresh the graph after big changes.
- **`icm-architect`**: designs or restructures any folder, repo or notes pile into an ICM workspace (a route-table CLAUDE.md, CONTEXT.md per folder, one home per fact). Use the open-source MIT one if you can find it (author Jake Van Clief); otherwise write it.
- **`graphify`**: wraps the graphify CLI (extract, cluster, query, path, explain). When a `graphify-out/` folder exists, a codebase question goes to the graph first.

### 5e. The Roblox Knowledge vault (`<VAULTS>\Roblox Knowledge\`)

Folders: `workflow\`, `rules\`, `setup\`, plus a `CLAUDE.md` route table. Write these files with this content.

**`workflow/overview.md`**: section 1 of this brief.

**`workflow/model-pipeline.md`**
1. Flux image; Claude looks and regenerates until it's good.
2. Hi3DGen mesh; check it from every angle.
3. Headless Blender decimate from ~1M triangles to 6–10k. Roblox's limit is 20k per mesh.
4. Bake a normal map from high-poly to low-poly; paint colour from a small spec.
5. Build hard-edged props (crates, guns) directly in Blender.
6. Upload with Open Cloud as a Model (`.glb`/`.fbx`, max 20 MB).

Before import, check triangle count, scale, pivot and texture.

**`rules/code.md`**
- Play mode can't be watched; only the output log comes back. So make as much as possible checkable while it sits still.
- Game rules are plain Luau numbers with no Roblox objects, so they can be tested on the PC.
- Four gates before Studio sees anything: `rojo build`, Lune tests, Selene, StyLua. An empty new project must pass all four first.
- Code lives in files and is never typed into Studio.
- One config folder holds every tunable.
- One file declares every remote.

**`rules/ui.md`**
- One spec produces three outputs (preview, UI file, builder), so they can't drift apart.
- Every panel and button gets a depth stack: a slightly blue shadow, a gradient face, a top highlight, and one outline thickness everywhere. Mixed outline thickness is the biggest AI-UI giveaway.
- No emoji; icons are generated.
- Check at four screen sizes: thumb-sized buttons, nothing touching, centred items within 1.5 px, readable text size, no stray boxes.
- Build with plain Roblox UI instances plus client controllers, not Fusion: Claude can inspect and fix them through the MCP.
- Each game keeps a style guide and reference screenshots.
- Responsive layout, safe areas and motion are covered by the `roblox-ui-review` skill.

**`rules/vfx.md`**
- Collect effects; don't invent them. Harvest packs, classify them (ball, flame, beam, trail, light), then combine blocks.
- Phase-freeze to check: fire the effect, freeze it, and judge the start, middle and end together.
- Keep the harvested library private.

**`rules/sound.md`**: Open Cloud audio uploads are rate-limited. Keep a classified library by name, combine existing sounds, and upload only the final ones.

**`rules/animation.md`**
- Poses are data, turned into animation in Blender on an R15 rig.
- Render a contact sheet and judge it.
- Learn from real Roblox animations.
- Log every fix as a trap.

**`rules/map-checks.md`**
- Every number comes from the game's own config (jump height, walk speed), and every guess is listed in the report.
- Nine raycast checks: floating platforms, tops you can't stand on, unreachable high ground, reachable-but-shouldn't, fall pockets with no way out, sightlines too open or closed, overlapping parts, unevenly spaced rings, falls shorter than ragdoll recovery.
- Parts alone look AI-made, so use meshes.
- 20k triangles max per mesh.

**`rules/game-design.md`**: lessons from devs who shipped viral games.
- First 90 seconds:
  - funnel every onboarding step
  - the title and thumbnail match the real loop
  - zero friction (auto-equip)
  - pre-load starter items
  - a big "wow" on the first core action
  - teach one loop, then set them free
  - later lessons fire on triggers
- Progression:
  - never wing it
  - test on a fresh alt account and time each milestone
  - funnel every milestone
  - paid tester grinds
- Testing:
  - testers before launch
  - a published test place
  - an in-game feedback prompt
  - let testers try to break the economy
- One art style guide before any asset is made.
- Simulators die in about a month without depth.

**`rules/monetization.md`**
- The shop tempts a buy on open (starter pack, "best value" tag, glints).
- Monetized items are visible in the world.
- Fix the mobile shop UX.
- A sub-10-Robux entry item, then stacked cheap tiers.
- Repeatable consumables.
- Whale limiteds from day one.
- Make the most overpowered consumable scarce.
- When a player clicks something they can't afford, prompt the smallest cash pack that covers it, then auto-buy the item.
- Never make products overpowered, and price cash packs so progression never becomes trivial.
- Follow Roblox's current rules for paid random items and odds disclosure.

**`rules/reward-juice.md`**: every reward moment gets seven beats in order:
1. wobble and squash
2. stretch
3. slam with hit-stop and camera shake
4. inner light with slow rays
5. a shockwave ring
6. stars that pop
7. floating magic dust

Phase-freeze at the anticipation, the slam and the dust. Watch out: `LightEmission = 1` washes out pale scenes.

**`rules/traps.md`**: one entry per fix (date, what broke, fix, reason, newest at the bottom). Seed it with:
- Rokit shims fail outside a project → add the tools globally.
- A new shell misses freshly installed tools → reload PATH.
- Windows PowerShell 5 writes a BOM with `-Encoding utf8`, which breaks StyLua and skill frontmatter → use `WriteAllText` with no BOM.
- `Copy-Item dir existing-dir` nests the folder → copy `dir\*`.
- Rokit must trust a tool first.
- Parallel tool calls don't run in order → never batch a step that depends on an earlier edit.
- The Flux REST API rejects `seed` → send only `prompt` and `steps`.
- A Rojo project that lists a folder's children one by one silently drops new files (symptom: infinite yield on `WaitForChild`) → use `$path`, and run a check that every `src/**/*.luau` is mapped.
- Hi3DGen runs out of GPU memory at the decode → move the other models to CPU and empty the cache first.
- Python CLIs crash on the Windows console code page → set `PYTHONUTF8=1`.

**`setup/accounts-and-keys.md`**

| Needed for | What | Env vars |
|---|---|---|
| Claude edits and plays the game | Roblox Studio with the MCP enabled | none |
| Images and icons | Cloudflare Workers AI token | `CF_ACCOUNT_ID`, `CF_API_TOKEN` |
| Hi3DGen Space | Hugging Face token | `HF_TOKEN` |
| Uploads | Roblox Open Cloud key (Assets read/write) | `ROBLOX_API_KEY`, `ROBLOX_USER_ID`, optional `ROBLOX_GROUP_ID`, `ROBLOX_PLACE_ID` |
| Mesh work | Blender | `BLENDER` (path) |

The Open Cloud key is optional: without it, import the `.glb` with Studio's Bulk Import.

**`setup/licensing.md`**
- Hi3DGen is MIT.
- Check every model's licence, since some restrict regions.
- Pack textures and sounds belong to their authors, so keep harvested libraries private.
- Generated output must be allowed in a published game under that API's terms.

### 5f. `set-secrets.ps1`

It prompts for each key with `Read-Host -AsSecureString` and saves it as a user env var. It never prints, logs or writes a value to a file.

---

## 6. Extra skills to write (original, in the same style)

Each skill gets a short `SKILL.md` with `name` and a "use when" `description`, references only where needed, and API facts checked against current Roblox docs (the Studio MCP's `rbx-docs-search`). Each one points at Roblox Knowledge `rules\` instead of repeating them.

| Skill | Covers |
|---|---|
| `roblox-secure-remotes` | Server-authoritative remotes: type, range and ownership checks, rate limits, no trusted client values. |
| `roblox-datastore-safety` | Session locking, retries with backoff, autosave, BindToClose, schema versions and migrations, no data loss or dupes. |
| `roblox-monetization` | Game passes, dev products, an idempotent ProcessReceipt (grant, save, then return `PurchaseGranted`), odds rules. |
| `roblox-anti-exploit-review` | Threat model, server checks and enforcement. Run before shipping trading or purchases. |
| `roblox-debugging` | Reproduce, isolate, bisect, verify. Infinite yields, races, network ownership, live-only bugs. Uses `rbx-debug`. |
| `roblox-performance-audit` | Measured fixes: MicroProfiler, memory, network and mobile budgets. Uses `rbx-perf-profiling` and `rbx-scene-analysis`. |
| `roblox-system-builder` | A custom system end to end: config, server, client, remotes, saving, UI, tests. |
| `roblox-ui-review` | Responsive layout, safe areas, motion, accessibility, and phone and tablet checks with `rbx-device-simulator-lua`. |
| `roblox-worldbuilding` | Maps that read as designed: landmarks, paths, sightlines, prop density, no floating props. Works with `roblox-map`. |
| `roblox-onboarding` | First 60–90 seconds, guide arrows, stuck hints, skip and resume, funnel events (`rbx-instrument-analytics`). |
| `roblox-asset-import` | FBX/GLB/OBJ import: scale, pivot, collision fidelity, triangle budget, PBR textures. |
| `roblox-blender-modeling` | Blender quality gate: symmetry, budgets, clean export. |
| `roblox-trend-game` | Fast trend-format games (collect-upgrade-steal style) with a twist, under current Roblox rules, plus live ops. |
| `roblox-review-council` | Blind multi-agent review: 3–5 subagents with different lenses (player, security, economy, performance, art) answer alone, then a chair merges them into one verdict and keeps the dissent. Two agents: `review-member`, `review-chair`. For ship decisions only. |
| `roblox-quality-score` | A 0–10 rubric per asset type (model, animation, UI, system, world, VFX). Minimum 8.5, and it never replaces the game's own checks. Scores go to `.roblox-ai/ledger.jsonl` in the game repo. |
| agent `roblox-knowledge-lookup` | Read-only and fast: a question in, key facts and gotchas out, from Roblox Knowledge plus the docs. |

Slash commands (`<CLAUDE>\commands\`):

| Command | Does |
|---|---|
| `/audit` | Run the Luau check on every file, then a ranked security, data, exploit and performance fix list. |
| `/review-council` | Run the review council on a question or on finished work. |
| `/new-system` | Build a gameplay system with `roblox-system-builder`. |
| `/trend-game` | Plan and build a trend game. |
| `/continue-game` | Read `HANDOFF.md`, name the next stage, load its skill and start. |
| `/log-trap` | Add one entry to `rules/traps.md`. |
| `/learn` | Turn the quality ledger into `rules/recipes.md`, so first drafts score higher. |

---

## 7. Hooks (in `<CLAUDE>\settings.json`)

1. **Luau check (PostToolUse on `Write|Edit|MultiEdit` for `*.lua` / `*.luau`, 30 s timeout).** It runs `selene` and `stylua --check` on the file, then a small regex rule list (`luau-rules.tsv`) that flags:
   - deprecated `wait(` / `spawn(` / `delay(`
   - `OnServerEvent` handlers with no type checks
   - `SetAsync` where `UpdateAsync` belongs
   - a ProcessReceipt that returns `PurchaseGranted` before saving
   - `while true do` loops with no yield
   - currency changed on the client

   It prints its findings back to Claude, exits 2 on errors and 0 when clean. Ship both a `.ps1` and a `.sh` version.
2. **SessionStart.** If the working folder belongs to a game with a vault, print that vault's `CLAUDE.md` route table and the newest `HANDOFF.md`.
3. **Status line.** Shows the current game, its stage (from HANDOFF.md), the git branch, and whether Studio is connected.

Settings to set:
- `enableWorkflows: true`
- push notifications on
- the permission mode the owner chooses: bypass is fastest, but tell the owner what it means before turning it on

---

## 8. Extras that make the workflow stronger

1. **`doctor.ps1`.** A one-screen health check: tool versions, each MCP reachable, env vars present (names only, never values), Studio MCP on, Blender add-on on, gbrain status.
2. **A git repo per game.** Commit after each approved stage.
3. **CI for the four gates.** A GitHub Actions template that runs `rojo build`, `lune run test`, `selene` and `stylua --check` on every push, with the toolchain from `rokit.toml`.
4. **Place backups.** Before risky work, save the place to `<game>\backups\<timestamp>.rbxl` and keep the last 10.
5. **Playtest checklist (`rules/playtest.md`):**
   - solo, then a 2-client test
   - phone and tablet in the device simulator
   - 3G in `rbx-network-simulator`
   - save and load after a rejoin
   - a purchase in a test server
   - console free of errors
   - a fresh alt account timed to each milestone
6. **Analytics by default.** Funnel events for the first five minutes and economy events for every currency.
7. **Live tunables with ConfigService** (`rbx-configs-experimentation`) for prices, drop rates and timers, so balance changes need no republish. Use it for A/B tests too.
8. **Unit tests** with `rbx-unit-test` for every ModuleScript that holds game rules.
9. **Asset registry discipline.** Every asset ID used goes into `assets/registry.json` with its source and licence, and its look is checked against the style guide.
10. **The traps habit.** Every fixed bug becomes a traps entry, so no session pays for the same bug twice.

---

## 9. Finish and prove it

1. Run `roblox-skills-setup` (writes each `LOCAL.md`, runs the smoke test), then `doctor.ps1`. Everything should be green except keys not yet set.
2. Create a throwaway game with `new-project -Kind roblox`. Check:
   - the vault exists
   - the Graphify map is built
   - the empty project passes all four gates
   - Studio opens it and a solo playtest starts and stops
3. Search every file you wrote for hard-coded user paths (`C:\Users\`), and make sure no key values appear anywhere.
4. Put a `README.md` next to the setup listing each part, where it lives, its licence, and the SyphoDev credit link.
5. Tell the owner, in a few lines, what is installed, which keys they still need to set with `set-secrets.ps1`, and what to say to start their first game, e.g. "make me a tycoon game".
