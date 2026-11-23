import test from "node:test";
import assert from "node:assert/strict";
import { learnProfile } from "../src/profile.js";
import { place } from "../src/place.js";

const grid = (n, cell) => {
  const pts = [];
  for (let x = 0; x < n; x++) for (let z = 0; z < n; z++)
    pts.push({ position: [x * cell, 0, z * cell], normal: [0, 1, 0] });
  return pts;
};
const example = [];
for (let i = 0; i < 40; i++) example.push({ assetId: "Barrel", position: [(i % 8) * 8, 0, Math.floor(i / 8) * 8], scale: 1 + (i % 3) * 0.1 });
for (let i = 0; i < 4; i++) example.push({ assetId: "Tree", position: [i * 30, 0, 50], scale: 1 });
const profile = learnProfile({ instances: example, area: 64 * 64 });
const base = {
  surface: grid(32, 4), cell: 4, profile, seed: 7,
  assets: [{ id: "Barrel", footprint: 1.5 }, { id: "Tree", footprint: 5 }],
};

test("profile records density, scale range and spacing", () => {
  assert.equal(profile.assets.Barrel.density, 40 / 4096);
  assert.equal(profile.assets.Barrel.scaleMin, 1);
  assert.equal(profile.assets.Barrel.scaleMax, 1.2);
  assert.equal(profile.assets.Barrel.spacing, 8);
});

test("placement density tracks the profile", () => {
  const { placements } = place(base);
  const barrels = placements.filter((p) => p.assetId === "Barrel").length;
  const want = Math.round(profile.assets.Barrel.density * 32 * 32 * 16);
  assert.ok(Math.abs(barrels - want) <= want * 0.1, `${barrels} vs ${want}`);
});

test("nothing lands in a keep-clear box", () => {
  const box = { min: [40, -5, -10], max: [60, 5, 140] };
  const { placements, stats } = place({ ...base, keepClear: [box] });
  assert.ok(stats.skippedKeepClear > 0);
  for (const p of placements) assert.ok(!(p.position[0] >= 40 && p.position[0] <= 60));
});

test("different assets never overlap footprints", () => {
  const { placements } = place(base);
  const r = { Barrel: 1.5, Tree: 5 };
  for (const a of placements) for (const b of placements) {
    if (a === b || a.assetId === b.assetId) continue;
    const d = Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]);
    assert.ok(d >= Math.min(r[a.assetId], r[b.assetId]), `overlap ${d}`);
  }
});

test("budget caps the count and same seed repeats", () => {
  const a = place({ ...base, budget: { maxInstances: 10 } });
  assert.equal(a.placements.length, 10);
  assert.equal(a.stats.budgetHit, true);
  assert.deepEqual(place(base), place(base));
});

// Half the grid (x >= 64) tilted 60 degrees about the Z axis.
const tilt = (60 * Math.PI) / 180;
const halfSteep = base.surface.map((h) =>
  h.position[0] >= 64 ? { ...h, normal: [Math.sin(tilt), Math.cos(tilt), 0] } : h);
const steepCount = halfSteep.filter((h) => h.position[0] >= 64).length;

test("nothing lands on steep ground and the count halves", () => {
  const flat = place(base);
  const { placements, stats } = place({ ...base, surface: halfSteep });
  assert.equal(stats.skippedSlope, steepCount);
  for (const p of placements) assert.ok(p.position[0] < 64, `on slope at ${p.position[0]}`);
  const ratio = placements.length / flat.placements.length;
  assert.ok(ratio > 0.4 && ratio < 0.6, `ratio ${ratio}`);
});

test("maxSlopeDeg 90 keeps the old placements", () => {
  const open = place({ ...base, surface: halfSteep, maxSlopeDeg: 90 });
  assert.equal(open.stats.skippedSlope, 0);
  assert.deepEqual(open.placements, place(base).placements);
});

