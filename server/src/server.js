import http from "node:http";
import { learnZones, zoneKey } from "./profile.js";
import { getProfile, saveZones } from "./store.js";
import { place } from "./place.js";
import { handleMcp } from "./mcp.js";
import { nextJob, finishJob } from "./jobs.js";

const MAX_BODY = 20 * 1024 * 1024;

const send = (res, code, body) => {
  if (body === undefined) { res.writeHead(code); return res.end(); }
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

/** Route one authenticated request. Returns [status, body]. */
export function route(key, method, url, body) {
  if (method === "GET" && url === "/v1/profile") return [200, { profile: getProfile(key) }];
  if (method === "GET" && url === "/v1/jobs/next") {
    const job = nextJob(key);
    return [200, { job: job && { id: job.id, type: job.type, params: job.params } }];
  }
  if (method !== "POST") return [405, { error: "method not allowed" }];
  if (url === "/mcp") {
    const out = handleMcp(key, body);
    return out ? [200, out] : [202, undefined];
  }
  if (url === "/v1/profile") return [200, { profile: saveZones(key, learnZones(body)) }];
  if (url === "/v1/place") {
    const zones = getProfile(key)?.zones ?? {};
    const style = zones[zoneKey(body?.zone?.label)] ?? zones.default;
    if (!style) return [409, { error: "no profile for this zone; POST /v1/profile first" }];
    const { profile: _ignored, ...req } = body;
    return [200, place({ ...req, profile: style })];
  }
  const m = url.match(/^\/v1\/jobs\/([\w-]+)\/result$/);
  if (m) { const job = finishJob(key, m[1], body); return [200, { status: job.status }]; }
  return [404, { error: "not found" }];
}

export function makeHandler(keys) {
  return (req, res) => {
    const key = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!keys.has(key)) return send(res, 401, { error: "unknown key" });
    let size = 0; const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { send(res, 413, { error: "too large" }); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        const [code, out] = route(key, req.method, req.url, raw ? JSON.parse(raw) : undefined);
        send(res, code, out);
      } catch (e) {
        send(res, e?.status ?? 400, { error: String(e?.message ?? e) });
      }
    });
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const keys = new Set((process.env.GREEBLE_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean));
  if (!keys.size) { console.error("Set GREEBLE_KEYS"); process.exit(1); }
  const port = Number(process.env.PORT ?? 8787);
  http.createServer(makeHandler(keys)).listen(port, () => console.log(`greeble on :${port}`));
}
