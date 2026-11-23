const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const dist2d = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

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
    const nearest = [];
    for (const a of list) {
      let best = Infinity;
      for (const b of list) if (a !== b) best = Math.min(best, dist2d(a.position, b.position));
      if (best < Infinity) nearest.push(best);
    }
    assets[id] = {
      density: list.length / area,
      scaleMin: Math.min(...scales),
      scaleMax: Math.max(...scales),
      spacing: median(nearest),
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

/** Learn one ZoneStyle per zone label from a ProfileRequest. */
export function learnZones({ zones } = {}) {
  if (!Array.isArray(zones)) throw new Error("zones must be an array");
  const out = {};
  for (const z of zones) {
    const instances = z.instances ?? [];
    out[zoneKey(z.label)] = learnProfile({ instances, area: z.area ?? bboxArea(instances) });
  }
  return out;
}
