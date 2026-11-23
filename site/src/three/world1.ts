import * as THREE from 'three';
import { studdedBrick } from './studs';

// Units: studs, y up, baseplate top at y = 0. The world fits in 32x32 studs.
// Every piece is an instance in one of a handful of InstancedMeshes; setProgress
// recomputes every instance matrix from scratch, so calls carry no state.

const SIZE = 32;
const CELL = 2;
const CELLS = SIZE / CELL;
const CLEAR = 3; // centre 6x6 studs stays bare

type Kind = 'b1' | 'b2' | 'p1' | 'p2' | 'box' | 'cyl' | 'cone' | 'ball' | 'bulb' | 'pane';
type Mode = 'rise' | 'pop';

interface Piece {
  kind: Kind;
  x: number; y: number; z: number;
  sx: number; sy: number; sz: number;
  ry: number;
  t0: number; t1: number;
  mode: Mode;
  drop: number; // rise: how far below its final place it starts
  color: number;
}

const C = {
  plate: 0xa3a6ab,
  grass: [0x4caf50, 0x5cbf4a, 0x43a047],
  dirt: 0x8d5a34,
  stone: 0x8f96a0,
  sand: 0xf2d27a,
  water: 0x2f8fe8,
  path: 0xc9b38f,
  wall: 0xf4ecd8,
  wallTrim: 0xe0663a,
  roof: 0xd6332f,
  door: 0x6b3f22,
  wood: 0xa0652e,
  tower: 0xb9c0c9,
  towerRoof: 0x3b6fd6,
  trunk: 0x7a4a26,
  leaf: [0x2e9e48, 0x47b84a, 0x7cc243, 0x1f8a5c],
  pine: [0x1e7a4c, 0x23905a],
  flower: [0xff5a8a, 0xffd23f, 0xb36bff, 0xff8c2e, 0xffffff],
  post: 0x3a3f4a,
  glowOff: 0x5a5a52,
  glowOn: 0xffd27a,
};

// Deterministic hash in [0, 1).
function rand(a: number, b: number, s = 0): number {
  const v = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
}
const pick = <T>(list: T[], r: number): T => list[Math.floor(r * list.length) % list.length];

const cellCentre = (i: number) => -SIZE / 2 + CELL / 2 + i * CELL; // -15 .. 15

type Ground = 'clear' | 'grass' | 'water' | 'sand' | 'path' | 'flat';

interface Cell { x: number; z: number; h: number; ground: Ground }

function inside(x: number, z: number, x0: number, x1: number, z0: number, z1: number) {
  return x >= x0 && x <= x1 && z >= z0 && z <= z1;
}

// Hand-placed layout.
const HOUSE = { x0: 6, x1: 12, z0: -3, z1: 3 }; // stud bounds of the house footprint
const TOWER = { x: -11, z: -11 };
const HILLS = [
  { x: -11, z: -11, h: 4.6, r: 6 },
  { x: 11, z: -11, h: 3.2, r: 5 },
  { x: -13, z: 3, h: 2.4, r: 5 },
  { x: 12, z: 14, h: 2.2, r: 4 },
  { x: -10, z: 15, h: 1.6, r: 4 },
  { x: 2, z: -14, h: 1.4, r: 4 },
];

function buildCells(): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < CELLS; i++) {
    for (let j = 0; j < CELLS; j++) {
      const x = cellCentre(i);
      const z = cellCentre(j);
      let ground: Ground = 'grass';
      if (Math.abs(x) <= CLEAR && Math.abs(z) <= CLEAR) ground = 'clear';
      else if (z === 9 || z === 11) ground = 'water';
      else if (Math.abs(x) <= 1 && (z > CLEAR || z < -CLEAR)) ground = 'path';
      else if (inside(x, z, HOUSE.x0 - 1, HOUSE.x1 + 1, HOUSE.z0 - 1, HOUSE.z1 + 1)) ground = 'flat';
      else if (Math.abs(x) <= 1 || Math.abs(z) <= 1) ground = x > 0 && Math.abs(z) <= 1 ? 'path' : 'flat';
      else if (z === 7 || z === 13) ground = 'sand';

      let h = 0;
      if (ground === 'grass') {
        let v = 0;
        for (const hl of HILLS) {
          const d2 = (x - hl.x) ** 2 + (z - hl.z) ** 2;
          v = Math.max(v, hl.h * Math.exp(-d2 / (hl.r * hl.r)));
        }
        h = Math.floor(v + 0.15);
      }
      if (ground === 'flat') ground = 'grass';
      cells.push({ x, z, h, ground });
    }
  }
  return cells;
}

