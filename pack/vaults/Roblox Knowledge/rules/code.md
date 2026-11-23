# Code rules

- Play mode can't be watched; only the output log comes back. So make as much as possible checkable while it sits still.
- Game rules are plain Luau numbers with no Roblox objects, so they can be tested on the PC.
- Four gates before Studio sees anything: `rojo build`, Lune tests, Selene, StyLua. An empty new project must pass all four first.
- Code lives in files and is never typed into Studio.
- One config folder holds every tunable.
- One file declares every remote.

Tools: Rojo (rojo.space), Lune (github.com/lune-org/lune), Selene (github.com/Kampfkarren/selene), StyLua (github.com/JohnnyMorganz/StyLua).
