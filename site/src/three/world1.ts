import * as THREE from 'three';
import { studdedBrick } from './studs';

// Units: studs, y up, baseplate top at y = 0. The world fits in 32x32 studs.
// Every piece is an instance in one of a handful of InstancedMeshes; setProgress
// recomputes every instance matrix from scratch, so calls carry no state.

const SIZE = 32;
const CELL = 2;
const CELLS = SIZE / CELL;
const CLEAR = 3; // centre 6x6 studs stays bare

type Kind = 'b1' | 'b2' | 'p1' | 'p2' | 'box' | 'cyl' | 'cone' | 'ball' | 'bulb' | 'pane' | 'neon';
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

type Ground = string; // 'clear' cells stay bare; the rest are theme-specific

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

type AddFn = (p: Partial<Piece> & Pick<Piece, 'kind' | 'x' | 'y' | 'z' | 'color' | 't0' | 't1'>) => void;

function collector(): { out: Piece[]; add: AddFn } {
  const out: Piece[] = [];
  const add: AddFn = (p) => out.push({ sx: 1, sy: 1, sz: 1, ry: 0, mode: 'pop', drop: 0, ...p });
  return { out, add };
}

const [pa, pb] = PROPS;
const [fa, fb] = TREES;
// Slice k of n inside the props window (slices overlap a little).
const slot = (k: number, n: number): [number, number] => {
  const w = (pb - pa) / n;
  return [pa + k * w * 0.8, pa + k * w * 0.8 + w * 1.4];
};
// A sub-window at fraction f of s, len of its width long.
const stagger = (s: [number, number], f: number, len = 0.35): [number, number] => {
  const t0 = s[0] + (s[1] - s[0]) * (1 - len) * f;
  return [t0, t0 + (s[1] - s[0]) * len];
};
// Timing for a foliage/detail piece at fraction f of the detail window.
const detail = (f: number): [number, number] => {
  const t0 = fa + (fb - fa) * 0.75 * f;
  return [t0, t0 + (fb - fa) * 0.25];
};

// Smooth hills, floored to whole bricks.
function hillHeight(x: number, z: number, hills: { x: number; z: number; h: number; r: number }[]): number {
  let v = 0;
  for (const hl of hills) {
    const d2 = (x - hl.x) ** 2 + (z - hl.z) ** 2;
    v = Math.max(v, hl.h * Math.exp(-d2 / (hl.r * hl.r)));
  }
  return Math.floor(v + 0.15);
}

function gridCells(f: (x: number, z: number) => { ground: Ground; h: number }): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < CELLS; i++) {
    for (let j = 0; j < CELLS; j++) {
      const x = cellCentre(i);
      const z = cellCentre(j);
      if (Math.abs(x) <= CLEAR && Math.abs(z) <= CLEAR) cells.push({ x, z, h: 0, ground: 'clear' });
      else cells.push({ x, z, ...f(x, z) });
    }
  }
  return cells;
}

// Terrain: grows outward from the centre, lower layers first. color(c, l) gives
// the colour of brick level l (l = -1 for a flat tile on the plate).
function layTerrain(add: AddFn, cells: Cell[], color: (c: Cell, l: number) => number) {
  const maxD = Math.hypot(15, 15);
  const [ta, tb] = TERRAIN;
  const span = tb - ta;
  for (const c of cells) {
    if (c.ground === 'clear') continue;
    const d = Math.hypot(c.x, c.z) / maxD;
    const start = ta + d * span * 0.55;
    const base = { x: c.x, z: c.z, mode: 'rise' as Mode };
    if (c.h === 0) {
      add({ ...base, kind: 'p2', y: 0, color: color(c, -1), t0: start, t1: start + span * 0.25, drop: 0.7 });
      continue;
    }
    for (let l = 0; l < c.h; l++) {
      const t0 = start + (l / 5) * span * 0.2;
      add({ ...base, kind: 'b2', y: l, color: color(c, l), t0, t1: t0 + span * 0.25, drop: l + 1.3 });
    }
  }
}

