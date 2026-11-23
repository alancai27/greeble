import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { route } from "../src/server.js";
import { resetStore } from "../src/store.js";
import { learnZones, learnedArea } from "../src/profile.js";

const grid = (n, cell) => {
  const pts = [];
  for (let x = 0; x < n; x++) for (let z = 0; z < n; z++)
    pts.push({ position: [x * cell, 0, z * cell], normal: [0, 1, 0] });
  return pts;
};
const row = (assetId, n, step) =>
  Array.from({ length: n }, (_, i) => ({ assetId, position: [(i % 4) * step, 0, Math.floor(i / 4) * step] }));
const post = (key, url, body) => route(key, "POST", url, body);
const placeReq = (label) => ({
  surface: grid(16, 4), cell: 4, seed: 3, zone: { id: "z1", label },
  assets: [{ id: "Barrel", footprint: 1 }, { id: "Tree", footprint: 3 }],
});
const count = (out, id) => out.placements.filter((p) => p.assetId === id).length;

beforeEach(() => resetStore());

test("two labels are stored, normalised, with bbox area when omitted", () => {
  const [code, { profile }] = post("a", "/v1/profile", { zones: [
    { label: "  Market ", area: 100, instances: row("Barrel", 8, 4) },
    { instances: row("Tree", 8, 10) },
  ] });
  assert.equal(code, 200);
  assert.deepEqual(Object.keys(profile.zones).sort(), ["default", "market"]);
  assert.equal(profile.zones.market.assets.Barrel.density, 8 / 100);
  assert.equal(profile.zones.default.assets.Tree.density, 8 / (30 * 10));
  assert.deepEqual(route("a", "GET", "/v1/profile")[1].profile, profile);
});

test("a second POST replaces only the labels it sends", () => {
  post("a", "/v1/profile", { zones: [
    { label: "market", area: 100, instances: row("Barrel", 8, 4) },
    { label: "forest", area: 100, instances: row("Tree", 8, 4) },
  ] });
  const [, { profile }] = post("a", "/v1/profile", { zones: [{ label: "Market", area: 200, instances: row("Tree", 4, 4) }] });
  assert.deepEqual(Object.keys(profile.zones.market.assets), ["Tree"]);
  assert.equal(profile.zones.forest.assets.Tree.density, 8 / 100);
});

test("key A never sees key B's profile", () => {
  post("b", "/v1/profile", { zones: [{ label: "market", area: 100, instances: row("Barrel", 8, 4) }] });
  assert.equal(route("a", "GET", "/v1/profile")[1].profile, null);
  assert.equal(post("a", "/v1/place", placeReq("market"))[0], 409);
});

test("place with no stored profile is 409", () => {
  const [code, body] = post("a", "/v1/place", placeReq("market"));
  assert.equal(code, 409);
  assert.equal(typeof body.error, "string");
});

test("place uses the zone's style, falls back to default, ignores a client profile", () => {
  post("a", "/v1/profile", { zones: [
    { label: "market", area: 64, instances: row("Barrel", 8, 2) },
    { label: "", area: 64, instances: row("Tree", 8, 4) },
  ] });
  const market = post("a", "/v1/place", placeReq("Market"))[1];
  assert.ok(count(market, "Barrel") > 0);
  assert.equal(count(market, "Tree"), 0);
  const other = post("a", "/v1/place", { ...placeReq("docks"), profile: { assets: { Barrel: { density: 1, scaleMin: 1, scaleMax: 1, spacing: 1 } } } })[1];
  assert.equal(count(other, "Barrel"), 0);
  assert.ok(count(other, "Tree") > 0);
  const none = post("a", "/v1/place", { ...placeReq(), zone: { id: "z2" } })[1];
  assert.ok(count(none, "Tree") > 0);
});

test("no-profile error names the looked-up label and the learned labels", () => {
  post("a", "/v1/profile", { zones: [{ label: "market", area: 100, instances: row("Barrel", 8, 4) }] });
  const [code, body] = post("a", "/v1/place", { ...placeReq(), zone: { id: "z2" } });
  assert.equal(code, 409);
  assert.equal(body.error, 'no profile for label "default"; learned labels: market');
});

