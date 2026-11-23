---
description: Check every Luau file in this project, then give a ranked fix list. Reports only; fixes nothing.
---

# Audit

1. Find every `.lua` and `.luau` file in the project.
2. Run `<CLAUDE>/hooks/greeble/luau-check.sh` on each one. Findings print as
   `<file>:<line>: <message>`. Exit 2 means it found something; exit 0 means
   the file is clean.
3. Read the files with findings, plus any RemoteEvent, RemoteFunction,
   DataStore and purchase code, and look past what the check can see.
4. Give one ranked fix list, worst first, in four groups: security, data,
   exploit, performance. Each item: file and line, what goes wrong for
   players, the fix in one line.

Change nothing. Wait for the dev to pick items from the list, then fix only
those. Install nothing, publish nothing, spend nothing.
