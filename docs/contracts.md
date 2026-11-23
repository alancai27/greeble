# Contracts

The shared types and routes that more than one area depends on. Leads write
this file. Leads paste the relevant lines into each issue, so workers never
need to open it.

Keep each contract small and exact. Change one only as described in
`agents/lead.md`. This file replaces `docs/contract-draft.md`.

## Rules for every route

- Every request carries `Authorization: Bearer <studio key>`. All stored data
  (profiles, jobs) is scoped to that key.
- JSON in, JSON out. Units are studs. Y is up. Angles are radians unless the
  field name ends in `Deg`.
- Every error is `{ "error": string }` with a non-2xx status. For 400 the
  string starts with the path of the bad field, for example
  `zones[0].instances[2].position: expected [x, y, z]`.
- Statuses: 400 bad request, 401 unknown key, 404 unknown route, 405 wrong
  method, 409 no profile for this zone, 413 body over 20 MB.

## Data types

```ts
type Vec3 = [number, number, number];

// One prop in a finished map. scale defaults to 1.
type Instance = { assetId: string; position: Vec3; scale?: number };

// density: instances per square stud. spacing: median distance to the
// nearest neighbour of the same asset.
// clearance: 10th percentile of the distance from an instance of this asset
// to its nearest neighbour of ANY asset in the finished map: how close the
// map itself lets things sit. 0 when the zone has a single instance.
type AssetStyle = { density: number; scaleMin: number; scaleMax: number; spacing: number; clearance: number };
type ZoneStyle = { assets: Record<string, AssetStyle> };

// Keyed by zone label. The server trims and lowercases labels; a missing or
// empty label becomes "default".
type Profile = { zones: Record<string, ZoneStyle> };

type ProfileRequest = {
  zones: {
    label?: string;
    area?: number;          // dressed ground area, square studs. Omitted: the
                            // server estimates it from occupied grid cells
                            // (see "Learned area" below), never more than the
                            // XZ bounding box of the positions.
    instances: Instance[];  // at least one
  }[];                      // at least one
};

type PlaceRequest = {
  zone: { id: string; label?: string };
  surface: { position: Vec3; normal: Vec3 }[];  // ray hits on a grid, unit normals
  cell: number;                                 // grid step used for surface
  assets: { id: string; footprint: number }[];  // footprint = radius on the ground
  keepClear?: { min: Vec3; max: Vec3 }[];       // paths, spawns
  budget?: { maxInstances?: number };
  maxSlopeDeg?: number;                         // default 35
  seed?: number;                                // default 1
};
// The request carries no profile. The server uses the stored ZoneStyle for
// zone.label, then for "default", and answers 409 if neither exists.

type Placement = { assetId: string; position: Vec3; rotationY: number; scale: number };
type PlaceStats = {
  placed: number; skippedKeepClear: number; skippedOverlap: number;
  skippedSlope: number;   // surface hits steeper than maxSlopeDeg
  budgetHit: boolean;
  label: string;          // the label whose style was used: the zone's own, or "default"
  tooLarge: string[];     // asset ids left out because they cannot fit this zone
};

// Footprint rules (the placer treats each prop as a circle of radius
// footprint * scale around its position):
// - the whole circle stays inside the XZ bounds of the surface hits;
// - the circle never touches a keepClear box (counted in skippedKeepClear);
// - the circle never covers a steep surface hit (counted in skippedSlope,
//   together with the steep hits themselves);
// - an asset whose diameter at scaleMax is more than the zone's shorter side
//   cannot fit and is left out and listed in tooLarge.
// Spacing between props follows the map, not the footprints, because real
// maps overlap (tree crowns interpenetrate):
// - two props of different assets A and B are at least
//   min(rA + rB, (clearanceA + clearanceB) / 2) apart;
// - two props of the same asset are at least 0.6 * spacing apart;
// - an asset with clearance 0 or spacing 0 falls back to non-touching circles.
//
// Learned area: with `area` omitted, lay a square grid over the zone's
// positions with cell = clamp(3 * median nearest-neighbour distance, 4, 100)
// studs; area = min(XZ bounding-box area, occupied cells * cell * cell).
// Empty ground between far-apart groups no longer dilutes density.

type Job =
  | { id: string; type: "dress_zone"; params: { zone?: string; maxInstances?: number; seed?: number } }
  | { id: string; type: "learn_profile"; params: { path: string; label?: string } };
type JobStatus = "queued" | "running" | "done" | "failed";

// Result of a learn_profile job. zones: the labels that were stored.
// unmatched: Models under path whose Name is not a kit asset (skipped).
type LearnStats = { zones: string[]; instances: number; unmatched: number };
```

## Routes

| Method | Path | Request body | Response |
|--------|------|--------------|----------|
| POST | /v1/profile | `ProfileRequest` | `{ profile: Profile }`, the whole stored profile after the merge |
| GET | /v1/profile | none | `{ profile: Profile \| null }` |
| POST | /v1/place | `PlaceRequest` | `{ placements: Placement[], stats: PlaceStats }` |
| GET | /v1/jobs/next | none | `{ job: Job \| null }`; marks the job running |
| POST | /v1/jobs/:id/result | `{ ok: true, result: PlaceStats \| LearnStats }` or `{ ok: false, result: { error: string } }` | `{ status: JobStatus }` |
| POST | /mcp | JSON-RPC | JSON-RPC |