function buildMeadow(): Piece[] {
  const cells = buildCells();
  const { out, add } = collector();

  layTerrain(add, cells, (c, l) => {
    if (l < 0) {
      return c.ground === 'water' ? C.water :
        c.ground === 'sand' ? C.sand :
        c.ground === 'path' ? C.path :
        pick(C.grass, rand(c.x, c.z));
    }
    const top = l === c.h - 1;
    return top ? (c.h >= 4 ? C.stone : pick(C.grass, rand(c.x, c.z))) : l === 0 ? C.dirt : C.stone;
  });

  // Props: each built bottom to top inside its own slice of the props window.
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

// ---------------------------------------------------------------- desert
// Section colours (#world-2): --ground #c98b3e, --ground-lit #e0a95c, --ground-dark #9c6526.
const D = {
  plate: 0xc98b3e,
  sand: [0xe0a95c, 0xe6b36a, 0xd99f50],
  dune: [0xebbc76, 0xe3ad62],
  duneSide: 0xc98b3e,
  strata: [0x9c6526, 0xb8692f, 0xd0803c, 0xc25a34, 0xdc9550, 0xb8692f, 0xc25a34],
  mesaTop: [0xd99a52, 0xd0904a],
  track: 0xb27a44,
  water: 0x2fa8c8,
  oasis: [0x7cb342, 0x8bc34a],
  ruinFloor: [0xe3cfa2, 0xd8c08e],
  stone: [0xe8cc96, 0xd8b67c, 0xcaa46a],
  cactus: [0x3f8f3a, 0x2f7d32, 0x4c9e44],
  rock: [0x8a5a34, 0xa06a3a, 0x7a5a48],
  bloom: [0xff5a8a, 0xffd23f, 0xff8c2e],
  palm: 0x8a5a2e,
  frond: [0x3fae4a, 0x2f9a40, 0x5cbf4a],
  scrub: [0x9c8a4a, 0x8a7a3e],
  post: 0x4a2f1c,
};

const RUIN = { x0: 5, x1: 13, z0: -13, z1: -5 };

function desertCells(): Cell[] {
  const dunes = [
    { x: 2, z: -14, h: 1.8, r: 3.5 },
    { x: -13, z: 4, h: 2.2, r: 3.5 },
    { x: 5, z: 13, h: 1.7, r: 3 },
    { x: 14, z: -2, h: 1.4, r: 2.5 },
  ];
  return gridCells((x, z) => {
    // Big mesa in the north-west with a talus step, a smaller one south-east, a butte south-west.
    if (x <= -9 && z <= -9) return { ground: 'mesa', h: 6 };
    if ((x === -7 && z <= -9) || (z === -7 && x <= -9)) return { ground: 'mesa', h: 2 };
    if (x >= 11 && z >= 11) return { ground: 'mesa', h: 4 };
    if (x === 9 && z >= 11) return { ground: 'mesa', h: 2 };
    if ((x === -13 && (z === 11 || z === 13)) || (x === -11 && z === 11)) return { ground: 'mesa', h: 7 };
    if (x === -11 && z === 13) return { ground: 'mesa', h: 3 };
    if ((x === 9 || x === 11) && (z === 3 || z === 5)) return { ground: 'water', h: 0 };
    if (x >= 7 && x <= 13 && z >= 1 && z <= 7) return { ground: 'oasis', h: 0 };
    if (inside(x, z, RUIN.x0, RUIN.x1, RUIN.z0, RUIN.z1)) return { ground: 'ruin', h: 0 };
    if ((Math.abs(x) <= 1 && z > CLEAR) || (Math.abs(z) <= 1 && x < -CLEAR)) return { ground: 'track', h: 0 };
    return { ground: 'sand', h: hillHeight(x, z, dunes) };
  });
}

function buildDesert(): Piece[] {
  const cells = desertCells();
  const { out, add } = collector();

  layTerrain(add, cells, (c, l) => {
    const r = rand(c.x, c.z);
    if (l < 0) {
      return c.ground === 'water' ? D.water :
        c.ground === 'oasis' ? pick(D.oasis, r) :
        c.ground === 'ruin' ? pick(D.ruinFloor, r) :
        c.ground === 'track' ? D.track :
        pick(D.sand, r);
    }
    const top = l === c.h - 1;
    if (c.ground === 'mesa') return top ? pick(D.mesaTop, r) : D.strata[l % D.strata.length];
    return top ? pick(D.dune, r) : D.duneSide;
  });

  // Ruins: a broken sandstone court with a gate facing the centre, columns, a few fallen blocks.
  const y0 = 0.4;
  {
    const s = slot(0, 3);
    const gate = (x: number, z: number) => z === RUIN.z1 - 0.5 && x > 8 && x < 10;
    for (let x = RUIN.x0 + 0.5; x < RUIN.x1; x++) {
      for (let z = RUIN.z0 + 0.5; z < RUIN.z1; z++) {
        const xe = x === RUIN.x0 + 0.5 || x === RUIN.x1 - 0.5;
        const ze = z === RUIN.z0 + 0.5 || z === RUIN.z1 - 0.5;
        if ((!xe && !ze) || gate(x, z)) continue;
        const pillar = (xe && ze) || (z === RUIN.z1 - 0.5 && (x === 7.5 || x === 10.5));
        // Broken wall: height drifts along the wall, with gaps.
        const h = pillar ? 4 : Math.floor(3.4 * (0.5 + 0.5 * Math.sin(x * 1.3 + z * 0.9)) * rand(x, z, 11) + 0.4);
        for (let lv = 0; lv < h; lv++) {
          const [t0, t1] = stagger(s, lv / 6 + rand(x, z, lv) * 0.05);
          add({ kind: 'b1', x, y: y0 + lv, z, color: pick(D.stone, rand(x, z, lv + 20)), t0, t1 });
        }
      }
    }
    const [lt0, lt1] = stagger(s, 0.75);
    add({ kind: 'box', x: 9, y: y0 + 4, z: RUIN.z1 - 0.5, sx: 4.2, sy: 0.6, sz: 1.1, color: D.stone[2], t0: lt0, t1: lt1 });
    const cols: [number, number, number][] = [[7.5, -10.5, 3.6], [10.5, -10.5, 2], [7.5, -7.5, 1.1], [10.5, -7.5, 3.6]];
    cols.forEach(([x, z, h], k) => {
      const [t0, t1] = stagger(s, 0.3 + k * 0.1);
      add({ kind: 'box', x, y: y0, z, sx: 1, sy: 0.3, sz: 1, color: D.stone[1], t0, t1 });
      add({ kind: 'cyl', x, y: y0 + 0.3, z, sx: 0.36, sy: h, sz: 0.36, color: D.stone[0], t0, t1 });
      if (h > 3) add({ kind: 'box', x, y: y0 + 0.3 + h, z, sx: 1.1, sy: 0.35, sz: 1.1, color: D.stone[1], t0, t1 });
    });
    const fallen: [number, number, number][] = [[4.2, -9, 0.4], [9.6, -3.9, 0.9], [13.8, -7.5, 0.2], [12, -14.3, 1.2], [6, -6.6, 0.6]];
    fallen.forEach(([x, z, ry], k) => {
      const [t0, t1] = stagger(s, 0.85 + k * 0.03, 0.15);
      add({ kind: 'b1', x, y: groundTop(cells, x, z), z, ry, color: pick(D.stone, rand(x, z, 5)), t0, t1 });
    });
  }

  // Oasis: leaning palms and reeds round the pool.
  {
    const s = slot(1, 3);
    const palms: [number, number, number][] = [[7.4, 2.2, 1], [13.6, 6.4, -1], [8, 7.6, 1]];
    palms.forEach(([x, z, lean], k) => {
      let px = x;
      for (let seg = 0; seg < 5; seg++) {
        const [t0, t1] = stagger(s, k * 0.25 + seg * 0.05, 0.25);
        add({ kind: 'cyl', x: px, y: y0 + seg * 0.75, z, sx: 0.26 - seg * 0.02, sy: 0.8, sz: 0.26 - seg * 0.02, color: D.palm, t0, t1 });
        px += 0.14 * lean;
      }
      const top = y0 + 3.7;
      const [t0, t1] = stagger(s, k * 0.25 + 0.3, 0.25);
      add({ kind: 'cone', x: px, y: top - 0.2, z, sx: 2.2, sy: 0.55, sz: 2.2, ry: k, color: D.frond[k % 3], t0, t1 });
      add({ kind: 'cone', x: px, y: top + 0.1, z, sx: 1.5, sy: 0.6, sz: 1.5, ry: k + 0.4, color: D.frond[(k + 1) % 3], t0, t1 });
      add({ kind: 'ball', x: px + 0.25, y: top - 0.55, z: z + 0.2, sx: 0.2, sy: 0.2, sz: 0.2, color: D.post, t0, t1 });
    });
    for (const [x, z] of [[8.3, 4], [12.4, 3.5], [10, 6.6], [10.4, 2.4]]) {
      const [t0, t1] = stagger(s, 0.85, 0.15);
      add({ kind: 'cone', x, y: y0, z, sx: 0.3, sy: 1, sz: 0.3, color: D.oasis[0], t0, t1 });
    }
  }

  // Torches at the ruin gate and posts along the track; flames glow in the lighting layer.
  const torches: [number, number][] = [[7.5, -3.9], [10.5, -3.9], [-2.6, 6], [2.6, 12], [-6, 2.6], [-13, -2.6]];
  torches.forEach(([x, z], k) => {
    const gy = groundTop(cells, x, z);
    const [t0, t1] = stagger(slot(2, 3), k / torches.length, 0.25);
    add({ kind: 'cyl', x, y: gy, z, sx: 0.16, sy: 1.6, sz: 0.16, color: D.post, t0, t1 });
    add({ kind: 'box', x, y: gy + 1.6, z, sx: 0.42, sy: 0.25, sz: 0.42, color: D.post, t0, t1 });
    add({ kind: 'bulb', x, y: gy + 1.72, z, sx: 0.26, sy: 0.34, sz: 0.26, color: 0xffffff, t0, t1 });
  });

  // Cacti, rocks and scrub on open sand.
  const taken = (x: number, z: number) =>
    inside(x, z, RUIN.x0 - 2, RUIN.x1 + 2, RUIN.z0 - 2, RUIN.z1 + 2) ||
    torches.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 2);
  cells.filter((c) => (c.ground === 'sand' || (c.ground === 'mesa' && c.h === 2)) && !taken(c.x, c.z)).forEach((c) => {
    const r = rand(c.x, c.z, 7);
    const gy = c.h > 0 ? c.h : 0.4;
    const [t0, t1] = detail(rand(c.x, c.z, 3));
    const x = c.x + (rand(c.x, c.z, 12) - 0.5) * 0.6;
    const z = c.z + (rand(c.x, c.z, 13) - 0.5) * 0.6;
    if (r < 0.2) {
      // Saguaro: trunk, one or two arms, rounded top.
      const s = 0.85 + rand(c.x, c.z, 9) * 0.5;
      const col = pick(D.cactus, rand(c.x, c.z, 4));
      const h = 2.4 * s;
      add({ kind: 'cyl', x, y: gy, z, sx: 0.32, sy: h - 0.3, sz: 0.32, color: col, t0, t1 });
      add({ kind: 'ball', x, y: gy + h - 0.62, z, sx: 0.32, sy: 0.32, sz: 0.32, color: col, t0, t1 });
      const arms = rand(c.x, c.z, 14) < 0.5 ? [1] : [1, -1];
      const a = rand(c.x, c.z, 15) * Math.PI;
      for (const side of arms) {
        const dx = Math.cos(a) * side;
        const dz = Math.sin(a) * side;
        const ay = gy + h * (side > 0 ? 0.42 : 0.55);
        const [u0, u1] = [t0 + 0.02, t1 + 0.02];
        add({ kind: 'box', x: x + dx * 0.45, y: ay, z: z + dz * 0.45, sx: 0.9, sy: 0.36, sz: 0.36, ry: -a, color: col, t0: u0, t1: u1 });
        add({ kind: 'cyl', x: x + dx * 0.78, y: ay, z: z + dz * 0.78, sx: 0.2, sy: 1 * s, sz: 0.2, color: col, t0: u0, t1: u1 });
        add({ kind: 'ball', x: x + dx * 0.78, y: ay + s - 0.2, z: z + dz * 0.78, sx: 0.2, sy: 0.2, sz: 0.2, color: col, t0: u0, t1: u1 });
      }
      if (rand(c.x, c.z, 16) < 0.4) {
        add({ kind: 'ball', x, y: gy + h - 0.1, z, sx: 0.14, sy: 0.12, sz: 0.14, color: pick(D.bloom, rand(c.x, c.z, 17)), t0: t0 + 0.03, t1: t1 + 0.03 });
      }
    } else if (r < 0.3) {
      // Barrel cactus with a flower.
      add({ kind: 'ball', x, y: gy - 0.1, z, sx: 0.5, sy: 0.45, sz: 0.5, color: pick(D.cactus, rand(c.x, c.z, 4)), t0, t1 });
      add({ kind: 'p1', x, y: gy + 0.72, z, sx: 0.4, sy: 0.5, sz: 0.4, color: pick(D.bloom, rand(c.x, c.z, 17)), t0: t0 + 0.02, t1: t1 + 0.02 });
    } else if (r < 0.42) {
      // Rocks.
      add({ kind: 'ball', x, y: gy - 0.2, z, sx: 0.75, sy: 0.55, sz: 0.6, color: pick(D.rock, rand(c.x, c.z, 6)), t0, t1 });
      add({ kind: 'ball', x: x + 0.7, y: gy - 0.15, z: z + 0.4, sx: 0.4, sy: 0.32, sz: 0.4, color: pick(D.rock, rand(c.x, c.z, 8)), t0, t1 });
    } else if (r < 0.52) {
      // Dry scrub.
      add({ kind: 'ball', x, y: gy - 0.05, z, sx: 0.45, sy: 0.35, sz: 0.45, color: pick(D.scrub, rand(c.x, c.z, 6)), t0, t1 });
    }
  });

  return out;
}

