# How the workflow works

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

## Third-party tools named here

Install each from its official source. Nothing from them is copied into this vault.

- Claude Code: Anthropic, docs.anthropic.com/en/docs/claude-code
- Obsidian: obsidian.md
- Rojo: rojo.space
- Blender: blender.org
- Roblox Studio, Studio MCP and Open Cloud: create.roblox.com/docs
- Figma: figma.com
- Cloudflare Workers AI and Flux Schnell: developers.cloudflare.com/workers-ai (model by Black Forest Labs)
- Hi3DGen: github.com/Stable-X/Hi3DGen, run through a Space on huggingface.co
- ICM, Graphify, GBrain: use the source the owner installed them from; this vault does not name one.
