# Vault routes

Load only what you are routed to. Do not read the whole vault.

| If asked about | Go to | Stop at |
|---|---|---|
| what this project is, its goal, its people | `CONTEXT.md` | the end of `CONTEXT.md` |
| what was done, when, or what changed | `changelog/` | the newest entry that answers it |
| why something was chosen | `decisions/` | the one card for that choice |
| how things must be done, or what is not allowed | `rules/` | the one rule that applies |
| how parts of the code connect | `_graph/` | the first file that answers it |
| how to write a new entry, card or rule | `_templates/` | the one form you need |

If nothing above matches, read `CONTEXT.md` and stop there.

## Writing to this vault
- A finished piece of work gets one file in `changelog/`, from `_templates/changelog-entry.md`.
- A choice gets one card in `decisions/`, from `_templates/decision.md`.
- A stable rule gets one file in `rules/`, from `_templates/rule.md`.
- Never write into `_graph/`; it is generated.
- No keys or secrets in any note. <OWNER> keeps them outside the vault.