function groundTop(cells: Cell[], x: number, z: number): number {
  const i = Math.min(CELLS - 1, Math.max(0, Math.floor((x + SIZE / 2) / CELL)));
  const j = Math.min(CELLS - 1, Math.max(0, Math.floor((z + SIZE / 2) / CELL)));
  const c = cells[i * CELLS + j];
  if (c.ground === 'clear') return 0;
  return c.h > 0 ? c.h : 0.4;
}

// Layer windows on the 0..1 progress line.
const TERRAIN: [number, number] = [0.02, 0.4];
const PROPS: [number, number] = [0.36, 0.66];
const TREES: [number, number] = [0.6, 0.86];
const LIGHT: [number, number] = [0.8, 1];

function buildPieces(): Piece[] {
  const cells = buildCells();
  const out: Piece[] = [];
  const add = (p: Partial<Piece> & Pick<Piece, 'kind' | 'x' | 'y' | 'z' | 'color' | 't0' | 't1'>) =>
    out.push({ sx: 1, sy: 1, sz: 1, ry: 0, mode: 'pop', drop: 0, ...p });

  // Terrain: grows outward from the centre, lower layers first.
  const maxD = Math.hypot(15, 15);
  const [ta, tb] = TERRAIN;
  const span = tb - ta;
  for (const c of cells) {
    if (c.ground === 'clear') continue;
    const d = Math.hypot(c.x, c.z) / maxD;
    const start = ta + d * span * 0.55;
    const base = { x: c.x, z: c.z, mode: 'rise' as Mode };
    if (c.h === 0) {
      const color =
        c.ground === 'water' ? C.water :
        c.ground === 'sand' ? C.sand :
        c.ground === 'path' ? C.path :
        pick(C.grass, rand(c.x, c.z));
      add({ ...base, kind: 'p2', y: 0, color, t0: start, t1: start + span * 0.25, drop: 0.7 });
      continue;
    }
    for (let l = 0; l < c.h; l++) {
      const top = l === c.h - 1;
      const color = top ? (c.h >= 4 ? C.stone : pick(C.grass, rand(c.x, c.z))) : l === 0 ? C.dirt : C.stone;
      const t0 = start + (l / 5) * span * 0.2;
      add({ ...base, kind: 'b2', y: l, color, t0, t1: t0 + span * 0.25, drop: l + 1.3 });
    }
  }

  // Props: each built bottom to top inside its own slice of the props window.
  const [pa, pb] = PROPS;
  const slot = (k: number, n: number): [number, number] => {
    const w = (pb - pa) / n;
    return [pa + k * w * 0.8, pa + k * w * 0.8 + w * 1.4];
  };
  const stagger = (s: [number, number], f: number, len = 0.35): [number, number] => {
    const t0 = s[0] + (s[1] - s[0]) * (1 - len) * f;
    return [t0, t0 + (s[1] - s[0]) * len];
  };

  // House: cream brick walls, a door facing the centre, stepped red roof.
  {
    const s = slot(0, 3);
    const y0 = 0.4;
    const wallH = 3;
    for (let lv = 0; lv < wallH; lv++) {
      for (let x = HOUSE.x0 + 0.5; x < HOUSE.x1; x++) {
        for (let z = HOUSE.z0 + 0.5; z < HOUSE.z1; z++) {
          const edge = x === HOUSE.x0 + 0.5 || x === HOUSE.x1 - 0.5 || z === HOUSE.z0 + 0.5 || z === HOUSE.z1 - 0.5;
          if (!edge) continue;
          const door = x === HOUSE.x0 + 0.5 && Math.abs(z) < 1 && lv < 2;
          if (door) continue;
          const corner = (x === HOUSE.x0 + 0.5 || x === HOUSE.x1 - 0.5) && (z === HOUSE.z0 + 0.5 || z === HOUSE.z1 - 0.5);
          const [t0, t1] = stagger(s, lv / (wallH + 3) + rand(x, z, lv) * 0.05);
          add({ kind: 'b1', x, y: y0 + lv, z, color: corner ? C.wallTrim : C.wall, t0, t1 });
        }
      }
    }
    // Door and windows (windows light up in the lighting layer).
    const [dt0, dt1] = stagger(s, 0.45);
    add({ kind: 'box', x: HOUSE.x0 + 0.1, y: y0, z: 0, sx: 0.2, sy: 1.9, sz: 1.8, color: C.door, t0: dt0, t1: dt1 });
    for (const z of [-1.5, 1.5]) {
      add({ kind: 'pane', x: HOUSE.x0 - 0.02, y: y0 + 1.2, z: z * 1.15, sx: 0.12, sy: 0.7, sz: 0.8, color: 0xffffff, t0: dt0, t1: dt1 });
    }
    for (const x of [8, 10]) {
      add({ kind: 'pane', x, y: y0 + 1.2, z: HOUSE.z0 - 0.02, sx: 0.8, sy: 0.7, sz: 0.12, color: 0xffffff, t0: dt0, t1: dt1 });
      add({ kind: 'pane', x, y: y0 + 1.2, z: HOUSE.z1 + 0.02, sx: 0.8, sy: 0.7, sz: 0.12, color: 0xffffff, t0: dt0, t1: dt1 });
    }
    const cx = (HOUSE.x0 + HOUSE.x1) / 2;
    const cz = (HOUSE.z0 + HOUSE.z1) / 2;
    const roof = [7, 5, 3];
    roof.forEach((w, k) => {
      const [t0, t1] = stagger(s, 0.6 + k * 0.13);
      add({ kind: 'box', x: cx, y: y0 + wallH + k * 0.6, z: cz, sx: w, sy: 0.6, sz: w, color: C.roof, t0, t1 });
    });
    const [ct0, ct1] = stagger(s, 1);
    add({ kind: 'b2', x: cx, y: y0 + wallH + 1.8, z: cz, color: C.roof, t0: ct0, t1: ct1 });
    add({ kind: 'b1', x: cx + 1.5, y: y0 + wallH + 1.2, z: cz + 1.5, sy: 1.6, color: C.wallTrim, t0: ct0, t1: ct1 });
  }

  // Bridge over the river, on the path north of the centre.
  {
    const s = slot(1, 3);
    for (let z = 7.5; z < 13; z++) {
      for (const x of [-1.5, -0.5, 0.5, 1.5]) {
        const [t0, t1] = stagger(s, (z - 7.5) / 6, 0.3);
        add({ kind: 'p1', x, y: 0.4, z, color: (z * 2) % 2 ? C.wood : 0x8a5526, t0, t1 });
      }
    }
    for (const x of [-2.3, 2.3]) {
      for (const z of [7.5, 10, 12.5]) {
        const [t0, t1] = stagger(s, (z - 7.5) / 6 + 0.1, 0.3);
        add({ kind: 'b1', x, y: 0.4, z, sx: 0.6, sz: 0.6, sy: 1.4, color: C.wood, t0, t1 });
      }
      const [t0, t1] = stagger(s, 0.9, 0.3);
      add({ kind: 'box', x, y: 1.6, z: 10, sx: 0.4, sy: 0.3, sz: 5.6, color: C.wallTrim, t0, t1 });
    }
  }

  // Tower on the big hill.
  {
    const s = slot(2, 3);
    const gy = groundTop(cells, TOWER.x, TOWER.z);
    const levels = 6;
    for (let l = 0; l < levels; l++) {
      const [t0, t1] = stagger(s, l / (levels + 2), 0.3);
      add({ kind: 'b2', x: TOWER.x, y: gy + l, z: TOWER.z, color: l % 2 ? C.tower : 0xa7afba, t0, t1 });
    }
    const [wt0, wt1] = stagger(s, 0.8, 0.3);
    for (const [dx, dz, sx, sz] of [[1.02, 0, 0.1, 0.7], [-1.02, 0, 0.1, 0.7], [0, 1.02, 0.7, 0.1], [0, -1.02, 0.7, 0.1]]) {
      add({ kind: 'pane', x: TOWER.x + dx, y: gy + levels - 1.8, z: TOWER.z + dz, sx, sy: 0.9, sz, color: 0xffffff, t0: wt0, t1: wt1 });
    }
    const [rt0, rt1] = stagger(s, 1, 0.3);
    add({ kind: 'box', x: TOWER.x, y: gy + levels + 0.18, z: TOWER.z, sx: 2.8, sy: 0.4, sz: 2.8, color: C.towerRoof, t0: rt0, t1: rt1 });
    add({ kind: 'cone', x: TOWER.x, y: gy + levels + 0.58, z: TOWER.z, sx: 1.7, sy: 2.6, sz: 1.7, ry: Math.PI / 4, color: C.towerRoof, t0: rt0, t1: rt1 });
    add({ kind: 'ball', x: TOWER.x, y: gy + levels + 3.1, z: TOWER.z, sx: 0.25, sy: 0.25, sz: 0.25, color: C.flower[1], t0: rt0, t1: rt1 });
  }

  // Lamp posts appear with the props; their bulbs glow in the lighting layer.
  const lamps: [number, number][] = [[-2.6, 5], [2.6, 5], [-2.6, 14.5], [2.6, 14.5], [5, -3.6], [-2.6, -6], [2.6, -12], [-9, -8]];
  lamps.forEach(([x, z], k) => {
    const gy = groundTop(cells, x, z);
    const [t0, t1] = stagger([pa, pb], k / lamps.length, 0.2);
    add({ kind: 'cyl', x, y: gy, z, sx: 0.14, sy: 2.6, sz: 0.14, color: C.post, t0, t1 });
    add({ kind: 'box', x, y: gy + 2.6, z, sx: 0.5, sy: 0.12, sz: 0.5, color: C.post, t0, t1 });
    add({ kind: 'bulb', x, y: gy + 2.72, z, sx: 0.32, sy: 0.32, sz: 0.32, color: 0xffffff, t0, t1 });
  });

  // Trees, bushes and flowers on free grass cells.
  const [fa, fb] = TREES;
  const taken = (x: number, z: number) =>
    Math.hypot(x - TOWER.x, z - TOWER.z) < 2.5 ||
    inside(x, z, HOUSE.x0 - 2, HOUSE.x1 + 2, HOUSE.z0 - 2, HOUSE.z1 + 2) ||
    lamps.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 2);
  const greens = cells.filter((c) => c.ground === 'grass' && !taken(c.x, c.z));
  greens.forEach((c) => {
    const r = rand(c.x, c.z, 7);
    const gy = c.h > 0 ? c.h : 0.4;
    const t0 = fa + (fb - fa) * 0.75 * rand(c.x, c.z, 3);
    const t1 = t0 + (fb - fa) * 0.25;
    if (r < 0.18) {
      // Round tree.
      const s = 0.8 + rand(c.x, c.z, 9) * 0.5;
      add({ kind: 'cyl', x: c.x, y: gy, z: c.z, sx: 0.3 * s, sy: 1.8 * s, sz: 0.3 * s, color: C.trunk, t0, t1 });
      add({ kind: 'ball', x: c.x, y: gy + 1.3 * s, z: c.z, sx: 1.25 * s, sy: 1.1 * s, sz: 1.25 * s, color: pick(C.leaf, rand(c.x, c.z, 4)), t0: t0 + 0.02, t1: t1 + 0.02 });
      add({ kind: 'ball', x: c.x + 0.3, y: gy + 2.6 * s, z: c.z - 0.2, sx: 0.8 * s, sy: 0.75 * s, sz: 0.8 * s, color: pick(C.leaf, rand(c.x, c.z, 5)), t0: t0 + 0.03, t1: t1 + 0.03 });
    } else if (r < 0.32) {
      // Pine.
      const s = 0.85 + rand(c.x, c.z, 9) * 0.45;
      const col = pick(C.pine, rand(c.x, c.z, 4));
      add({ kind: 'cyl', x: c.x, y: gy, z: c.z, sx: 0.25 * s, sy: 1.2 * s, sz: 0.25 * s, color: C.trunk, t0, t1 });
      add({ kind: 'cone', x: c.x, y: gy + 0.8 * s, z: c.z, sx: 1.2 * s, sy: 2 * s, sz: 1.2 * s, ry: r * 9, color: col, t0: t0 + 0.02, t1: t1 + 0.02 });
      add({ kind: 'cone', x: c.x, y: gy + 2 * s, z: c.z, sx: 0.85 * s, sy: 1.7 * s, sz: 0.85 * s, ry: r * 7, color: col, t0: t0 + 0.03, t1: t1 + 0.03 });
    } else if (r < 0.5) {
      // Bush.
      add({ kind: 'ball', x: c.x - 0.3, y: gy, z: c.z + 0.2, sx: 0.7, sy: 0.55, sz: 0.7, color: pick(C.leaf, rand(c.x, c.z, 6)), t0, t1 });
      add({ kind: 'ball', x: c.x + 0.4, y: gy, z: c.z - 0.3, sx: 0.5, sy: 0.4, sz: 0.5, color: pick(C.leaf, rand(c.x, c.z, 8)), t0, t1 });
    } else if (r < 0.78) {
      // Flower patch: tiny studded plates in bright colours.
      for (const [dx, dz] of [[-0.5, -0.5], [0.5, 0.5], [0.5, -0.5]]) {
        if (rand(c.x + dx, c.z + dz, 2) < 0.3) continue;
        add({ kind: 'p1', x: c.x + dx, y: gy, z: c.z + dz, sx: 0.6, sy: 0.6, sz: 0.6, color: pick(C.flower, rand(c.x + dx, c.z + dz, 1)), t0, t1 });
      }
    }
  });

  return out;
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}
function easeOutBack(t: number) {
  const c1 = 1.6;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function geometryFor(kind: Kind): THREE.BufferGeometry {
  const fromBrick = (w: number, h: number, d: number) => {
    const m = studdedBrick(w, h, d, 0xffffff);
    (m.material as THREE.Material).dispose();
    return m.geometry;
  };
  let g: THREE.BufferGeometry;
  switch (kind) {
    case 'b1': return fromBrick(1, 1, 1);
    case 'b2': return fromBrick(2, 1, 2);
    case 'p1': return fromBrick(1, 0.4, 1);
    case 'p2': return fromBrick(2, 0.4, 2);
    case 'box':
    case 'pane':
      g = new THREE.BoxGeometry(1, 1, 1);
      g.translate(0, 0.5, 0);
      return g;
    case 'cyl':
      g = new THREE.CylinderGeometry(1, 1, 1, 10);
      g.translate(0, 0.5, 0);
      return g;
    case 'cone':
      g = new THREE.ConeGeometry(1, 1, 8);
      g.translate(0, 0.5, 0);
      return g;
    case 'ball':
    case 'bulb':
      g = new THREE.IcosahedronGeometry(1, 1);
      g.translate(0, 1, 0);
      return g;
  }
}

export function createWorld1(): { object: THREE.Object3D; setProgress(p: number): void } {
  const object = new THREE.Group();
  object.name = 'world1';

  const plate = studdedBrick(SIZE, 1, SIZE, C.plate);
  plate.position.y = -1;
  plate.castShadow = false;
  object.add(plate);

  const pieces = buildPieces();
  const solid = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0 });
  const flat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0, flatShading: true });
  const glow = new THREE.MeshStandardMaterial({ color: C.glowOff, roughness: 0.4, emissive: C.glowOn, emissiveIntensity: 0 });

  const kinds: Kind[] = ['b1', 'b2', 'p1', 'p2', 'box', 'cyl', 'cone', 'ball', 'bulb', 'pane'];
  const groups = new Map<Kind, { mesh: THREE.InstancedMesh; list: Piece[] }>();
  for (const kind of kinds) {
    const list = pieces.filter((p) => p.kind === kind);
    if (!list.length) continue;
    const material = kind === 'bulb' || kind === 'pane' ? glow : kind === 'cone' || kind === 'ball' ? flat : solid;
    const mesh = new THREE.InstancedMesh(geometryFor(kind), material, list.length);
    mesh.name = `world1-${kind}`;
    mesh.castShadow = kind !== 'pane' && kind !== 'p2';
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // instance bounds change with progress
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const col = new THREE.Color();
    list.forEach((p, i) => mesh.setColorAt(i, col.setHex(p.color)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    object.add(mesh);
    groups.set(kind, { mesh, list });
  }

  // Warm light that comes up in the lighting layer.
  const warmSky = new THREE.HemisphereLight(0xffb36b, 0x6b3f8a, 0);
  const warmSun = new THREE.DirectionalLight(0xff9a4a, 0);
  warmSun.position.set(20, 10, -6);
  object.add(warmSky, warmSun);

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const offColor = new THREE.Color(C.glowOff);
  const onColor = new THREE.Color(C.glowOn);

  const setProgress = (raw: number) => {
    const p = clamp01(Number.isFinite(raw) ? raw : 0);
    for (const { mesh, list } of groups.values()) {
      for (let i = 0; i < list.length; i++) {
        const pc = list[i];
        const t = clamp01((p - pc.t0) / (pc.t1 - pc.t0));
        if (t <= 0) {
          mesh.setMatrixAt(i, zero);
          continue;
        }
        quat.setFromAxisAngle(up, pc.ry);
        if (pc.mode === 'rise') {
          const e = easeOutCubic(t);
          pos.set(pc.x, pc.y - pc.drop * (1 - e), pc.z);
          scl.set(pc.sx, pc.sy, pc.sz);
        } else {
          const e = t >= 1 ? 1 : easeOutBack(t);
          pos.set(pc.x, pc.y, pc.z);
          scl.set(pc.sx * e, pc.sy * e, pc.sz * e);
        }
        mesh.setMatrixAt(i, m.compose(pos, quat, scl));
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    const l = clamp01((p - LIGHT[0]) / (LIGHT[1] - LIGHT[0]));
    glow.emissiveIntensity = l * 2.2;
    glow.color.copy(offColor).lerp(onColor, l);
    warmSky.intensity = l * 0.7;
    warmSun.intensity = l * 0.9;
  };

  setProgress(0);
  return { object, setProgress };
}
