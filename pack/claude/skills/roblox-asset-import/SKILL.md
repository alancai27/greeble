---
name: roblox-asset-import
description: Use when a Roblox dev is bringing an FBX, GLB/glTF or OBJ model into Studio, i.e. "import this model", "my mesh is huge/tiny", "the pivot is wrong", "players walk through it", "the textures are missing", or "is this too many triangles". Walks the 3D Importer settings, then checks scale, pivot, collision, triangle budget and PBR textures.
---

# Asset import: get a mesh into Studio right the first time

Most import problems are scale, pivot, collision or textures. Fix them at
import, not with scripts afterwards. Performance and map rules live in the
Roblox Knowledge vault at `<VAULTS>/Roblox Knowledge/rules/`
(`map-checks.md`); point the dev there instead of restating them.

If the `rbx-import-asset` skill is installed, it owns uploading through
Open Cloud. This skill covers the Studio import and the checks after it.

## Before importing

1. **Format.** The 3D Importer takes `.fbx`, `.obj` and `.gltf`. Only FBX
   and glTF carry multiple meshes, rigs and PBR textures. Prefer FBX or
   glTF; use OBJ for a single static mesh.
2. **Triangles.** One mesh can't exceed 20,000 triangles. Ask the source
   tool for the count. Over the limit: split the mesh or decimate it (see
   the `roblox-blender-modeling` skill).
3. **Textures.** Max 4096x4096; scale by object size (about 256 for a
   5-stud prop, 512 for 10 studs, 1024 for 20 studs). Normal maps must be
   OpenGL tangent space. One UV set, inside 0 to 1.

## Import steps

1. Open **File > Import** in Studio and pick the file.
2. **Upload to Roblox is on by default** and creates a new asset in the
   dev's inventory. Ask the dev before leaving it on; turn it off for a
   test import. Confirm the **Creator** (user or group) with them.
3. **Scale.** Check the preview against the Roblox character in the
   importer. If it's off by 100x or so, change **Scale Unit** to match the
   source tool rather than resizing after.
4. **Orientation.** Fix a model lying on its side with **World Forward**
   and **World Up**.
5. **Pivot.** Turn on **Set Pivot to Scene Origin** if the source origin
   sits at the model's base, or **Use Imported Pivot** per object.
6. **Anchored** on for scenery. **Merge Meshes** only for props that never
   move apart.
7. Import, then run the checks below.

## After importing

- **Pivot.** `Model.WorldPivot` (or `PVInstance:GetPivot()`) should be at
  the base where the model meets the ground, so `PivotTo` places it
  cleanly. Adjust with the Pivot tool if not.
- **Size.** `Model:GetExtentsSize()` should match the real size in studs.
  Use `Model:ScaleTo(factor)` only as a last resort; re-import is cleaner.
- **Collision fidelity.** Set `CollisionFidelity` on each MeshPart in the
  Properties window, lowest that works: `Box` for small or background
  props, `Hull` for shallow shapes, `Default` for walkable concave shapes,
  `PreciseConvexDecomposition` only where players need exact contact. It
  costs the most. Check with the viewport's Collision fidelity
  visualization.
- **No collision needed?** Turn `CanCollide` and `CanTouch` off.
- **PBR.** Textures go in a `SurfaceAppearance` under the MeshPart:
  `ColorMap`, `NormalMap`, `RoughnessMap`, `MetalnessMap`. If they're
  missing, the export didn't embed them; re-export or add them by hand.

## Ask first

- Leaving **Upload to Roblox** on, choosing a group as Creator, or any
  publish. Installing plugins or tools on the dev's machine.

## Finish checklist

- [ ] Each mesh under 20,000 triangles
- [ ] Upload and Creator choices confirmed with the dev
- [ ] Scale matches a character; model upright
- [ ] Pivot at the base; `GetExtentsSize` is the intended size
- [ ] Lowest working collision fidelity set and visualized
- [ ] Scenery anchored; non-colliding props have collision off
- [ ] PBR maps present in a SurfaceAppearance, normals look right
