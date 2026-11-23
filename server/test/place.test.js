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
