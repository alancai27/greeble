# Running a changed plugin build in Studio

Studio loads `~/Documents/Roblox/Plugins/Greeble.server.lua` once, at start. Copying a new
file there does nothing until a restart. These were tried over the Studio MCP server:

- Studio's own reload: doesn't work. Plugin Debugging (Save and Reload Plugin) is off, its
  setting is locked to Roblox scripts, it is a right-click menu, and it writes out, not in.
- Saving the plugin from inside Studio: doesn't work. "Save as Local Plugin" is an Explorer
  right-click only; no script API exists.
- Dev loader through `execute_luau`: works. Use this.

## Dev loader (no restart, no click)

1. Build one Luau chunk: `local src = [=====[` + the whole changed file + `]=====]`, then:

       local fn = assert(loadstring(src, "=GreebleDev"))
       if _G.GreebleDevPlugin then _G.GreebleDevPlugin:Destroy() end
       local p = PluginManager():CreatePlugin()
       _G.GreebleDevPlugin = p
       setfenv(fn, setmetatable({ plugin = p }, { __index = getfenv(1) }))
       fn()
       return game:GetService("CoreGui").GreebleTestHook:Invoke("status")

2. Run it with `execute_luau` (Edit). The new build replaces `GreebleTestHook`. Repeat per change.

Limits: the installed plugin keeps its toolbar but loses its hook until Studio restarts, and
`Unloading` never fires for the dev copy, so stop listening (`listen`, on = false) before
reloading. HTTP from the dev copy goes through the MCP allowlist: a person must add the
server's domain (e.g. `localhost:8787`) once under Assistant Settings, MCP Permissions,
Connect to the internet. Ship by copying the file to the Plugins folder; a restart picks it up.