// ---------------------------------------------------------------- neon
// Section colours (#world-3): --sky #15112e, --ground #3a2f73, --ground-lit #22d3ee, --ground-dark #241c4f.
const N = {
  plate: 0x3a2f73,
  road: 0x1b1736,
  block: [0x4a3f8c, 0x433781],
  curb: 0x241c4f,
  tower: [[0x2a2350, 0x332a63], [0x1f1a40, 0x2b2457], [0x3a2f73, 0x30275f]],
  hue: [0x22d3ee, 0xff3fa4, 0xffd23f, 0xa78bfa, 0x4ade80],
  dark: 0x2b2f55,
  roof: 0x4b4470,
  post: 0x2a2350,
  car: [0xff3fa4, 0x22d3ee, 0xffd23f, 0xf4efff],
  glass: 0x1a1638,
};

const isRoad = (x: number, z: number) => Math.abs(x) <= 1 || Math.abs(z) <= 1 || Math.abs(x) === 9 || Math.abs(z) === 9;

function buildNeon(): Piece[] {
  const cells = gridCells((x, z) => (isRoad(x, z) ? { ground: 'road', h: 0 } : { ground: 'block', h: 1 }));
  const { out, add } = collector();

  layTerrain(add, cells, (c, l) => (l < 0 ? N.road : (Math.round(c.x + c.z) / 2) % 2 ? N.block[0] : N.block[1]));

  // Street lights on the kerbs, chosen first so towers keep clear of them.
  const lights: [number, number][] = [];
  for (const d of [5, 13]) {
    lights.push([2.6, d], [-2.6, -d], [d, -2.6], [-d, 2.6]);
  }
  for (const d of [-5, 5, 13]) lights.push([10.6, d], [-10.6, -d], [d, 10.6], [-d, -10.6]);
  const lightCell = (x: number, z: number) => lights.some(([lx, lz]) => Math.abs(lx - x) < 1.5 && Math.abs(lz - z) < 1.5);

  // Towers on the blocks: taller further out, kept low next to the centre.
  const towers = cells
    .filter((c) => c.ground === 'block' && !lightCell(c.x, c.z) && rand(c.x, c.z, 1) < (Math.max(Math.abs(c.x), Math.abs(c.z)) > 9 ? 0.7 : 0.55))
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  towers.forEach((c, i) => {
    const ring = Math.max(Math.abs(c.x), Math.abs(c.z));
    const r = rand(c.x, c.z, 2);
    const H = ring <= 5 ? 2 + Math.floor(r * 2) : ring <= 7 ? 3 + Math.floor(r * 4) : 4 + Math.floor(r * 9);
    const pal = pick(N.tower, rand(c.x, c.z, 3));
    const hue = pick(N.hue, rand(c.x, c.z, 4));
    const f = (i / towers.length) * 0.8;
    const y0 = 1;
    for (let l = 0; l < H; l++) {
      const t0 = pa + (pb - pa) * (f + (0.15 * l) / H);
      add({ kind: 'b2', x: c.x, y: y0 + l, z: c.z, color: pal[l % 2], t0, t1: t0 + (pb - pa) * 0.12 });
    }
    // Windows: one strip per face per floor, most lit in the tower's hue.
    const faces: [number, number, number, number][] = [[1.02, 0, 0.08, 1.4], [-1.02, 0, 0.08, 1.4], [0, 1.02, 1.4, 0.08], [0, -1.02, 1.4, 0.08]];
    for (let l = 1; l < H; l++) {
      faces.forEach(([dx, dz, sx, sz], k) => {
        const [t0, t1] = detail(f + (l / H) * 0.15);
        const lit = rand(c.x + k, c.z + l, 5) > 0.3;
        add({ kind: 'neon', x: c.x + dx, y: y0 + l + 0.3, z: c.z + dz, sx, sy: 0.42, sz, color: lit ? hue : N.dark, t0, t1 });
      });
    }
    const [t0, t1] = detail(f + 0.18);
    const top = y0 + H + 0.18;
    if (H >= 7) {
      add({ kind: 'cyl', x: c.x + 0.4, y: top, z: c.z - 0.4, sx: 0.07, sy: 2, sz: 0.07, color: N.roof, t0, t1 });
      add({ kind: 'neon', x: c.x + 0.4, y: top + 2, z: c.z - 0.4, sx: 0.2, sy: 0.2, sz: 0.2, color: 0xff3355, t0, t1 });
    } else {
      add({ kind: 'box', x: c.x - 0.3, y: top, z: c.z + 0.2, sx: 0.9, sy: 0.5, sz: 0.7, color: N.roof, t0, t1 });
    }
    // Signs: a vertical blade on some towers, a rooftop billboard on others.
    const sr = rand(c.x, c.z, 6);
    const signHue = pick(N.hue, rand(c.x, c.z, 7));
    if (H >= 4 && sr < 0.4) {
      const [dx, dz] = pick([[1, 0], [-1, 0], [0, 1], [0, -1]], rand(c.x, c.z, 8));
      const sh = Math.min(3, H - 1.6);
      const [u0, u1] = detail(f + 0.22);
      add({ kind: 'box', x: c.x + dx * 1.15, y: y0 + H - sh - 0.4, z: c.z + dz * 1.15, sx: dx ? 0.3 : 1, sy: sh + 0.2, sz: dz ? 0.3 : 1, color: N.glass, t0: u0, t1: u1 });
      add({ kind: 'neon', x: c.x + dx * 1.32, y: y0 + H - sh - 0.3, z: c.z + dz * 1.32, sx: dx ? 0.06 : 0.8, sy: sh, sz: dz ? 0.06 : 0.8, color: signHue, t0: u0, t1: u1 });
    } else if (H >= 3 && sr > 0.75) {
      const [u0, u1] = detail(f + 0.22);
      const along = rand(c.x, c.z, 9) < 0.5;
      add({ kind: 'cyl', x: c.x, y: top - 0.18, z: c.z, sx: 0.08, sy: 0.8, sz: 0.08, color: N.roof, t0: u0, t1: u1 });
      add({ kind: 'neon', x: c.x, y: top + 0.5, z: c.z, sx: along ? 2.2 : 0.12, sy: 0.9, sz: along ? 0.12 : 2.2, color: signHue, t0: u0, t1: u1 });
    }
  });

  // Street lights: dark posts with glowing heads.
  lights.forEach(([x, z], k) => {
    const gy = groundTop(cells, x, z);
    const [t0, t1] = stagger([pa, pb], k / lights.length, 0.2);
    add({ kind: 'cyl', x, y: gy, z, sx: 0.1, sy: 2.2, sz: 0.1, color: N.post, t0, t1 });
    add({ kind: 'neon', x, y: gy + 2.2, z, sx: 0.5, sy: 0.14, sz: 0.5, color: N.hue[k % 2], t0, t1 });
  });

  // Lit roads: glowing lane dashes on every road, a few cars.
  const dash = (x: number, z: number, along: 'x' | 'z', color: number) => {
    if (Math.abs(x) <= CLEAR + 0.5 && Math.abs(z) <= CLEAR + 0.5) return;
    const [t0, t1] = detail(Math.hypot(x, z) / 22);
    add({ kind: 'neon', x, y: 0.4, z, sx: along === 'x' ? 0.9 : 0.16, sy: 0.08, sz: along === 'z' ? 0.9 : 0.16, color, t0, t1 });
  };
  for (let v = -15; v <= 15; v += 2) {
    dash(0, v, 'z', 0xffd23f);
    dash(v, 0, 'x', 0xffd23f);
    for (const r of [-9, 9]) {
      dash(r, v, 'z', 0x22d3ee);
      dash(v, r, 'x', 0x22d3ee);
    }
  }
  const cars: [number, number, number][] = [[0.9, 7, 0], [-0.9, -12, 0], [9.9, -5, 0], [-8.1, 6, 0], [6, 9.9, Math.PI / 2], [-12, -0.9, Math.PI / 2], [12, 8.1, Math.PI / 2]];
  cars.forEach(([x, z, ry], k) => {
    const [t0, t1] = detail(0.2 + k * 0.1);
    const col = N.car[k % N.car.length];
    const dz = ry ? 0 : 0.82;
    const dx = ry ? 0.82 : 0;
    add({ kind: 'box', x, y: 0.5, z, ry, sx: 0.9, sy: 0.45, sz: 1.6, color: col, t0, t1 });
    add({ kind: 'box', x, y: 0.95, z, ry, sx: 0.75, sy: 0.35, sz: 0.85, color: N.glass, t0, t1 });
    add({ kind: 'neon', x: x + dx, y: 0.65, z: z + dz, ry, sx: 0.8, sy: 0.12, sz: 0.06, color: 0xff3355, t0, t1 });
    add({ kind: 'neon', x: x - dx, y: 0.65, z: z - dz, ry, sx: 0.8, sy: 0.12, sz: 0.06, color: 0xf4efff, t0, t1 });
  });

  return out;
}

