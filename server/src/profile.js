const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const dist2d = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** Nearest-rank percentile (q in 0..1) of a list; 0 when empty. */
const percentile = (xs, q) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil(q * s.length) - 1)];
};
/** XZ distance from instance a to its nearest other instance in list; Infinity if none. */
const nearestIn = (a, list) => {
  let best = Infinity;
  for (const b of list) if (a !== b) best = Math.min(best, dist2d(a.position, b.position));
  return best;
};

/** Build a style profile from the instances of a finished map. */
export function learnProfile({ instances, area }) {
  if (!(area > 0)) throw new Error("area must be positive");
  const byAsset = new Map();
  for (const i of instances) {
    if (!byAsset.has(i.assetId)) byAsset.set(i.assetId, []);
    byAsset.get(i.assetId).push(i);
  }
  const assets = {};
  for (const [id, list] of byAsset) {
    const scales = list.map((i) => i.scale ?? 1);
    const nearest = list.map((a) => nearestIn(a, list)).filter((d) => d < Infinity);
    const nearAny = list.map((a) => nearestIn(a, instances)).filter((d) => d < Infinity);
    assets[id] = {
      density: list.length / area,
      scaleMin: Math.min(...scales),
      scaleMax: Math.max(...scales),
      spacing: median(nearest),
      clearance: percentile(nearAny, 0.1),
    };
  }
  return { assets };
}

/** Normalise a zone label: trimmed, lowercased; missing or "" -> "default". */
export const zoneKey = (label) => (typeof label === "string" && label.trim().toLowerCase()) || "default";

/** XZ bounding-box area of a list of instances. */
const bboxArea = (instances) => {
  if (!instances.length) return 0;
  const xs = instances.map((i) => i.position[0]);
  const zs = instances.map((i) => i.position[2]);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
};

/**
 * Ground the instances actually cover: a square grid over their XZ positions with
 * cell = clamp(3 * median nearest-neighbour distance, 4, 100); area is the occupied
 * cells' area, capped at the bounding box.
 */
export const learnedArea = (instances) => {
  const box = bboxArea(instances);
  if (!instances.length) return box;
  const nn = instances.map((a) => nearestIn(a, instances)).filter((d) => d < Infinity);
  const cell = Math.min(100, Math.max(4, 3 * median(nn)));
  const x0 = Math.min(...instances.map((i) => i.position[0]));
  const z0 = Math.min(...instances.map((i) => i.position[2]));
  const cells = new Set(instances.map((i) =>
    `${Math.floor((i.position[0] - x0) / cell)},${Math.floor((i.position[2] - z0) / cell)}`));
  return Math.min(box, cells.size * cell * cell);
};

/** Learn one ZoneStyle per zone label from a ProfileRequest. */
export function learnZones({ zones } = {}) {
  if (!Array.isArray(zones)) throw new Error("zones must be an array");
  const out = {};
  for (const z of zones) {
    const instances = z.instances ?? [];
    out[zoneKey(z.label)] = learnProfile({ instances, area: z.area ?? learnedArea(instances) });
  }
  return out;
}
