import test from "node:test";
import assert from "node:assert/strict";
import { validateProfile, validatePlace } from "../src/validate.js";

const profile = () => ({
  zones: [{ label: "Market", area: 100, instances: [
    { assetId: "Barrel", position: [0, 0, 0], scale: 1 },
    { assetId: "Crate", position: [1, 0, 2] },
  ] }],
});
const placeBody = () => ({
  zone: { id: "z1", label: "Market" },
  surface: [{ position: [0, 0, 0], normal: [0, 1, 0] }],
  cell: 4,
  assets: [{ id: "Barrel", footprint: 1.5 }],
  keepClear: [{ min: [0, 0, 0], max: [1, 1, 1] }],
  budget: { maxInstances: 10 },
  maxSlopeDeg: 30,
  seed: 7,
});

const throwsAt = (fn, body, path) => {
  assert.throws(() => fn(body), (err) => {
    assert.equal(err.status, 400);
    assert.ok(err.message.startsWith(`${path}: `), `"${err.message}" should start with "${path}: "`);
    return true;
  });
};

test("valid bodies pass through unchanged", () => {
  const p = profile();
  assert.equal(validateProfile(p), p);
  const q = placeBody();
  assert.equal(validatePlace(q), q);
});

test("unknown extra fields are allowed", () => {
  const p = profile(); p.extra = 1; p.zones[0].other = "x"; p.zones[0].instances[0].rotationY = 2;
  assert.doesNotThrow(() => validateProfile(p));
  const q = placeBody(); q.profile = { assets: {} }; q.zone.foo = true;
  assert.doesNotThrow(() => validatePlace(q));
});

test("missing or non-object body gives a clear message", () => {
  for (const fn of [validateProfile, validatePlace]) {
    for (const bad of [undefined, null, "hi", 3, [1]]) throwsAt(fn, bad, "body");
  }
  assert.throws(() => validateProfile(undefined), /body: missing/);
});

test("bad profile bodies name the field path", () => {
  const cases = [
    [(b) => { delete b.zones; }, "zones"],
    [(b) => { b.zones = []; }, "zones"],
    [(b) => { b.zones[0] = 5; }, "zones[0]"],
    [(b) => { b.zones[0].area = 0; }, "zones[0].area"],
    [(b) => { b.zones[0].label = 3; }, "zones[0].label"],
    [(b) => { b.zones[0].instances = []; }, "zones[0].instances"],
    [(b) => { b.zones[0].instances[1].assetId = ""; }, "zones[0].instances[1].assetId"],
    [(b) => { b.zones[0].instances[1].position = [1, 2]; }, "zones[0].instances[1].position"],
    [(b) => { b.zones[0].instances[0].position = [1, NaN, 2]; }, "zones[0].instances[0].position"],
    [(b) => { b.zones[0].instances[0].scale = -1; }, "zones[0].instances[0].scale"],
  ];
  for (const [mutate, path] of cases) { const b = profile(); mutate(b); throwsAt(validateProfile, b, path); }
  const b = profile(); b.zones[0].instances[1].position = "x";
  assert.throws(() => validateProfile(b), { message: "zones[0].instances[1].position: expected [x, y, z]" });
});

test("bad place bodies name the field path", () => {
  const cases = [
    [(b) => { delete b.zone; }, "zone"],
    [(b) => { b.zone.id = 1; }, "zone.id"],
    [(b) => { b.surface = {}; }, "surface"],
    [(b) => { b.surface[0].normal = [0, 1, Infinity]; }, "surface[0].normal"],
    [(b) => { b.cell = 0; }, "cell"],
    [(b) => { b.assets[0].footprint = "big"; }, "assets[0].footprint"],
    [(b) => { b.assets[0].id = undefined; }, "assets[0].id"],
    [(b) => { b.keepClear[0].max = null; }, "keepClear[0].max"],
    [(b) => { b.budget.maxInstances = 1.5; }, "budget.maxInstances"],
    [(b) => { b.budget.maxInstances = -1; }, "budget.maxInstances"],
    [(b) => { b.maxSlopeDeg = 91; }, "maxSlopeDeg"],
    [(b) => { b.seed = "7"; }, "seed"],
  ];
  for (const [mutate, path] of cases) { const b = placeBody(); mutate(b); throwsAt(validatePlace, b, path); }
});
