# Greeble

Set-dressing agent for Roblox Studio. A studio gives it a blocked-out zone and
its own asset kit; Greeble places the assets in that studio's style as normal,
editable instances.

- `plugin/` thin Studio client. Samples the zone, calls the server, creates instances.
- `server/` everything of value: style profiles and placement. `npm test`, `GREEBLE_KEYS=... npm start`.
- `docs/contract.md` the JSON both sides agree on.

## State

- Server: profile learning, rule-based placer, job queue, MCP endpoint. Tested.
- Plugin: dress button and Listen mode written, **not yet run in Studio**.
- MCP endpoint: tested with hand-written JSON-RPC, **not yet with a real client**.
- Not built: the hosted agent and chat panel, profile learning from inside the
  plugin, the installer and rules pack, accounts and billing.
