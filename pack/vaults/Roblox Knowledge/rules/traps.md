# Traps

One entry per fix. Newest at the bottom. Read this before retrying something that failed.

## Entry format

    ### <YYYY-MM-DD> <short title>
    - Broke: what went wrong, and the symptom you saw
    - Fix: what made it work
    - Reason: why it broke

## Entries

The seed entries came with the vault and have no date.

### seed: Rokit shims outside a project
- Broke: Rokit shims fail outside a project
- Fix: add the tools globally

### seed: New shell misses new tools
- Broke: a new shell misses freshly installed tools
- Fix: reload PATH

### seed: PowerShell 5 BOM
- Broke: Windows PowerShell 5 writes a BOM with `-Encoding utf8`, which breaks StyLua and skill frontmatter
- Fix: use `WriteAllText` with no BOM

### seed: Copy-Item nests folders
- Broke: `Copy-Item dir existing-dir` nests the folder
- Fix: copy `dir\*`

### seed: Rokit trust
- Broke: Rokit refuses an untrusted tool
- Fix: Rokit must trust a tool first

### seed: Parallel tool calls
- Broke: parallel tool calls don't run in order
- Fix: never batch a step that depends on an earlier edit

### seed: Flux seed parameter
- Broke: the Flux REST API rejects `seed`
- Fix: send only `prompt` and `steps`

### seed: Rojo drops new files
- Broke: a Rojo project that lists a folder's children one by one silently drops new files (symptom: infinite yield on `WaitForChild`)
- Fix: use `$path`, and run a check that every `src/**/*.luau` is mapped

### seed: Hi3DGen out of GPU memory
- Broke: Hi3DGen runs out of GPU memory at the decode
- Fix: move the other models to CPU and empty the cache first

### seed: Python on the Windows console
- Broke: Python CLIs crash on the Windows console code page
- Fix: set `PYTHONUTF8=1`
