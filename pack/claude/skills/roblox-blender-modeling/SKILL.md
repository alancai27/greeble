---
name: roblox-blender-modeling
description: Use when a Roblox dev is modeling in Blender for Roblox or is about to export, i.e. "is this model ready for Roblox", "check my Blender file", "export to FBX for Studio", or "my mesh is too heavy". A quality gate on symmetry, triangle and texture budgets, transforms and a clean FBX export.
---

# Blender modeling: a quality gate before export

You check a Blender model against what Roblox accepts, then export it
cleanly. Game-design and map rules live in the Roblox Knowledge vault at
`<VAULTS>/Roblox Knowledge/rules/`; point there instead of restating them.
Import into Studio is the `roblox-asset-import` skill's job.

## When to use it

- A model is finished in Blender and headed for Studio.
- An import came out too heavy, wrong scale or with broken textures.

## Steps

1. **Ask the role.** Prop, building piece, or character part? Avatar items
   have their own budgets in the Roblox avatar specifications; check those
   instead of the numbers here.
2. **Symmetry.** For symmetric objects, model half and use a Mirror
   modifier. Before export, apply it and merge vertices on the seam so no
   doubled faces remain.
3. **Geometry.** Watertight, no zero-thickness faces, no stray loose
   vertices. Prefer quads; avoid n-gons. Recalculate normals outward and
   check with face orientation overlay.
4. **Triangle budget.** Turn on the statistics overlay and read the
   triangle count per object. Each mesh must stay under 20,000 triangles.
   Aim far lower for props that appear many times. Decimate or split if
   over.
5. **UVs and textures.** One UV map per mesh, all islands inside 0 to 1.
   Texture size up to 4096, but size by object: about 256 for a 5-stud
   prop, 512 for 10 studs, 1024 for 20 studs. Normal maps in OpenGL
   tangent space. One material per mesh.
6. **Transforms.** Apply rotation and scale so each object reads rotation
   0 and scale 1. Put the origin where the model meets the ground. For
   rigs, root bone at 0,0,0 and no more than 4 bone influences per vertex.
7. **Names.** Name every object; the names become MeshPart names in
   Studio.
8. **Export FBX.** File > Export > FBX. Path Mode: Copy, with Embed
   Textures on. Transform: Apply Scalings set to FBX Unit Scale. Armature:
   Add Leaf Bones off. Bake Animation off unless the file has keyframed
   animation. Export selected objects only if the scene has helpers.
9. **Hand off.** Tell the dev the file path, the triangle count per mesh
   and anything you deferred, then use `roblox-asset-import`.

## Working in Blender

- If you can run Blender from the shell, read counts and transforms with a
  read-only Python script first, and report before changing the file.
- Never overwrite the dev's `.blend`. Save changes to a copy unless they
  say otherwise.

## Ask first

- Installing Blender, add-ons or any Roblox plugin.
- Applying modifiers or decimating, since both are destructive.
- Uploading or publishing anything to Roblox.

## Finish checklist

- [ ] Role confirmed; avatar items checked against avatar specs
- [ ] Mirror applied, seam merged, no doubled faces
- [ ] Watertight, normals outward, no n-gons left
- [ ] Every mesh under 20,000 triangles
- [ ] One UV map in 0 to 1; textures sized by object; OpenGL normals
- [ ] Rotation 0, scale 1, origin at the base
- [ ] FBX exported with embedded textures and FBX Unit Scale
- [ ] Dev told the path and counts
