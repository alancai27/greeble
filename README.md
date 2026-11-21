# Greeble

Set-dressing agent for Roblox Studio. A studio gives it a blocked-out zone and
its own asset kit; Greeble places the assets in that studio's style as normal,
editable instances.

- `plugin/` thin Studio client. Samples the zone, calls the server, creates instances.
- `server/` everything of value: style profiles and placement. `npm test`, `GREEBLE_KEYS=... npm start`.
- `docs/contract.md` the JSON both sides agree on.

## State

- Server: profile learning (density, scale range, spacing) and a rule-based
  baseline placer with keep-clear, overlap and budget rules. Tested.
- Plugin: written, **not yet run in Studio**.
- Not built: learning a profile from a map inside the plugin, the agent layer
  that plans zones and reviews screenshots, accounts and billing.