- `POST /v1/profile` replaces the stored zones whose labels are in the
  request and keeps the others.
- The 409 from `POST /v1/place` names the label it looked up and the labels
  that exist: `no profile for label "default"; learned labels: market, forest`
  (or `learned labels: none`). A failed `dress_zone` job carries that string
  as its `result.error`, so an agent can see the mismatch.
- Steep surface hits are dropped before density is worked out, so targets
  use the usable area only.
- Profiles and jobs are held in memory until milestone 4.

## What the plugin does with a placement

It clones the kit Model named `assetId`, scales it, pivots it to `position`
with `rotationY`, and parents it under `workspace.Greeble/<zone id>` inside
one undo recording. A dress first removes any existing Folder for that zone
id, inside the same undo recording, and leaves it untouched if the dress
fails. Nothing else is written.

## MCP tools (Door 1; Door 2's hosted agent calls the same ones)

- `greeble_dress_zone { zone, maxInstances?, seed? }` -> `{ id, status }`
- `greeble_learn_profile { path, label? }` -> `{ id, status }`. Queues a
  `learn_profile` job. `path` is slash-separated from `game` to a Folder or
  Model of a finished map, for example `Workspace/Map/Market`. `label`
  overrides the instance's `Label` attribute; neither set means "default".
- `greeble_job_status { id }` -> `{ id, status, result }`. `result` is
  `PlaceStats` or `LearnStats` when done, `{ error }` when failed.

The plugin, in Listen mode, runs a `learn_profile` job through the same code
as the Learn style button, reading the instance at `path` instead of the
selection, and reports `LearnStats`. Map data still goes plugin -> server.

### Connecting a dev's agent (Door 1)

- The MCP server is `POST <GREEBLE_URL>/mcp`, plain JSON responses, no
  streaming. Server name in the client config: `greeble`.
- Claude Code entry: HTTP transport, URL `${GREEBLE_URL}/mcp`, header
  `Authorization: Bearer ${GREEBLE_KEY}`. The key is read from the
  environment and is never written into an MCP config file or the pack.
- On macOS the installer stores `GREEBLE_URL` and `GREEBLE_KEY` in
  `$HOME/.greeble/env` (mode 600) and, after asking, adds one line to
  `~/.zshrc` that sources it. The key is read from the environment or a
  silent prompt, never from a command-line argument.

## Pack layout

What ships is only what we wrote. Third-party tools are installed from their
official source by the installer, never copied here.

| In the repo | Installed to |
|-------------|--------------|
| `pack/claude/skills/<name>/SKILL.md` | `<CLAUDE>/skills/<name>/` |
| `pack/claude/agents/<name>.md` | `<CLAUDE>/agents/` |
| `pack/claude/commands/<name>.md` | `<CLAUDE>/commands/` |
| `pack/claude/hooks/` | `<CLAUDE>/hooks/greeble/` |
| `pack/vaults/Roblox Knowledge/` | `<VAULTS>/Roblox Knowledge/` |
| `pack/vaults/_templates/` | `<VAULTS>/_templates/` |
| `pack/vaults/_tools/` | `<VAULTS>/_tools/` |
| `pack/install/` | not installed; the installer and its scripts |

- `<CLAUDE>` defaults to `$HOME/.claude`, `<VAULTS>` to
  `$HOME/Documents/Obsidian`. No file in the pack hard-codes a user path.
- Every skill has front matter with `name` and a "use when" `description`.
- Nothing in the pack contains a key, a server-side prompt or placement logic.
- The installer asks before anything that widens the agent's control of the
  PC or its permission mode, and the default answer is no.

## Plugin settings and Studio conventions

| Name | Kind | Notes |
|------|------|-------|
| `GreebleUrl` | plugin setting | Server base URL, no trailing slash |
| `GreebleKey` | plugin setting | Studio key. Never printed |
| `GreebleKitPath` | plugin setting | Slash-separated path from `game`. Default `ServerStorage/GreebleKit` |
| `GreebleZone` | Part name | Default zone bounds box. Attributes: `ZoneId`, `Label`, `MaxInstances`, `Seed` |
| `GreebleKeepClear` | tag | Parts whose boxes become `keepClear` |
| `Label` | attribute | On a zone Part, or on a Folder or Model given to Learn style |

Learn style matches a map's Models to kit assets by Name and shape. A map
Model counts as kit asset X only when its bounding-box size is the kit
Model's size times one uniform factor, the three axes agreeing within 15%.
That factor is the instance's `scale`. Same name but a different shape counts
as unmatched. `assetId` is the kit Model's Name. `footprint` is half the
XZ diagonal of the kit Model's bounding box, so the circle contains the prop
at any rotation. Props are placed by
bounding-box bottom, not pivot.

## Site

- One page at `/`. Prototype variants are chosen with `?variant=a|b|c`.
- `site/package.json` scripts: `dev`, `build`, `typecheck`.

## Environment variables

| Name | Used by | Notes |
|------|---------|-------|
| `GREEBLE_KEYS` | server | Comma-separated studio keys. Required |
| `PORT` | server | Default 8787 |
| `GREEBLE_URL` | dev's machine | Server base URL, no trailing slash. Read by the MCP entry |
| `GREEBLE_KEY` | dev's machine | The dev's studio key. Read by the MCP entry. Never printed |
