# Accounts and keys

| Needed for | What | Env vars |
|---|---|---|
| Claude edits and plays the game | Roblox Studio with the MCP enabled | none |
| Images and icons | Cloudflare Workers AI token | `CF_ACCOUNT_ID`, `CF_API_TOKEN` |
| Hi3DGen Space | Hugging Face token | `HF_TOKEN` |
| Uploads | Roblox Open Cloud key (Assets read/write) | `ROBLOX_API_KEY`, `ROBLOX_USER_ID`, optional `ROBLOX_GROUP_ID`, `ROBLOX_PLACE_ID` |
| Mesh work | Blender | `BLENDER` (path) |

The Open Cloud key is optional: without it, import the `.glb` with Studio's Bulk Import.

Keys never go in the chat. The owner sets them as user env vars from their own terminal; skills read them from the environment.

Where to get each: Roblox Studio and Open Cloud keys at create.roblox.com; Cloudflare at dash.cloudflare.com; Hugging Face at huggingface.co/settings/tokens; Blender at blender.org.
