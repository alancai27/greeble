import http from "node:http";
import { learnZones, zoneKey } from "./profile.js";
import { getProfile, saveZones } from "./store.js";
import { place } from "./place.js";
import { handleMcp } from "./mcp.js";
import { nextJob, finishJob } from "./jobs.js";
import { validateProfile, validatePlace } from "./validate.js";

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
  const m = url.match(/^\/v1\/jobs\/([\w-]+)\/result$/);
  const known = m || ["/mcp", "/v1/profile", "/v1/place"].includes(url);
  if (!known) return [404, { error: "not found" }];
  if (method !== "POST") return [405, { error: "method not allowed" }];
  if (url === "/mcp") {
    const out = handleMcp(key, body);
    return out ? [200, out] : [202, undefined];
  }
  if (url === "/v1/profile") {
    validateProfile(body);
    return [200, { profile: saveZones(key, learnZones(body)) }];
  }
  if (url === "/v1/place") {
    validatePlace(body);
    const zones = getProfile(key)?.zones ?? {};
    const label = zoneKey(body?.zone?.label);
    const style = zones[label] ?? zones.default;
    if (!style) {
      const learned = Object.keys(zones).sort().join(", ") || "none";
      return [409, { error: `no profile for label "${label}"; learned labels: ${learned}` }];
    }
    const { profile: _ignored, ...req } = body;
    return [200, place({ ...req, profile: style })];
  }
  const job = finishJob(key, m[1], body);
  return [200, { status: job.status }];
}

export function makeHandler(keys) {
  return (req, res) => {
    const key = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!keys.has(key)) return send(res, 401, { error: "unknown key" });
    let size = 0; const chunks = [];
    let tooLarge = false;
    req.on("data", (c) => {
      if (tooLarge) return;
      size += c.length;
      if (size > MAX_BODY) { tooLarge = true; send(res, 413, { error: "body over 20 MB" }); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      if (tooLarge) return;
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        let body;
        try { body = raw ? JSON.parse(raw) : undefined; } catch {
          return send(res, 400, { error: "body: invalid JSON" });
        }
        const [code, out] = route(key, req.method, req.url, body);
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