// ---------------------------------------------------------------- snow
// Section colours (#world-4): --ground #c9dbec, --ground-lit #f8fbff, --ground-dark #93aecb.
const S = {
  plate: 0xc9dbec,
  snow: [0xf8fbff, 0xeef4fb, 0xe6eff8],
  drift: [0xdfeaf5, 0xc9dbec],
  rock: 0x93aecb,
  ice: [0xa8d8f0, 0xbfe6f7, 0x9fd0ec],
  path: 0xb9c9da,
  log: [0x8a5a33, 0x6e4426],
  logEnd: 0x5a3a20,
  roof: 0x5a3a20,
  chimney: 0x8f96a0,
  smoke: 0xdfe6ee,
  pine: [0x1e5e45, 0x24704f, 0x2a7a55],
  trunk: 0x6b4226,
  block: [0xbfe9ff, 0xa5dcf5, 0xd8f3ff],
  igloo: [0xf2f8ff, 0xe3eff9, 0xd6e8f7],
  boulder: [0x8a96a6, 0x7a8696],
  carrot: 0xff8c2e,
  hat: 0x22252d,
  scarf: 0xd6332f,
  post: 0x2a3a52,
};

const CABIN = { x0: 5, x1: 11, z0: -11, z1: -5 };
const IGLOO = { x: -9, z: -8 };
const LAKE = { x: -9, z: 9 };

