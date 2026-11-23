> Superseded by `docs/contracts.md`. Kept for history; do not build from this.

# Contract: plugin <-> server

All requests carry `Authorization: Bearer <studio key>`. JSON in, JSON out.
Units are studs. Y is up.

## POST /v1/profile
Learn a style profile from a finished map.

Request: `{ "studio": "id", "area": 4096, "instances": [ { "assetId": "Barrel", "position": [x,y,z], "scale": 1.0 } ] }`
`area` is the dressed ground area in square studs.

Response: `{ "profile": { "assets": { "Barrel": { "density": 0.004, "scaleMin": 0.9, "scaleMax": 1.2, "spacing": 6.1 } } } }`
`density` is instances per square stud; `spacing` is the median distance to the nearest same-asset neighbour.

## POST /v1/place
Dress one zone.

Request:
```
{
  "zone": { "id": "market-1", "label": "market" },
  "surface": [ { "position": [x,y,z], "normal": [x,y,z] } ],   // ray hits on a grid
  "cell": 4,                                                    // grid step used for surface
  "assets": [ { "id": "Barrel", "footprint": 3 } ],            // footprint = radius on the ground
  "keepClear": [ { "min": [x,y,z], "max": [x,y,z] } ],         // paths, spawns
  "profile": { ... },                                           // from /v1/profile
  "budget": { "maxInstances": 400 },
  "seed": 1
}
```

Response: `{ "placements": [ { "assetId": "Barrel", "position": [x,y,z], "rotationY": 1.57, "scale": 1.1 } ], "stats": { "placed": 212, "skippedKeepClear": 40, "skippedOverlap": 18, "budgetHit": false } }`

The plugin clones the named asset, scales it, pivots it to `position` with
`rotationY`, and parents it under `Greeble/<zone id>`. Nothing else is written.

## Jobs: how the two doors reach Studio

Both doors queue a job; the plugin, in Listen mode, carries it out. Map data
goes plugin -> server directly and never through the model.

- `GET /v1/jobs/next` -> `{ "job": { "id", "type": "dress_zone", "params": { "zone", "maxInstances", "seed" } } | null }`. Marks it running.
- `POST /v1/jobs/<id>/result` with `{ "ok": true, "result": { ...stats } }` or `{ "ok": false, "result": { "error": "..." } }`.

Jobs are scoped to the studio key that created them.

## Door 1: MCP (devs with their own agent)

`POST /mcp`, JSON-RPC, same bearer key. Tools:

- `greeble_dress_zone { zone, maxInstances?, seed? }` -> `{ id, status }`
- `greeble_job_status { id }` -> `{ id, status, result }`

## Door 2: chat panel in Studio (devs with no setup)

Not built. It will call a hosted agent that uses the same tools and job queue.