test("no-profile error says none when nothing is learned", () => {
  const [code, body] = post("a", "/v1/place", placeReq("  Docks "));
  assert.equal(code, 409);
  assert.equal(body.error, 'no profile for label "docks"; learned labels: none');
  assert.ok(body.error.endsWith("learned labels: none"));
});

test("no-profile error never names another key's labels", () => {
  post("b", "/v1/profile", { zones: [
    { label: "market", area: 100, instances: row("Barrel", 8, 4) },
    { label: "forest", area: 100, instances: row("Tree", 8, 4) },
  ] });
  post("a", "/v1/profile", { zones: [{ label: "harbor", area: 100, instances: row("Barrel", 8, 4) }] });
  const [code, body] = post("a", "/v1/place", placeReq("market"));
  assert.equal(code, 409);
  assert.equal(body.error, 'no profile for label "market"; learned labels: harbor');
  assert.ok(!body.error.includes("forest"));
});

test("stats.label names the zone's own label when it has a style", () => {
  post("a", "/v1/profile", { zones: [{ label: "market", area: 64, instances: row("Barrel", 8, 2) }] });
  assert.equal(post("a", "/v1/place", placeReq("Market"))[1].stats.label, "market");
});

test("stats.label is default when the zone's label fell back", () => {
  post("a", "/v1/profile", { zones: [{ area: 64, instances: row("Tree", 8, 4) }] });
  assert.equal(post("a", "/v1/place", placeReq("market"))[1].stats.label, "default");
});

test("stats.label is default for a zone with no label", () => {
  post("a", "/v1/profile", { zones: [
    { label: "market", area: 64, instances: row("Barrel", 8, 2) },
    { area: 64, instances: row("Tree", 8, 4) },
  ] });
  assert.equal(post("a", "/v1/place", { ...placeReq(), zone: { id: "z2" } })[1].stats.label, "default");
});

const block = (assetId, n, step, x0, z0) => {
  const pts = [];
  for (let x = 0; x < n; x++) for (let z = 0; z < n; z++)
    pts.push({ assetId, position: [x0 + x * step, 0, z0 + z * step] });
  return pts;
};
const bbox = (list) => {
  const xs = list.map((i) => i.position[0]), zs = list.map((i) => i.position[2]);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
};

test("two tight groups far apart learn far less area than the bounding box", () => {
  const instances = [...block("Tree", 5, 2, 0, 0), ...block("Tree", 5, 2, 500, 500)];
  const area = learnedArea(instances);
  assert.ok(area < bbox(instances) / 100, `area ${area}`);
  const { default: z } = learnZones({ zones: [{ instances }] });
  assert.equal(z.assets.Tree.density, 50 / area);
  assert.ok(z.assets.Tree.density > 100 * (50 / bbox(instances)));
});

test("an evenly filled square learns about its bounding box, never more", () => {
  const even = block("Tree", 20, 5, 0, 0);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const jitter = Array.from({ length: 400 }, () => ({ assetId: "Tree", position: [rnd() * 100, 0, rnd() * 100] }));
  for (const list of [even, jitter]) {
    const area = learnedArea(list), box = bbox(list);
    assert.ok(area <= box && area >= 0.8 * box, `area ${area} box ${box}`);
  }
});

test("clearance is the 10th-percentile nearest-any-neighbour distance; 0 alone", () => {
  const instances = [];
  for (let i = 0; i < 20; i++) {
    instances.push({ assetId: "Barrel", position: [i * 100, 0, 0] });
    instances.push({ assetId: "Tree", position: [i * 100, 0, i + 1] });
  }
  const { default: z } = learnZones({ zones: [{ area: 1000, instances }] });
  assert.equal(z.assets.Barrel.clearance, 2);
  assert.equal(z.assets.Tree.clearance, 2);
  assert.equal(z.assets.Barrel.spacing, 100);
  const one = learnZones({ zones: [{ area: 10, instances: [{ assetId: "Rock", position: [1, 0, 1] }] }] });
  assert.equal(one.default.assets.Rock.clearance, 0);
});

test("a given area is used exactly", () => {
  const instances = [...block("Tree", 5, 2, 0, 0), ...block("Tree", 5, 2, 500, 500)];
  const { default: z } = learnZones({ zones: [{ area: 1234, instances }] });
  assert.equal(z.assets.Tree.density, 50 / 1234);
});