function snowCells(): Cell[] {
  const drifts = [
    { x: -13, z: -14, h: 3.4, r: 5 },
    { x: 13, z: 12, h: 3, r: 5 },
    { x: 3, z: 13, h: 1.6, r: 3 },
    { x: 14, z: 2, h: 2.2, r: 3.5 },
    { x: -14, z: 1, h: 1.6, r: 3 },
  ];
  return gridCells((x, z) => {
    if ((x - LAKE.x) ** 2 + (z - LAKE.z) ** 2 <= 26) return { ground: 'ice', h: 0 };
    if (inside(x, z, CABIN.x0 - 1, CABIN.x1 + 1, CABIN.z0 - 1, CABIN.z1 + 1)) return { ground: 'snow', h: 0 };
    if (Math.hypot(x - IGLOO.x, z - IGLOO.z) < 4.5) return { ground: 'snow', h: 0 };
    if (Math.abs(x) <= 1 && z < -CLEAR) return { ground: 'path', h: 0 };
    if (Math.abs(z) <= 1 && x > CLEAR && x < CABIN.x0) return { ground: 'path', h: 0 };
    return { ground: 'snow', h: hillHeight(x, z, drifts) };
  });
}

function buildSnow(): Piece[] {
  const cells = snowCells();
  const { out, add } = collector();

  layTerrain(add, cells, (c, l) => {
    const r = rand(c.x, c.z);
    if (l < 0) return c.ground === 'ice' ? pick(S.ice, r) : c.ground === 'path' ? S.path : pick(S.snow, r);
    if (l === c.h - 1) return pick(S.snow, r);
    return l === 0 ? S.rock : pick(S.drift, rand(c.x, c.z, l));
  });

  const y0 = 0.4;
  // Log cabin: dark log walls, door facing the path, lit windows, gabled roof under snow, smoking chimney.
  {
    const s = slot(0, 3);
    const wallH = 3;
    const cz = (CABIN.z0 + CABIN.z1) / 2;
    const cx = (CABIN.x0 + CABIN.x1) / 2;
    for (let lv = 0; lv < wallH; lv++) {
      for (let x = CABIN.x0 + 0.5; x < CABIN.x1; x++) {
        for (let z = CABIN.z0 + 0.5; z < CABIN.z1; z++) {
          const xe = x === CABIN.x0 + 0.5 || x === CABIN.x1 - 0.5;
          const ze = z === CABIN.z0 + 0.5 || z === CABIN.z1 - 0.5;
          if (!xe && !ze) continue;
          if (x === CABIN.x0 + 0.5 && Math.abs(z - cz) < 1 && lv < 2) continue;
          const [t0, t1] = stagger(s, lv / (wallH + 4) + rand(x, z, lv) * 0.05);
          add({ kind: 'b1', x, y: y0 + lv, z, color: xe && ze ? S.logEnd : S.log[lv % 2], t0, t1 });
        }
      }
    }
    const [dt0, dt1] = stagger(s, 0.45);
    add({ kind: 'box', x: CABIN.x0 + 0.1, y: y0, z: cz, sx: 0.2, sy: 1.9, sz: 1.8, color: S.logEnd, t0: dt0, t1: dt1 });
    for (const x of [6.5, 9.5]) {
      add({ kind: 'pane', x, y: y0 + 1.1, z: CABIN.z1 + 0.02, sx: 1, sy: 0.8, sz: 0.12, color: 0xffffff, t0: dt0, t1: dt1 });
    }
    add({ kind: 'pane', x: CABIN.x1 + 0.02, y: y0 + 1.1, z: cz, sx: 0.12, sy: 0.8, sz: 1, color: 0xffffff, t0: dt0, t1: dt1 });
    // Gable: steps run along x, each capped with a snow slab.
    [7.2, 5.4, 3.6, 1.8].forEach((w, k) => {
      const [t0, t1] = stagger(s, 0.6 + k * 0.1);
      const y = y0 + wallH + k * 0.5;
      add({ kind: 'box', x: cx, y, z: cz, sx: 7.2, sy: 0.5, sz: w, color: S.roof, t0, t1 });
      add({ kind: 'box', x: cx, y: y + 0.42, z: cz, sx: 7.4, sy: 0.2, sz: w + 0.2, color: S.snow[0], t0, t1 });
    });
    const [ct0, ct1] = stagger(s, 0.9);
    for (let k = 0; k < 4; k++) {
      add({ kind: 'b1', x: CABIN.x1 - 1.5, y: y0 + wallH + k, z: CABIN.z0 + 1.5, color: S.chimney, t0: ct0, t1: ct1 });
    }
    // Woodpile against the back wall.
    for (let k = 0; k < 5; k++) {
      const [t0, t1] = stagger(s, 0.5 + k * 0.05, 0.2);
      add({ kind: 'box', x: CABIN.x1 + 0.6, y: y0 + (k < 3 ? 0 : 0.5), z: CABIN.z0 + 1 + (k % 3) * 0.55 + (k >= 3 ? 0.27 : 0), sx: 1.1, sy: 0.5, sz: 0.5, color: S.log[k % 2], t0, t1 });
    }
  }

  // Igloo: rings of ice bricks narrowing to a cap, open towards the centre.
  {
    const s = slot(1, 3);
    const face = Math.atan2(-IGLOO.z, -IGLOO.x);
    const rings = [{ r: 2.3, n: 14 }, { r: 2.1, n: 12 }, { r: 1.6, n: 9 }, { r: 0.9, n: 5 }];
    rings.forEach(({ r, n }, lv) => {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + lv * 0.3;
        let da = Math.abs(a - face) % (Math.PI * 2);
        if (da > Math.PI) da = Math.PI * 2 - da;
        if (lv < 2 && da < 0.42) continue;
        const [t0, t1] = stagger(s, lv / 5 + (k / n) * 0.1, 0.3);
        add({
          kind: 'b1', x: IGLOO.x + Math.cos(a) * r, y: y0 + lv, z: IGLOO.z + Math.sin(a) * r,
          sx: lv === 3 ? 1 : 1.15, sz: 0.9, ry: -a + Math.PI / 2, color: pick(S.igloo, rand(k, lv, 3)), t0, t1,
        });
      }
    });
    const [t0, t1] = stagger(s, 0.85, 0.3);
    add({ kind: 'b2', x: IGLOO.x, y: y0 + 4, z: IGLOO.z, sx: 0.8, sz: 0.8, color: S.igloo[0], t0, t1 });
    // Entrance tunnel.
    const ex = Math.cos(face);
    const ez = Math.sin(face);
    for (const side of [-1, 1]) {
      for (const d of [2.9, 3.7]) {
        add({ kind: 'b1', x: IGLOO.x + ex * d - ez * side * 0.75, y: y0, z: IGLOO.z + ez * d + ex * side * 0.75, sy: 1.2, ry: -face, color: S.igloo[1], t0, t1 });
      }
    }
    add({ kind: 'box', x: IGLOO.x + ex * 3.3, y: y0 + 1.2, z: IGLOO.z + ez * 3.3, sx: 2.2, sy: 0.4, sz: 2.4, ry: -face, color: S.igloo[0], t0, t1 });
  }

  // Snowman near the centre.
  const SNOWMAN = { x: 5.5, z: 5.5 };
  {
    const s = slot(2, 3);
    const gy = groundTop(cells, SNOWMAN.x, SNOWMAN.z);
    const { x, z } = SNOWMAN;
    const [a0, a1] = stagger(s, 0, 0.3);
    const [b0, b1] = stagger(s, 0.3, 0.3);
    const [c0, c1] = stagger(s, 0.6, 0.3);
    add({ kind: 'ball', x, y: gy - 0.1, z, sx: 0.8, sy: 0.75, sz: 0.8, color: S.snow[0], t0: a0, t1: a1 });
    add({ kind: 'ball', x, y: gy + 1.15, z, sx: 0.58, sy: 0.55, sz: 0.58, color: S.snow[0], t0: b0, t1: b1 });
    add({ kind: 'cyl', x, y: gy + 2.1, z, sx: 0.5, sy: 0.18, sz: 0.5, color: S.scarf, t0: b0, t1: b1 });
    add({ kind: 'ball', x, y: gy + 2.05, z, sx: 0.42, sy: 0.42, sz: 0.42, color: S.snow[0], t0: c0, t1: c1 });
    add({ kind: 'box', x: x - 0.45, y: gy + 2.4, z: z - 0.45, sx: 0.14, sy: 0.14, sz: 0.55, ry: Math.PI / 4, color: S.carrot, t0: c0, t1: c1 });
    add({ kind: 'cyl', x, y: gy + 2.8, z, sx: 0.48, sy: 0.07, sz: 0.48, color: S.hat, t0: c0, t1: c1 });
    add({ kind: 'cyl', x, y: gy + 2.85, z, sx: 0.32, sy: 0.5, sz: 0.32, color: S.hat, t0: c0, t1: c1 });
  }

  // Lanterns along the paths; they glow in the lighting layer.
  const lamps: [number, number][] = [[-2.6, -5], [2.6, -9], [-2.6, -14], [5, 2.6], [4, -3.8], [-6, -4.5]];
  lamps.forEach(([x, z], k) => {
    const gy = groundTop(cells, x, z);
    const [t0, t1] = stagger([pa, pb], k / lamps.length, 0.2);
    add({ kind: 'cyl', x, y: gy, z, sx: 0.12, sy: 2.2, sz: 0.12, color: S.post, t0, t1 });
    add({ kind: 'box', x, y: gy + 2.2, z, sx: 0.45, sy: 0.12, sz: 0.45, color: S.post, t0, t1 });
    add({ kind: 'bulb', x, y: gy + 2.32, z, sx: 0.28, sy: 0.3, sz: 0.28, color: 0xffffff, t0, t1 });
  });

  // Smoke puffs rise out of the chimney with the lights.
  [0, 1, 2].forEach((k) => {
    const t0 = LIGHT[0] + k * 0.04;
    add({ kind: 'ball', x: CABIN.x1 - 1.5 + k * 0.3, y: y0 + 7.1 + k * 0.9, z: CABIN.z0 + 1.5 - k * 0.2, sx: 0.4 + k * 0.12, sy: 0.35 + k * 0.1, sz: 0.4 + k * 0.12, color: S.smoke, t0, t1: t0 + 0.08 });
  });

  // Snowy pines, boulders, ice blocks by the lake.
  const taken = (x: number, z: number) =>
    inside(x, z, CABIN.x0 - 2, CABIN.x1 + 2, CABIN.z0 - 2, CABIN.z1 + 2) ||
    Math.hypot(x - IGLOO.x, z - IGLOO.z) < 4.5 ||
    Math.hypot(x - SNOWMAN.x, z - SNOWMAN.z) < 2 ||
    lamps.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 2);
  cells.filter((c) => c.ground === 'snow' && !taken(c.x, c.z)).forEach((c) => {
    const r = rand(c.x, c.z, 7);
    const gy = c.h > 0 ? c.h : 0.4;
    const [t0, t1] = detail(rand(c.x, c.z, 3));
    const shore = Math.hypot(c.x - LAKE.x, c.z - LAKE.z) < 8;
    if (shore && r < 0.45) {
      // Ice blocks: a small stack of pale cubes.
      const n = 1 + Math.floor(rand(c.x, c.z, 9) * 3);
      for (let k = 0; k < n; k++) {
        const sz = 0.75 + rand(c.x, c.z, 10 + k) * 0.45;
        const top = k === 2;
        add({
          kind: 'box', x: c.x + (top ? 0.1 : (k - 0.5) * 0.9), y: gy + (top ? 0.75 : 0), z: c.z + (rand(c.x, c.z, 20 + k) - 0.5) * 0.6,
          sx: sz, sy: sz, sz, ry: rand(c.x, c.z, 30 + k) * 1.5, color: pick(S.block, rand(c.x, c.z, 40 + k)), t0: t0 + k * 0.01, t1: t1 + k * 0.01,
        });
      }
    } else if (r < 0.38) {
      // Pine: three green tiers, each tipped with snow.
      const s = 0.85 + rand(c.x, c.z, 9) * 0.5;
      const col = pick(S.pine, rand(c.x, c.z, 4));
      add({ kind: 'cyl', x: c.x, y: gy, z: c.z, sx: 0.22 * s, sy: 0.9 * s, sz: 0.22 * s, color: S.trunk, t0, t1 });
      const tiers: [number, number, number][] = [[0.6, 1.3, 1.6], [1.5, 1.0, 1.4], [2.35, 0.7, 1.2]];
      tiers.forEach(([ty, rr, hh], k) => {
        const ry = r * (7 + k);
        const u0 = t0 + 0.015 * (k + 1);
        add({ kind: 'cone', x: c.x, y: gy + ty * s, z: c.z, sx: rr * s, sy: hh * s, sz: rr * s, ry, color: col, t0: u0, t1: t1 + 0.015 * (k + 1) });
        const f = 0.42;
        add({ kind: 'cone', x: c.x, y: gy + (ty + hh * (1 - f)) * s - 0.02, z: c.z, sx: rr * f * 1.08 * s, sy: hh * f * 1.04 * s, sz: rr * f * 1.08 * s, ry, color: S.snow[0], t0: u0, t1: t1 + 0.015 * (k + 1) });
      });
    } else if (r < 0.46) {
      // Boulder with a snow cap.
      add({ kind: 'ball', x: c.x, y: gy - 0.25, z: c.z, sx: 0.8, sy: 0.6, sz: 0.7, color: pick(S.boulder, rand(c.x, c.z, 6)), t0, t1 });
      add({ kind: 'ball', x: c.x, y: gy + 0.2, z: c.z, sx: 0.62, sy: 0.3, sz: 0.55, color: S.snow[0], t0, t1 });
    } else if (r < 0.56) {
      // Snowy bush.
      add({ kind: 'ball', x: c.x - 0.2, y: gy - 0.1, z: c.z + 0.2, sx: 0.6, sy: 0.45, sz: 0.6, color: S.pine[1], t0, t1 });
      add({ kind: 'ball', x: c.x - 0.15, y: gy + 0.25, z: c.z + 0.15, sx: 0.48, sy: 0.25, sz: 0.48, color: S.snow[1], t0, t1 });
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
    case 'neon':
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

export type Theme = 'meadow' | 'desert' | 'neon' | 'snow';

interface ThemeSpec {
  plate: number;
  build: () => Piece[];
  glowOff: number;
  glowOn: number;
  // Lights that come up in the lighting layer.
  sky: [number, number, number]; // sky colour, ground colour, max intensity
  sun: [number, number, [number, number, number]]; // colour, max intensity, position
}

const THEMES: Record<Theme, ThemeSpec> = {
  meadow: { plate: C.plate, build: buildMeadow, glowOff: C.glowOff, glowOn: C.glowOn, sky: [0xffb36b, 0x6b3f8a, 0.7], sun: [0xff9a4a, 0.9, [20, 10, -6]] },
  desert: { plate: D.plate, build: buildDesert, glowOff: 0x5a4a3a, glowOn: 0xffa040, sky: [0xff9a5a, 0x6b3f6b, 0.7], sun: [0xff7a3a, 0.9, [20, 8, -6]] },
  neon: { plate: N.plate, build: buildNeon, glowOff: 0x3a3550, glowOn: 0x22d3ee, sky: [0xa855f7, 0x0e7490, 0.8], sun: [0xff3fa4, 0.7, [-20, 12, 10]] },
  snow: { plate: S.plate, build: buildSnow, glowOff: 0x5a5a52, glowOn: 0xffc46b, sky: [0x9fc4ff, 0x2a3f6b, 0.5], sun: [0x8fb4ff, 0.6, [-18, 10, -10]] },
};

export function createWorld(theme: Theme): { object: THREE.Object3D; setProgress(p: number): void } {
  const spec = THEMES[theme] ?? THEMES.meadow;
  const tag = theme === 'meadow' ? 'world1' : `world-${theme}`;
  const object = new THREE.Group();
  object.name = tag;

  const plate = studdedBrick(SIZE, 1, SIZE, spec.plate);
  plate.position.y = -1;
  plate.castShadow = false;
  object.add(plate);

  const pieces = spec.build();
  const solid = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0 });
  const flat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0, flatShading: true });
  const glow = new THREE.MeshStandardMaterial({ color: spec.glowOff, roughness: 0.4, emissive: spec.glowOn, emissiveIntensity: 0 });
  // Neon: unlit, tinted by each instance's colour; brightens in the lighting layer.
  const neon = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const kinds: Kind[] = ['b1', 'b2', 'p1', 'p2', 'box', 'cyl', 'cone', 'ball', 'bulb', 'pane', 'neon'];
  const groups = new Map<Kind, { mesh: THREE.InstancedMesh; list: Piece[] }>();
  for (const kind of kinds) {
    const list = pieces.filter((p) => p.kind === kind);
    if (!list.length) continue;
    const material = kind === 'neon' ? neon : kind === 'bulb' || kind === 'pane' ? glow : kind === 'cone' || kind === 'ball' ? flat : solid;
    const mesh = new THREE.InstancedMesh(geometryFor(kind), material, list.length);
    mesh.name = `${tag}-${kind}`;
    mesh.castShadow = kind !== 'pane' && kind !== 'p2' && kind !== 'neon';
    mesh.receiveShadow = kind !== 'neon';
    mesh.frustumCulled = false; // instance bounds change with progress
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const col = new THREE.Color();
    list.forEach((p, i) => mesh.setColorAt(i, col.setHex(p.color)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    object.add(mesh);
    groups.set(kind, { mesh, list });
  }

  // Theme light that comes up in the lighting layer.
  const warmSky = new THREE.HemisphereLight(spec.sky[0], spec.sky[1], 0);
  const warmSun = new THREE.DirectionalLight(spec.sun[0], 0);
  warmSun.position.set(...spec.sun[2]);
  object.add(warmSky, warmSun);

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const offColor = new THREE.Color(spec.glowOff);
  const onColor = new THREE.Color(spec.glowOn);

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
    neon.color.setScalar(0.3 + 0.7 * l);
    warmSky.intensity = l * spec.sky[2];
    warmSun.intensity = l * spec.sun[1];
  };

  setProgress(0);
  return { object, setProgress };
}

export const createWorld1 = () => createWorld('meadow');
