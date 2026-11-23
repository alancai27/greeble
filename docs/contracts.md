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
type AssetStyle = { density: number; scaleMin: number; scaleMax: number; spacing: number };
type ZoneStyle = { assets: Record<string, AssetStyle> };

// Keyed by zone label. The server trims and lowercases labels; a missing or
// empty label becomes "default".
type Profile = { zones: Record<string, ZoneStyle> };

type ProfileRequest = {
  zones: {
    label?: string;
    area?: number;          // dressed ground area, square studs. Omitted: the
                            // server uses the XZ bounding box of the positions.
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
};

type Job = { id: string; type: "dress_zone"; params: { zone?: string; maxInstances?: number; seed?: number } };
type JobStatus = "queued" | "running" | "done" | "failed";
```

## Routes

| Method | Path | Request body | Response |
|--------|------|--------------|----------|
| POST | /v1/profile | `ProfileRequest` | `{ profile: Profile }`, the whole stored profile after the merge |
| GET | /v1/profile | none | `{ profile: Profile \| null }` |
| POST | /v1/place | `PlaceRequest` | `{ placements: Placement[], stats: PlaceStats }` |
| GET | /v1/jobs/next | none | `{ job: Job \| null }`; marks the job running |
| POST | /v1/jobs/:id/result | `{ ok: true, result: PlaceStats }` or `{ ok: false, result: { error: string } }` | `{ status: JobStatus }` |
| POST | /mcp | JSON-RPC | JSON-RPC |

- `POST /v1/profile` replaces the stored zones whose labels are in the
  request and keeps the others.
- Steep surface hits are dropped before density is worked out, so targets
  use the usable area only.
- Profiles and jobs are held in memory until milestone 4.

## What the plugin does with a placement

It clones the kit Model named `assetId`, scales it, pivots it to `position`
with `rotationY`, and parents it under `workspace.Greeble/<zone id>` inside
one undo recording. Nothing else is written.

## MCP tools (Door 1; Door 2's hosted agent calls the same ones)

- `greeble_dress_zone { zone, maxInstances?, seed? }` -> `{ id, status }`
- `greeble_job_status { id }` -> `{ id, status, result }`

## Plugin settings and Studio conventions

| Name | Kind | Notes |
|------|------|-------|
| `GreebleUrl` | plugin setting | Server base URL, no trailing slash |
| `GreebleKey` | plugin setting | Studio key. Never printed |
| `GreebleKitPath` | plugin setting | Slash-separated path from `game`. Default `ServerStorage/GreebleKit` |
| `GreebleZone` | Part name | Default zone bounds box. Attributes: `ZoneId`, `Label`, `MaxInstances`, `Seed` |
| `GreebleKeepClear` | tag | Parts whose boxes become `keepClear` |
| `Label` | attribute | On a zone Part, or on a Folder or Model given to Learn style |

Learn style matches a map's Models to kit assets by Name. `assetId` is the
kit Model's Name.

## Site

- One page at `/`. Prototype variants are chosen with `?variant=a|b|c`.
- `site/package.json` scripts: `dev`, `build`, `typecheck`.

## Environment variables

| Name | Used by | Notes |
|------|---------|-------|
| `GREEBLE_KEYS` | server | Comma-separated studio keys. Required |
| `PORT` | server | Default 8787 |
