// Jobs are how both doors reach Studio. An agent (through MCP) or the chat
// panel queues a job; the Studio plugin picks it up, samples the zone, calls
// /v1/place and reports back. Map data never passes through the model.
// In memory for now: a restart drops queued jobs.
import { randomUUID } from "node:crypto";

const byKey = new Map(); // studio key -> Map(id -> job)
const MAX_OPEN = 50;

const jobsFor = (key) => {
  if (!byKey.has(key)) byKey.set(key, new Map());
  return byKey.get(key);
};

export function createJob(key, type, params) {
  const jobs = jobsFor(key);
  const open = [...jobs.values()].filter((j) => j.status === "queued" || j.status === "running");
  if (open.length >= MAX_OPEN) throw new Error("too many open jobs");
  const job = { id: randomUUID(), type, params, status: "queued", result: null, createdAt: Date.now() };
  jobs.set(job.id, job);
  return job;
}

/** The plugin asks for work. Marks the oldest queued job as running. */
export function nextJob(key) {
  for (const job of jobsFor(key).values()) {
    if (job.status === "queued") { job.status = "running"; return job; }
  }
  return null;
}

export function finishJob(key, id, { ok, result }) {
  const job = jobsFor(key).get(id);
  if (!job) throw new Error("unknown job");
  if (job.status !== "running") throw new Error("job is not running");
  job.status = ok ? "done" : "failed";
  job.result = result ?? null;
  return job;
}

export const getJob = (key, id) => jobsFor(key).get(id) ?? null;
export const resetJobs = () => byKey.clear();
