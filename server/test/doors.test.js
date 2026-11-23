import test from "node:test";
import assert from "node:assert/strict";
import { route } from "../src/server.js";
import { resetJobs } from "../src/jobs.js";

const rpc = (key, method, params, id = 1) => route(key, "POST", "/mcp", { jsonrpc: "2.0", id, method, params })[1];
const parse = (r) => JSON.parse(r.result.content[0].text);

test("mcp handshake and tool list", () => {
  assert.equal(rpc("a", "initialize", { protocolVersion: "2025-06-18" }).result.serverInfo.name, "greeble");
  assert.deepEqual(route("a", "POST", "/mcp", { jsonrpc: "2.0", method: "notifications/initialized" }), [202, undefined]);
  const names = rpc("a", "tools/list").result.tools.map((t) => t.name);
  assert.deepEqual(names, ["greeble_dress_zone", "greeble_learn_profile", "greeble_job_status"]);
  const learn = rpc("a", "tools/list").result.tools.find((t) => t.name === "greeble_learn_profile");
  assert.match(learn.description, /Studio must be open with the Greeble plugin listening/);
  assert.equal(rpc("a", "nope").error.code, -32601);
});

test("agent queues a job, plugin runs it, agent sees the result", () => {
  resetJobs();
  const { id } = parse(rpc("a", "tools/call", { name: "greeble_dress_zone", arguments: { zone: "Market" } }));
  const [, next] = route("a", "GET", "/v1/jobs/next");
  assert.equal(next.job.id, id);
  assert.equal(next.job.params.zone, "Market");
  assert.equal(route("a", "GET", "/v1/jobs/next")[1].job, null);
  assert.equal(parse(rpc("a", "tools/call", { name: "greeble_job_status", arguments: { id } })).status, "running");
  route("a", "POST", `/v1/jobs/${id}/result`, { ok: true, result: { placed: 12 } });
  const done = parse(rpc("a", "tools/call", { name: "greeble_job_status", arguments: { id } }));
  assert.equal(done.status, "done");
  assert.equal(done.result.placed, 12);
});

test("one studio cannot see or finish another studio's job", () => {
  resetJobs();
  const { id } = parse(rpc("a", "tools/call", { name: "greeble_dress_zone", arguments: { zone: "Z" } }));
  assert.equal(route("b", "GET", "/v1/jobs/next")[1].job, null);
  assert.equal(rpc("b", "tools/call", { name: "greeble_job_status", arguments: { id } }).result.isError, true);
  assert.throws(() => route("b", "POST", `/v1/jobs/${id}/result`, { ok: true }));
});

test("bad tool input comes back as a tool error", () => {
  assert.equal(rpc("a", "tools/call", { name: "greeble_dress_zone", arguments: {} }).result.isError, true);
});

test("learn_profile job reaches the plugin with path and label", () => {
  resetJobs();
  const { id, status } = parse(rpc("a", "tools/call", {
    name: "greeble_learn_profile", arguments: { path: "Workspace/Map/Market", label: "market" },
  }));
  assert.equal(status, "queued");
  const [, next] = route("a", "GET", "/v1/jobs/next");
  assert.equal(next.job.id, id);
  assert.equal(next.job.type, "learn_profile");
  assert.deepEqual(next.job.params, { path: "Workspace/Map/Market", label: "market" });
});

test("learn_profile without label omits it from params", () => {
  resetJobs();
  parse(rpc("a", "tools/call", { name: "greeble_learn_profile", arguments: { path: "Workspace/Town" } }));
  const [, next] = route("a", "GET", "/v1/jobs/next");
  assert.deepEqual(next.job.params, { path: "Workspace/Town" });
});

test("LearnStats result comes back through job status", () => {
  resetJobs();
  const { id } = parse(rpc("a", "tools/call", { name: "greeble_learn_profile", arguments: { path: "Workspace/Map" } }));
  route("a", "GET", "/v1/jobs/next");
  const stats = { zones: ["Market", "Plaza"], instances: 140, unmatched: 3 };
  route("a", "POST", `/v1/jobs/${id}/result`, { ok: true, result: stats });
  const done = parse(rpc("a", "tools/call", { name: "greeble_job_status", arguments: { id } }));
  assert.equal(done.status, "done");
  assert.deepEqual(done.result, stats);
});

test("learn_profile with missing or empty path is a tool error naming path", () => {
  for (const args of [{}, { path: "" }]) {
    const r = rpc("a", "tools/call", { name: "greeble_learn_profile", arguments: args }).result;
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /path/);
  }
});
