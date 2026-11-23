import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { route } from "../src/server.js";
import { resetStore } from "../src/store.js";

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
