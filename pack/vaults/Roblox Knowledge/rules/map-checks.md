# Map checks

- Every number comes from the game's own config (jump height, walk speed), and every guess is listed in the report.
- Nine raycast checks:
  1. floating platforms
  2. tops you can't stand on
  3. unreachable high ground
  4. reachable-but-shouldn't
  5. fall pockets with no way out
  6. sightlines too open or closed
  7. overlapping parts
  8. unevenly spaced rings
  9. falls shorter than ragdoll recovery
- Parts alone look AI-made, so use meshes.
- 20k triangles max per mesh.
