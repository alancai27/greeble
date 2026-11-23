# Model pipeline

1. Flux image; Claude looks and regenerates until it's good.
2. Hi3DGen mesh; check it from every angle.
3. Headless Blender decimate from ~1M triangles to 6–10k. Roblox's limit is 20k per mesh.
4. Bake a normal map from high-poly to low-poly; paint colour from a small spec.
5. Build hard-edged props (crates, guns) directly in Blender.
6. Upload with Open Cloud as a Model (`.glb`/`.fbx`, max 20 MB); ask the dev first.

Before import, check triangle count, scale, pivot and texture.

Tools: Flux Schnell via Cloudflare Workers AI (developers.cloudflare.com/workers-ai), Hi3DGen (github.com/Stable-X/Hi3DGen), Blender (blender.org), Roblox Open Cloud (create.roblox.com/docs/cloud). Keys: see `setup/accounts-and-keys.md`.
