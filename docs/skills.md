# Third-party skills

Skills in `.claude/skills/` (for the coding agents) and `hackathon/hq/skills/ideation/`
(for Hermes) are copied from public repos, unmodified, at a pinned commit.
Each agent loads a skill's short description up front and the full text only
when a task matches. Each skill's own licence file sits in its folder.

Every file below was read before it was added. Nothing in them phones home
or runs on its own.

## Included

| Skill | From | Commit | Licence | Use |
|-------|------|--------|---------|-----|
| `frontend-design` | anthropics/skills | `e4bb5d9` | Apache-2.0 | Workers building UI: pushes away from generic-looking pages |
| `webapp-testing` | anthropics/skills | `e4bb5d9` | Apache-2.0 | Reviewers and workers: drive the running app with Playwright to confirm acceptance checks |
| `supabase` | supabase/agent-skills | `c9be0e9` | MIT | Any Supabase work: auth, row-level security traps, CLI, migrations |

| `diagnosing-bugs` | mattpocock/skills | `abeeaf9` | MIT | Workers stuck on a bug: build a pass/fail check for it before trying fixes |
| `prototype` | mattpocock/skills | `abeeaf9` | MIT | Three structurally different UI layouts behind `?variant=`, or a one-file demo of a state model |

For Hermes, in `hackathon/hq/skills/ideation/`:

| Skill | From | Commit | Licence | Use |
|-------|------|--------|---------|-----|
| `product-brainstorming` | anthropics/knowledge-work-plugins | `0e0fcac` | Apache-2.0 | Generating many ideas before narrowing; testing assumptions |
| `red-team-review` | mohitagw15856/pm-claude-skills | `c4679f9` | MIT | Attacking each shortlisted idea from several hostile viewpoints |
| `grilling` | mattpocock/skills | `abeeaf9` | MIT | Questioning you in rounds about one idea, over DM |

Copied on 2026-11-21. `supabase` was copied without its `CHANGELOG.md`.

`hackathon-hq` says how the three ideation skills are used: brainstorm at
least seven ideas, keep three, attack each as that event's judges would,
then offer `grill K`. `red-team-review` is one person's community skill, not
a vendor's; it is plain instructions with no scripts or network calls.

If Hermes doesn't list an ideation skill, it may want a `version:` line in
that skill's header. Add one and note the change here.

## Needed on the machine

`webapp-testing` writes Python Playwright scripts:

    pip install playwright
    playwright install chromium

## Things to know

- `supabase` tells the agent to fetch Supabase's changelog and docs pages
  before implementing. That costs a few web fetches per task and is the
  point of the skill.
- `supabase` includes a flow for filing feedback issues on Supabase's
  GitHub repo. `AGENTS.md` forbids agents from writing to other
  repositories, so they won't use it.
- `frontend-design` asks the agent to confirm the subject with "the client"
  when the brief is unclear. A worker should block the issue instead.
- `webapp-testing/scripts/with_server.py` starts whatever server command it
  is given and stops it afterwards. It makes no network calls of its own.

## Looked at and left out

| Skill | Why not |
|-------|---------|
| `agent-browser` (vercel-labs) | A strong browser tool for agents that can also record demo video. Its skill file is a stub; the real instructions are served by the installed program (about 200 KB) and weren't read in full. Worth a proper look as a replacement for `webapp-testing`. |
| `claude-api` (anthropics) | Useful for apps that call Claude, but 2.3 MB across eight languages. Install it as a plugin when a project needs it instead of copying it here. |
| `grill-me` (mattpocock) | A one-line wrapper that calls `grilling` through a Claude Code tool Hermes doesn't have. |
| `deploy-to-vercel` (vercel-labs) | When the Vercel CLI isn't signed in, it tells the agent to publish the project to a temporary public URL without asking. Connect the repo to a host through git instead, so pushes to `main` deploy. |
| `web-design-guidelines` (vercel-labs) | A good accessibility and polish checklist, pinned and offline. Left out only because the repo has no licence file (its README says MIT). Add it yourself if you're comfortable: `npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines` |
| `react-best-practices` (vercel-labs) | 76 files of performance rules. Performance tuning isn't what wins a hackathon demo. |
| `supabase-postgres-best-practices` (supabase) | 36 reference files. Worth adding if a project is database-heavy. |
| `systematic-debugging` and the rest of Superpowers (obra) | Requires a failing test before any fix and a talk with "your human partner" after three failed attempts, and its plugin loads extra instructions into every session. That conflicts with this repo's issue protocol and demo-first rule. |

## Updating a skill

1. Clone the source repo and read the diff for that skill's folder since the
   commit above. Read all of it; a skill is instructions your agents will follow.
2. Replace the folder, keep the licence file, and update the commit here.
3. Never add a skill that fetches its instructions from the network at run time.

## Adding more

Each project skill adds its description to every agent's context, so keep
the set small. Prefer skills from the vendor of the tool they cover, check
the licence, and read every file first.