test("placements stay inside the sampled zone's XZ bounds", () => {
  const xs = base.surface.map((h) => h.position[0]);
  const zs = base.surface.map((h) => h.position[2]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  for (const seed of [1, 2, 3, 7, 42, 99]) {
    const { placements } = place({ ...base, seed });
    assert.ok(placements.length > 0);
    for (const { position: [x, , z] } of placements) {
      assert.ok(x >= x0 && x <= x1 && z >= z0 && z <= z1, `seed ${seed}: out at ${x}, ${z}`);
    }
  }
});

// Footprint rules: every prop is a circle of radius footprint * scale in XZ.
const seeds = [1, 2, 3, 7, 42, 99];
const eps = 1e-9;
// Barrels at 0.5..2 scale so neighbouring circles have mixed radii.
const mixed = learnProfile({
  instances: [
    ...Array.from({ length: 60 }, (_, i) => ({ assetId: "Barrel", position: [(i % 10) * 6, 0, Math.floor(i / 10) * 6], scale: 0.5 + (i % 4) * 0.5 })),
    ...Array.from({ length: 6 }, (_, i) => ({ assetId: "Tree", position: [i * 20, 0, 60], scale: 0.8 + (i % 2) * 0.4 })),
  ],
  area: 64 * 64,
});
const mixedBase = { ...base, profile: mixed };
const fp = { Barrel: 1.5, Tree: 5, Tower: 20 };
const radius = (p) => fp[p.assetId] * p.scale;
const rectDist = (x, z, b) => Math.hypot(Math.max(b.min[0] - x, 0, x - b.max[0]), Math.max(b.min[2] - z, 0, z - b.max[2]));

test("no circle crosses the zone bounds", () => {
  for (const seed of seeds) {
    const { placements } = place({ ...mixedBase, seed });
    assert.ok(placements.length > 0);
    for (const p of placements) {
      const [x, , z] = p.position, r = radius(p);
      assert.ok(x - r >= -eps && x + r <= 124 + eps && z - r >= -eps && z + r <= 124 + eps,
        `seed ${seed}: ${p.assetId} r ${r} at ${x}, ${z}`);
    }
  }
});

test("no circle touches a keep-clear box", () => {
  const box = { min: [40, -5, -10], max: [60, 5, 140] };
  for (const seed of seeds) {
    const { placements, stats } = place({ ...mixedBase, seed, keepClear: [box] });
    assert.ok(stats.skippedKeepClear > 0 && placements.length > 0);
    for (const p of placements) {
      const d = rectDist(p.position[0], p.position[2], box);
      assert.ok(d > radius(p), `seed ${seed}: ${p.assetId} r ${radius(p)} is ${d} from the box`);
    }
  }
});

test("a keep-clear box above the props' height does not block them", () => {
  const box = { min: [40, 10, -10], max: [60, 20, 140] };
  const a = place({ ...mixedBase, keepClear: [box] });
  assert.equal(a.stats.skippedKeepClear, 0);
  assert.deepEqual(a.placements, place(mixedBase).placements);
});

test("no circle covers a steep hit", () => {
  const steep = halfSteep.filter((h) => h.position[0] >= 64).map((h) => h.position);
  for (const seed of seeds) {
    const { placements, stats } = place({ ...mixedBase, seed, surface: halfSteep });
    assert.ok(stats.skippedSlope >= steepCount && placements.length > 0);
    for (const p of placements) for (const s of steep) {
      const d = Math.hypot(p.position[0] - s[0], p.position[2] - s[2]);
      assert.ok(d > radius(p), `seed ${seed}: ${p.assetId} covers steep hit at ${s[0]}, ${s[2]}`);
    }
  }
});

test("no two circles overlap, with mixed scales", () => {
  for (const seed of seeds) {
    const { placements } = place({ ...mixedBase, seed });
    assert.ok(new Set(placements.map((p) => p.scale)).size > 3, "scales should vary");
    for (let i = 0; i < placements.length; i++) for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i], b = placements[j];
      const d = Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]);
      assert.ok(d >= radius(a) + radius(b) - eps, `seed ${seed}: overlap ${d} < ${radius(a) + radius(b)}`);
    }
  }
});

