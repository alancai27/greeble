import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { makeHandler } from "../src/server.js";
import { resetStore } from "../src/store.js";

let server, base;
before(async () => {
  server = http.createServer(makeHandler(new Set(["k1"])));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((r) => server.close(r)));
beforeEach(() => resetStore());

const call = async (method, path, body, { key = "k1", raw } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  return [res.status, await res.json().catch(() => undefined)];
};

const grid = (n, cell) => {
  const pts = [];
  for (let x = 0; x < n; x++) for (let z = 0; z < n; z++)
    pts.push({ position: [x * cell, 0, z * cell], normal: [0, 1, 0] });
  return pts;
};
const profileBody = {
  zones: [{ label: "market", area: 64, instances: Array.from({ length: 8 }, (_, i) =>
    ({ assetId: "Barrel", position: [(i % 4) * 2, 0, Math.floor(i / 4) * 2] })) }],
};
const placeBody = {
  surface: grid(16, 4), cell: 4, seed: 3, zone: { id: "z1", label: "market" },
  assets: [{ id: "Barrel", footprint: 1 }],
};

test("wrong key is 401", async () => {
  const [code, body] = await call("GET", "/v1/profile", undefined, { key: "nope" });
  assert.equal(code, 401);
  assert.equal(typeof body.error, "string");
});

test("bad profile body is 400 with the field path", async () => {
  const bad = { zones: [{ instances: [{ assetId: "A", position: [0, 0, 0] }, { assetId: "A", position: [0, 0, 0] },
    { assetId: "A", position: [1, 2] }] }] };
  const [code, body] = await call("POST", "/v1/profile", bad);
  assert.equal(code, 400);
  assert.match(body.error, /^zones\[0\]\.instances\[2\]\.position: expected \[x, y, z\]/);
});

test("bad place body is 400 with the field path, even with no profile stored", async () => {
  const [code, body] = await call("POST", "/v1/place", { ...placeBody, cell: -1 });
  assert.equal(code, 400);
  assert.match(body.error, /^cell: /);
});

test("malformed JSON is 400", async () => {
  const [code, body] = await call("POST", "/v1/profile", undefined, { raw: "{not json" });
  assert.equal(code, 400);
  assert.equal(typeof body.error, "string");
});

test("place with no profile is 409", async () => {
  const [code, body] = await call("POST", "/v1/place", placeBody);
  assert.equal(code, 409);
  assert.equal(typeof body.error, "string");
});

test("unknown path is 404, wrong method is 405", async () => {
  assert.equal((await call("POST", "/v1/nope", {}))[0], 404);
  assert.equal((await call("GET", "/v1/nope"))[0], 404);
  const [code, body] = await call("GET", "/v1/place");
  assert.equal(code, 405);
  assert.equal(typeof body.error, "string");
});

test("learn then place round trip", async () => {
  const [c1, learned] = await call("POST", "/v1/profile", profileBody);
  assert.equal(c1, 200);
  assert.ok(learned.profile.zones.market);
  const [c2, out] = await call("POST", "/v1/place", placeBody);
  assert.equal(c2, 200);
  assert.ok(out.placements.length > 0);
  assert.ok(out.placements.every((p) => p.assetId === "Barrel"));
});

// The sequence Claude Code (a real MCP client over HTTP) sends, as observed against a live server.
const mcp = (body, method = "POST") => fetch(base + "/mcp", {
  method,
  headers: { authorization: "Bearer k1", "content-type": "application/json",
    accept: method === "GET" ? "text/event-stream" : "application/json, text/event-stream" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test("real client handshake: initialize, notification, tools/list, tools/call", async () => {
  let res = await mcp({ jsonrpc: "2.0", id: 0, method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "claude-code", version: "x" } } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^application\/json/);
  assert.equal((await res.json()).result.serverInfo.name, "greeble");

  res = await mcp({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(res.status, 202);
  assert.equal(await res.text(), "");

  res = await mcp({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.ok((await res.json()).result.tools.some((t) => t.name === "greeble_dress_zone"));

  res = await mcp({ jsonrpc: "2.0", id: 2, method: "tools/call",
    params: { name: "greeble_dress_zone", arguments: { zone: "Market" } } });
  const { id } = JSON.parse((await res.json()).result.content[0].text);
  const [code, next] = await call("GET", "/v1/jobs/next");
  assert.equal(code, 200);
  assert.equal(next.job.id, id);
});

test("GET /mcp (client opening an SSE stream) is 405 so the client falls back to plain POST", async () => {
  const res = await mcp(undefined, "GET");
  assert.equal(res.status, 405);
});

test("MCP request with an unknown key is 401", async () => {
  const res = await fetch(base + "/mcp", { method: "POST", headers: { authorization: "Bearer nope" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 0, method: "initialize" }) });
  assert.equal(res.status, 401);
});
