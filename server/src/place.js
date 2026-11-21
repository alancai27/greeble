import { rng } from "./rng.js";

const inBox = (p, b) =>
  p[0] >= b.min[0] && p[0] <= b.max[0] &&
  p[1] >= b.min[1] && p[1] <= b.max[1] &&
  p[2] >= b.min[2] && p[2] <= b.max[2];

/**
 * Baseline placer: no model call. For each asset, aim for the profile's
 * density over the zone's surface, keep clear of paths, avoid overlaps and
 * stop at the budget. The agent layer will later choose and adjust targets;
 * this function stays the thing that enforces the hard rules.
 */
export function place(req) {
  const { surface, cell, assets, keepClear = [], profile, budget = {}, seed = 1 } = req;
  const rand = rng(seed);
  const max = budget.maxInstances ?? Infinity;
  const stats = { placed: 0, skippedKeepClear: 0, skippedOverlap: 0, budgetHit: false };
  const placements = [];
  const taken = []; // {x, z, r}
  const area = surface.length * cell * cell;

  const order = surface.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  // Biggest footprints first so small props fill the gaps.
  const sorted = [...assets].sort((a, b) => b.footprint - a.footprint);
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
      const jitter = cell * 0.4;
      // Round before the checks so the rules hold for the values we return.
      const p = [
        hit.position[0] + (rand() - 0.5) * 2 * jitter,
        hit.position[1],
        hit.position[2] + (rand() - 0.5) * 2 * jitter,
      ].map((n) => Math.round(n * 100) / 100);
      if (keepClear.some((b) => inBox(p, b))) { stats.skippedKeepClear++; continue; }
      const clash =
        taken.some((t) => Math.hypot(t.x - p[0], t.z - p[2]) < t.r + asset.footprint) ||
        mine.some((t) => Math.hypot(t.x - p[0], t.z - p[2]) < sameGap);
      if (clash) { stats.skippedOverlap++; continue; }
      const scale = style.scaleMin + rand() * (style.scaleMax - style.scaleMin);
      const spot = { x: p[0], z: p[2], r: asset.footprint * scale };
      taken.push(spot); mine.push(spot);
      placements.push({
        assetId: asset.id,
        position: p,
        rotationY: Math.round(rand() * Math.PI * 2 * 1000) / 1000,
        scale: Math.round(scale * 1000) / 1000,
      });
      made++;
    }
    if (stats.budgetHit) break;
  }
  stats.placed = placements.length;
  return { placements, stats };
}
