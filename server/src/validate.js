/** Request validators. Each returns the body unchanged or throws an Error with status 400. */

const fail = (path, msg) => {
  const err = new Error(`${path}: ${msg}`);
  err.status = 400;
  throw err;
};
const join = (path, key) => (path ? `${path}.${key}` : key);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

const obj = (v, path) => { if (!isObj(v)) fail(path, "expected an object"); return v; };
const str = (v, path) => { if (typeof v !== "string" || !v) fail(path, "expected a non-empty string"); };
const optStr = (v, path) => { if (v !== undefined && typeof v !== "string") fail(path, "expected a string"); };
const num = (v, path) => { if (!isNum(v)) fail(path, "expected a finite number"); };
const pos = (v, path) => { if (!isNum(v) || v <= 0) fail(path, "expected a number > 0"); };
const optPos = (v, path) => { if (v !== undefined) pos(v, path); };
const vec3 = (v, path) => {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) fail(path, "expected [x, y, z]");
};
const arr = (v, path, each, { min = 0 } = {}) => {
  if (!Array.isArray(v)) fail(path, "expected an array");
  if (v.length < min) fail(path, `expected at least ${min} item${min === 1 ? "" : "s"}`);
  v.forEach((item, i) => each(item, `${path}[${i}]`));
};
const root = (body) => {
  if (body === undefined || body === null) fail("body", "missing; send a JSON object");
  return obj(body, "body");
};

export function validateProfile(body) {
  root(body);
  arr(body.zones, "zones", (z, p) => {
    obj(z, p);
    optStr(z.label, join(p, "label"));
    optPos(z.area, join(p, "area"));
    arr(z.instances, join(p, "instances"), (inst, ip) => {
      obj(inst, ip);
      str(inst.assetId, join(ip, "assetId"));
      vec3(inst.position, join(ip, "position"));
      optPos(inst.scale, join(ip, "scale"));
    }, { min: 1 });
  }, { min: 1 });
  return body;
}

export function validatePlace(body) {
  root(body);
  obj(body.zone, "zone");
  str(body.zone.id, "zone.id");
  optStr(body.zone.label, "zone.label");
  arr(body.surface, "surface", (s, p) => {
    obj(s, p);
    vec3(s.position, join(p, "position"));
    vec3(s.normal, join(p, "normal"));
  });
  pos(body.cell, "cell");
  arr(body.assets, "assets", (a, p) => {
    obj(a, p);
    str(a.id, join(p, "id"));
    pos(a.footprint, join(p, "footprint"));
  });
  if (body.keepClear !== undefined) {
    arr(body.keepClear, "keepClear", (b, p) => {
      obj(b, p);
      vec3(b.min, join(p, "min"));
      vec3(b.max, join(p, "max"));
    });
  }
  if (body.budget !== undefined) {
    obj(body.budget, "budget");
    const m = body.budget.maxInstances;
    if (m !== undefined && !(Number.isInteger(m) && m >= 0)) fail("budget.maxInstances", "expected an integer >= 0");
  }
  if (body.maxSlopeDeg !== undefined) {
    const s = body.maxSlopeDeg;
    if (!isNum(s) || s < 0 || s > 90) fail("maxSlopeDeg", "expected a number from 0 to 90");
  }
  if (body.seed !== undefined) num(body.seed, "seed");
  return body;
}
