import { rng } from "./rng.js";

// Shortest XZ distance from a point to a box's XZ rectangle (0 inside it).
const rectDist = (x, z, b) => {
  const dx = Math.max(b.min[0] - x, 0, x - b.max[0]);
  const dz = Math.max(b.min[2] - z, 0, z - b.max[2]);
  return Math.hypot(dx, dz);
};

/**
 * Baseline placer: no model call. For each asset, aim for the profile's
 * density over the zone's surface, keep clear of paths, avoid overlaps and
 * stop at the budget. The agent layer will later choose and adjust targets;
 * this function stays the thing that enforces the hard rules.
 *
 * Each prop is a circle of radius footprint * scale in XZ. The whole circle
 * stays inside the zone's XZ bounds, off keep-clear boxes, off steep hits and
 * clear of every other prop's circle.
 */
export function place(req) {
  const { surface: hits, cell, assets, keepClear = [], profile, budget = {}, seed = 1, maxSlopeDeg = 35 } = req;
  const rand = rng(seed);
  // XZ bounds of every sampled hit (before the slope filter).
  const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (const h of hits) {
    lo[0] = Math.min(lo[0], h.position[0]); hi[0] = Math.max(hi[0], h.position[0]);
    lo[1] = Math.min(lo[1], h.position[2]); hi[1] = Math.max(hi[1], h.position[2]);
  }
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const max = budget.maxInstances ?? Infinity;
  const stats = { placed: 0, skippedKeepClear: 0, skippedOverlap: 0, skippedSlope: 0, budgetHit: false, tooLarge: [] };
  // Drop steep hits first so density targets use the usable area only.
  // Normals are unit length with Y up, so the slope is acos(normal.y).
  const surface = [];
  const steep = new Map(); // grid bucket -> steep hit positions
  const bucket = cell > 0 ? cell : 1;
  const key = (i, j) => `${i},${j}`;
  for (const hit of hits) {
    const ny = Math.min(1, Math.max(-1, hit.normal?.[1] ?? 1));
    if ((Math.acos(ny) * 180) / Math.PI > maxSlopeDeg) {
      stats.skippedSlope++;
      const k = key(Math.floor(hit.position[0] / bucket), Math.floor(hit.position[2] / bucket));
      if (!steep.has(k)) steep.set(k, []);
      steep.get(k).push(hit.position);
    } else surface.push(hit);
  }
  const coversSteep = (x, z, r) => {
    if (steep.size === 0) return false;
    const i0 = Math.floor((x - r) / bucket), i1 = Math.floor((x + r) / bucket);
    const j0 = Math.floor((z - r) / bucket), j1 = Math.floor((z + r) / bucket);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      for (const s of steep.get(key(i, j)) ?? []) if (Math.hypot(s[0] - x, s[2] - z) <= r) return true;
    }
    return false;
  };
  const placements = [];
  const taken = []; // {x, z, r}
  const area = surface.length * cell * cell;
  const half = Math.min(hi[0] - lo[0], hi[1] - lo[1]) / 2;

  const order = surface.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  // Biggest footprints first so small props fill the gaps.
  // Assets too wide for the zone are left out entirely.
  for (const a of assets) {
    const st = profile?.assets?.[a.id];
    if (st && 2 * a.footprint * st.scaleMax > half) stats.tooLarge.push(a.id);
  }
  stats.tooLarge.sort();
  const sorted = assets.filter((a) => !stats.tooLarge.includes(a.id)).sort((a, b) => b.footprint - a.footprint);
  for (const asset of sorted) {
    const style = profile?.assets?.[asset.id];
    if (!style) continue;
    const target = Math.round(style.density * area);
    const sameGap = Math.max(style.spacing ?? 0, asset.footprint * 2) * 0.6;
    let made = 0;
    const mine = [];
    for (const idx of order) {
      if (made >= target) break;
      if (placements.length >= max) { stats.budgetHit = true; break; }
      const hit = surface[idx];
      // Scale first: the radius drives every check below. Use the rounded
      // scale so the rules hold for the values we return.
      const scale = Math.round((style.scaleMin + rand() * (style.scaleMax - style.scaleMin)) * 1000) / 1000;
      const r = asset.footprint * scale;
      const jitter = cell * 0.4;
      const p = [
        hit.position[0] + (rand() - 0.5) * 2 * jitter,
        hit.position[1],
        hit.position[2] + (rand() - 0.5) * 2 * jitter,
      ].map((n) => Math.round(n * 100) / 100);
      // Clamp after rounding, to bounds rounded inward, so the whole circle sits inside the zone.
      p[0] = clamp(p[0], Math.ceil((lo[0] + r) * 100) / 100, Math.floor((hi[0] - r) * 100) / 100);
      p[2] = clamp(p[2], Math.ceil((lo[1] + r) * 100) / 100, Math.floor((hi[1] - r) * 100) / 100);
      const blocked = keepClear.some((b) =>
        p[1] >= b.min[1] && p[1] <= b.max[1] && rectDist(p[0], p[2], b) <= r);
      if (blocked) { stats.skippedKeepClear++; continue; }
      if (coversSteep(p[0], p[2], r)) { stats.skippedSlope++; continue; }
      const clash =
        taken.some((t) => Math.hypot(t.x - p[0], t.z - p[2]) < t.r + r) ||
        mine.some((t) => Math.hypot(t.x - p[0], t.z - p[2]) < sameGap);
      if (clash) { stats.skippedOverlap++; continue; }
      const spot = { x: p[0], z: p[2], r };
      taken.push(spot); mine.push(spot);
      placements.push({
        assetId: asset.id,
        position: p,
        rotationY: Math.round(rand() * Math.PI * 2 * 1000) / 1000,
        scale,
      });
      made++;
    }
    if (stats.budgetHit) break;
  }
  stats.placed = placements.length;
  return { placements, stats };
}
