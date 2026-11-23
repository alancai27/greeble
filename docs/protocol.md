# How the agents talk through GitHub

For you and for leads. Workers and reviewers never read this file.

## The idea

Agents don't message each other. They read and write three things on GitHub:

| Thing | Written by | Read by | Carries |
|-------|-----------|---------|---------|
| Issue | lead | one worker, one reviewer | the whole task |
| Label | scripts | leads, via the board | the task's state |
| Pull request | worker | reviewer | the result and a short report |

An agent that needs something from another agent changes a label and stops.
The lead sees the change on the board and starts whoever is needed next.

## States

    todo -> claimed -> needs-review -> merged (issue closes)
                 \            \
                  blocked      changes-requested
                     |               |
                 (lead answers)  (worker fixes)
                     v               v
                    todo          needs-review

| Label | Meaning | Who acts next |
|-------|---------|---------------|
| `todo` | ready, or answered after a block | lead starts a worker |
| `claimed` | a worker is building it | nobody |
| `needs-review` | pull request is open | lead starts a reviewer |
| `changes-requested` | reviewer sent it back | lead starts a worker |
| `blocked` | worker asked a question | lead answers |

## Who knows what

| Tier | Agents | Loaded into context |
|------|--------|---------------------|
| Everyone | all | `AGENTS.md` (about 40 lines) |
| Lead | 2 or 3 | `BRIEF.md`, `PLAN.md`, `docs/contracts.md`, the board |
| Worker | many | one issue, the files it lists |
| Reviewer | many | one issue, one diff |

Workers never see the brief, the plan, other issues or other workers' output.
Leads never see diffs or worker transcripts.

## Why this saves tokens

1. **The shared file is tiny.** `AGENTS.md` is loaded by every agent on every
   turn, so each line in it is paid for many times over. Role detail lives in
   `agents/`, which only that role reads, once.
2. **Issues are self-contained.** The lead pastes the exact contract lines
   into the issue. Reading 5 pasted lines is cheaper than a worker opening a
   200-line contracts file, and far cheaper than a worker exploring the repo.
3. **Workers start fresh.** One worker per issue, new context each time.
   Nothing from the last task is carried along.
4. **Replies to the lead are one line.** When a lead starts a subagent, the
   subagent's final message lands in the lead's context. One line per task
   keeps a lead usable for the whole event.
5. **Scripts cut tool output.** `scripts/board` prints one line per issue.
   `scripts/check` prints `ok` per check and logs only for failures. Raw
   `gh issue view` or a full test log can cost thousands of tokens each time.
6. **Only reviewers read diffs,** in a context that is thrown away afterwards.
7. **Path ownership prevents conflicts.** No two open issues share a path, so
   nobody spends tokens resolving merges.

## Things to set up outside the repo

- Give workers as few MCP servers as possible. Every connected server adds
  its tool descriptions to every turn.
- Put app-specific rules in `app/AGENTS.md` (with a one-line `app/CLAUDE.md`
  importing it). Claude Code loads nested files only when an agent reads
  files in that folder, so leads don't pay for them.
- Track real usage with a tool such as ccusage. These rules are reasoning,
  not measurements; check where your tokens actually go and adjust.

## Running three leads

Each lead is its own Claude Code session in the main checkout (one tmux
window each). Leads only edit `PLAN.md` and `docs/`, and pull with rebase
before pushing, so they don't collide. Workers and reviewers are subagents a
lead starts, each working in its own worktree beside the repo, in
`../<repo>-wt/issue-N`.
