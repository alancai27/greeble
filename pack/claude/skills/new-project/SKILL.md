---
name: new-project
description: Use when a dev wants to start a new project or Roblox game vault, i.e. "new project", "set up a vault for my game", "start a project from our template". Creates an Obsidian vault from the pack's templates in one step on macOS.
---

# New project

Create a project vault from the pack's templates with one script run.

## Ask

Ask only these two things, in one message:

1. **Name** of the project. This becomes the vault folder name; spaces are fine.
2. **Code path** (optional): the folder that holds, or will hold, the code.

Decide the kind yourself: `roblox` if the dev says it is a Roblox game or the
code path holds a Rojo project (`default.project.json`), otherwise `project`.
Do not ask anything else.

## Run

```bash
bash "${GREEBLE_VAULTS_DIR:-$HOME/Documents/Obsidian}/_tools/new-project-vault.sh" \
  --name "<Name>" [--code-path "<dir>"] [--kind project|roblox]
```

Quote every argument. The script:

- copies `<VAULTS>/_templates/<kind>-vault/` to `<VAULTS>/<Name>/`, where
  `<VAULTS>` is `$GREEBLE_VAULTS_DIR` or `$HOME/Documents/Obsidian`;
- for `roblox` with a code path, runs `git init` there if needed and adds a
  Roblox `.gitignore` if none exists;
- prints one line saying the code map and brain source steps were skipped.

If it exits 1 because the vault already exists, tell the dev and stop. Nothing
was changed. Do not delete or overwrite the existing vault.

## Finish

Tell the dev, in a few lines:

- the vault path the script printed;
- to open it once in Obsidian: **Manage vaults -> Open folder as vault**, then
  pick that folder;
- that from now on you read the vault's `CLAUDE.md` first, and log work to
  `changelog/` and choices to `decisions/`.

Do not hand off to any other skill.
