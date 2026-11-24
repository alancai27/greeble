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

/** XZ distance from instance a to its k-th nearest other instance in list. */
const kthNearest = (a, list, k) =>
  list.filter((b) => b !== a).map((b) => dist2d(a.position, b.position)).sort((x, y) => x - y)[k - 1];

/**
 * Ground the instances actually cover, from local density: r = XZ distance to the
 * 6th-nearest neighbour, local density = 5 / (pi r^2), area = instances / median
 * local density, capped at the bounding box. Fewer than 7 instances: bounding box.
 */
export const learnedArea = (instances) => {
  const box = bboxArea(instances);
  if (instances.length < 7) return box;
  const dens = instances.map((a) => 5 / (Math.PI * kthNearest(a, instances, 6) ** 2));
  return Math.min(box, instances.length / median(dens));
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