test("an asset wider than the zone's shorter side is left out and reported", () => {
  // Zone is 124 wide. A Tower of footprint 20 at scale 3.2 is 128 wide: too large.
  // An Arch at scale 1.6 is 64 wide: over half the side, but it now fits.
  const big = { ...mixed, assets: { ...mixed.assets, Tower: { density: 4 / 4096, scaleMin: 3.2, scaleMax: 3.2, spacing: 0 }, Arch: { density: 1 / 4096, scaleMin: 1.6, scaleMax: 1.6, spacing: 0 } } };
  const assets = [...base.assets, { id: "Tower", footprint: 20 }, { id: "Arch", footprint: 20 }];
  for (const seed of seeds) {
    const { placements, stats } = place({ ...mixedBase, profile: big, assets, seed });
    assert.deepEqual(stats.tooLarge, ["Tower"]);
    assert.ok(!placements.some((p) => p.assetId === "Tower"));
    assert.ok(placements.some((p) => p.assetId === "Arch"), `seed ${seed}: no Arch`);
    assert.ok(placements.filter((p) => p.assetId === "Barrel").length > 0);
  }
  assert.deepEqual(place({ ...mixedBase, seed: 3 }).stats.tooLarge, []);
});

// Hand-built styles with clearance: crowns overlap like a real forest.
const forestFp = { Pine: 5, Bush: 2 };
const forestAssets = [{ id: "Pine", footprint: 5 }, { id: "Bush", footprint: 2 }];
const forest = (pine, bush) => ({ assets: {
  Pine: { density: 300 / 16384, scaleMin: 0.9, scaleMax: 1.1, spacing: 4, clearance: 3, ...pine },
  Bush: { density: 200 / 16384, scaleMin: 0.8, scaleMax: 1.2, spacing: 3, clearance: 2, ...bush },
} });
const forestReq = (profile, seed) => ({ surface: grid(32, 4), cell: 4, profile, seed, assets: forestAssets });
const pairs = (placements, fn) => {
  for (let i = 0; i < placements.length; i++) for (let j = i + 1; j < placements.length; j++) {
    const a = placements[i], b = placements[j];
    fn(a, b, Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]));
  }
};

test("clearance under the footprints lets an asset reach its density target", () => {
  const target = Math.round(forest().assets.Pine.density * 1024 * 16);
  for (const seed of seeds) {
    const count = (profile) => place(forestReq(profile, seed)).placements.filter((p) => p.assetId === "Pine").length;
    assert.equal(count(forest()), target, `seed ${seed}`);
    assert.ok(count(forest({ clearance: 0 }, { clearance: 0 })) < target * 0.6, `seed ${seed}: circles alone reach it`);
  }
});

test("spacing between props follows clearance and spacing", () => {
  const profile = forest({ clearance: 6, spacing: 7 }, { clearance: 3, spacing: 4 });
  for (const seed of seeds) {
    const { placements } = place(forestReq(profile, seed));
    assert.ok(placements.some((p) => p.assetId === "Bush") && placements.some((p) => p.assetId === "Pine"));
    pairs(placements, (a, b, d) => {
      const ra = forestFp[a.assetId] * a.scale, rb = forestFp[b.assetId] * b.scale;
      const sa = profile.assets[a.assetId], sb = profile.assets[b.assetId];
      const min = a.assetId === b.assetId ? 0.6 * sa.spacing : Math.min(ra + rb, (sa.clearance + sb.clearance) / 2);
      assert.ok(d >= min - eps, `seed ${seed}: ${a.assetId}-${b.assetId} at ${d} < ${min}`);
    });
  }
});

test("clearance 0 or missing keeps circles from overlapping", () => {
  const { clearance: _p, ...pine } = forest().assets.Pine;
  const { clearance: _b, ...bush } = forest().assets.Bush;
  for (const profile of [forest({ clearance: 0 }, { clearance: 0 }), { assets: { Pine: pine, Bush: bush } }, forest({ clearance: 0 })]) {
    for (const seed of seeds) {
      const { placements } = place(forestReq(profile, seed));
      assert.ok(placements.length > 0);
      pairs(placements, (a, b, d) => {
        const ra = forestFp[a.assetId] * a.scale, rb = forestFp[b.assetId] * b.scale;
        const free = a.assetId === b.assetId && profile.assets[a.assetId].clearance > 0;
        if (!free) assert.ok(d >= ra + rb - eps, `seed ${seed}: ${a.assetId}-${b.assetId} overlap ${d}`);
      });
    }
  }
});

test("same seed still gives the same result with footprint rules", () => {
  const req = { ...mixedBase, surface: halfSteep, keepClear: [{ min: [40, -5, -10], max: [60, 5, 140] }] };
  assert.deepEqual(place(req), place(req));
});
