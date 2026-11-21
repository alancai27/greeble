import http from "node:http";
import { learnProfile } from "./profile.js";
import { place } from "./place.js";

const keys = new Set((process.env.GREEBLE_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean));
const MAX_BODY = 20 * 1024 * 1024;

const send = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

export function handler(req, res) {
  const key = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (!keys.has(key)) return send(res, 401, { error: "unknown key" });
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  let size = 0; const chunks = [];
  req.on("data", (c) => {
    size += c.length;
    if (size > MAX_BODY) { send(res, 413, { error: "too large" }); req.destroy(); return; }
    chunks.push(c);
  });
  req.on("end", () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (req.url === "/v1/profile") return send(res, 200, { profile: learnProfile(body) });
      if (req.url === "/v1/place") return send(res, 200, place(body));
      send(res, 404, { error: "not found" });
    } catch (e) {
      send(res, 400, { error: String(e.message ?? e) });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!keys.size) { console.error("Set GREEBLE_KEYS"); process.exit(1); }
  const port = Number(process.env.PORT ?? 8787);
  http.createServer(handler).listen(port, () => console.log(`greeble on :${port}`));
}
