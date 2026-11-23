// Minimal MCP server over HTTP (JSON-RPC, one response per POST, no streaming).
// This is the door for devs who use their own agent.
import { createJob, getJob } from "./jobs.js";

const TOOLS = [
  {
    name: "greeble_dress_zone",
    description:
      "Place the studio's own kit assets across a zone in Roblox Studio, in the studio's saved style. " +
      "Queues a job that the Greeble Studio plugin carries out; returns a job id. " +
      "Studio must be open with the Greeble plugin listening.",
    inputSchema: {
      type: "object",
      properties: {
        zone: { type: "string", description: "Name of the zone Part in Workspace" },
        maxInstances: { type: "integer", minimum: 1, maximum: 5000 },
        seed: { type: "integer", description: "Change to get a different layout" },
      },
      required: ["zone"],
    },
  },
  {
    name: "greeble_learn_profile",
    description:
      "Learn the studio's style from an existing, hand-dressed area in Roblox Studio. " +
      "Queues a job that the Greeble Studio plugin carries out; returns a job id. " +
      "Studio must be open with the Greeble plugin listening.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Slash-separated path from game to a Folder or Model, e.g. Workspace/Map/Market" },
        label: { type: "string", description: "Optional name for this style sample" },
      },
      required: ["path"],
    },
  },
  {
    name: "greeble_job_status",
    description: "Check a Greeble job. Returns queued, running, done or failed, with placement stats when done.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
];

const text = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj) }] });

function callTool(key, name, args = {}) {
  if (name === "greeble_dress_zone") {
    if (typeof args.zone !== "string" || !args.zone) throw new Error("zone is required");
    const job = createJob(key, "dress_zone", {
      zone: args.zone, maxInstances: args.maxInstances ?? 500, seed: args.seed ?? 1,
    });
    return text({ id: job.id, status: job.status });
  }
  if (name === "greeble_learn_profile") {
    if (typeof args.path !== "string" || !args.path) throw new Error("path is required");
    if (args.label !== undefined && typeof args.label !== "string") throw new Error("label must be a string");
    const params = { path: args.path };
    if (args.label !== undefined) params.label = args.label;
    const job = createJob(key, "learn_profile", params);
    return text({ id: job.id, status: job.status });
  }
  if (name === "greeble_job_status") {
    const job = getJob(key, args.id);
    if (!job) throw new Error("unknown job");
    return text({ id: job.id, status: job.status, result: job.result });
  }
  throw new Error(`unknown tool ${name}`);
}

/** Returns a JSON-RPC response object, or null for notifications. */
export function handleMcp(key, msg) {
  const reply = (result) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(-32600, "invalid request");
  if (msg.id === undefined) return null; // notification
  switch (msg.method) {
    case "initialize":
      return reply({
        protocolVersion: msg.params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "greeble", version: "0.1.0" },
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call":
      try {
        return reply(callTool(key, msg.params?.name, msg.params?.arguments));
      } catch (e) {
        return reply({ content: [{ type: "text", text: String(e.message ?? e) }], isError: true });
      }
    default:
      return fail(-32601, "method not found");
  }
}
