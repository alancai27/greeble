# Brief: Greeble

Leads only.

## What we are building

The AI dev environment for Roblox studios. A dev installs Greeble and their
agent becomes good at Roblox work: tested rules and workflows, memory and
code-graph tools wired up, and hosted specialized tools that general agents
do badly. The first specialized tool dresses a map zone with the studio's own
assets in the studio's style.

There are two ways in, on one backend:

- Door 1, bring your own agent: devs who already use Claude Code, Cursor or
  Codex add Greeble's pack and its MCP tools.
- Door 2, no setup: a chat panel inside Roblox Studio talks to an agent we
  host. The dev never sees which model is behind it.

## Who uses it first

Matt and the second Roblox dev on the team, on their own games. Then six
developers they know who have no AI setup. Top studios with their own
setups are not the first target.

## What exists today

- `server/`: profile learning, a rule-based placer, a job queue and an MCP
  endpoint. Unit-tested. Never run with a real MCP client.
- `plugin/`: Studio plugin with a dress button and Listen mode. Never run in
  Studio.
- `docs/contract-draft.md`: the JSON between plugin, server and agents.
- `pack/source/workflow-brief.md`: the full setup Matt runs today, as a brief
  for an agent to install. The pack is built from it.

## Constraints

- Free model access ends in January 2027. After that every hosted run costs
  money, so usage caps are required before any outside user gets Door 2.
- Hosted runs must use a commercial API account, never a personal plan.
- Everything of value stays on the server. Assume the plugin and the pack
  are public.
- A studio's maps, assets and profiles are private to that studio.
- Only the human can: run things in Roblox Studio (unless Studio's MCP is
  connected on his machine), get files from Matt, create accounts, handle
  payments, talk to users.

## What "good" looks like

1. Matt dresses a zone of his own game with his own kit and ships it without
   redoing it by hand.
2. From Claude Code with the pack installed, "dress the Market zone" places
   assets in an open Studio session.
3. A dev with no setup installs the plugin, signs in and gets a working
   change from the chat panel in under ten minutes.
4. A free account stops at its trial limit with a clear upgrade message.

## Out of scope

- Training our own generation models. Wrapping existing ones is in the plan.
- Unity, Unreal or Godot support.
- Anything that sends one studio's data to another studio.
