// First world: a studded baseplate that grows into a block-built world.
// update(progress) is a pure function of progress: every item's look is derived
// from progress alone, so any value in any order lands in the same state.

const NS = 'http://www.w3.org/2000/svg';

// Isometric projection. Grid cell (i, j), height z in brick units.
const W = 48; // width of one cell's top face
const H = 24; // height of one cell's top face
const Z = 26; // height of one brick
const N = 10; // plate is N x N cells
const PLATE = 0.3; // plate thickness in bricks

const px = (i: number, j: number) => ((i - j) * W) / 2;
const py = (i: number, j: number, z: number) => ((i + j) * H) / 2 - z * Z;
const pt = (i: number, j: number, z: number) => `${px(i, j)},${py(i, j, z)}`;

type Layer = 'terrain' | 'props' | 'foliage' | 'lighting';
type Anim = 'rise' | 'drop' | 'pop' | 'fade' | 'sun' | 'cloud';

// [top, left face, right face, stud side]
type Paint = readonly [string, string, string, string];
const C = {
  plate: ['#c9ccd6', '#9ea2b1', '#b3b7c4', '#a9adbb'],
  grass: ['#63b96f', '#3f9b4f', '#4fa95c', '#46a052'],
  dirt: ['#a8774a', '#7c5533', '#8f633d', '#8a5f3a'],
  stone: ['#b9bcc8', '#878b9b', '#a0a4b2', '#9599a8'],
  sand: ['#ecd49a', '#c6a96a', '#d9bd7f', '#d2b676'],
  water: ['#5fb2e6', '#3a86c2', '#4a9bd6', '#4a9bd6'],
  brick: ['#e0563f', '#a8382a', '#c44532', '#bd4230'],
  roof: ['#3b4566', '#232a42', '#2f3754', '#2a3150'],
  wood: ['#b9844f', '#7f5631', '#9a6a3d', '#93653a'],
  plank: ['#d6a467', '#9c7140', '#b88650', '#b07f4b'],
  trunk: ['#8a5a34', '#5c3a1f', '#734a29', '#6b4425'],
  leaf: ['#4caf50', '#2e7d32', '#3b9640', '#358c3a'],
  leafDark: ['#3a9a48', '#22692c', '#2d8139', '#2a7a35'],
  amber: ['#f2a900', '#b97f00', '#d99700', '#d39300'],
  white: ['#f4f5f8', '#c4c7d2', '#dcdee6', '#d3d6df'],
} satisfies Record<string, Paint>;

interface Item {
  g: SVGGElement;
  layer: Layer;
  anim: Anim;
  start: number;
  dur: number;
  depth: number; // painter's order: smaller is further back
  pivotX: number;
  pivotY: number;
  last: number; // last local t written; a cache, never read to decide the result
}

const LAYER_WINDOW: Record<Layer, readonly [number, number]> = {
  terrain: [0.02, 0.44],
  props: [0.44, 0.66],
  foliage: [0.64, 0.84],
  lighting: [0.82, 1],
};
const DUR: Record<Layer, number> = { terrain: 0.08, props: 0.07, foliage: 0.07, lighting: 0.1 };

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  parent?.appendChild(e);
  return e;
}

function stud(parent: Element, cx: number, cy: number, paint: Paint) {
  const rx = W * 0.19;
  const ry = H * 0.19;
  const s = Z * 0.2;
  el('path', {
    d: `M${cx - rx},${cy - s}L${cx - rx},${cy}A${rx},${ry} 0 0 0 ${cx + rx},${cy}L${cx + rx},${cy - s}Z`,
    fill: paint[3],
  }, parent);
  el('ellipse', { cx, cy: cy - s, rx, ry, fill: paint[0] }, parent);
}

type Decal = 'door' | 'window';

// One 1x1 brick (or a slab when h < 1) with its bottom at height z.
function brick(parent: Element, i: number, j: number, z: number, paint: Paint, h = 1, studs = true, decal?: Decal) {
  const t = z + h;
  el('polygon', { points: `${pt(i, j + 1, t)} ${pt(i + 1, j + 1, t)} ${pt(i + 1, j + 1, z)} ${pt(i, j + 1, z)}`, fill: paint[1] }, parent);
  el('polygon', { points: `${pt(i + 1, j, t)} ${pt(i + 1, j + 1, t)} ${pt(i + 1, j + 1, z)} ${pt(i + 1, j, z)}`, fill: paint[2] }, parent);
  el('polygon', { points: `${pt(i, j, t)} ${pt(i + 1, j, t)} ${pt(i + 1, j + 1, t)} ${pt(i, j + 1, t)}`, fill: paint[0] }, parent);
  if (decal) {
    // On the left (j + 1) face.
    const [a, b, lo, hi] = decal === 'door' ? [0.3, 0.7, 0, 0.85] : [0.25, 0.75, 0.3, 0.75];
    el('polygon', {
      points: `${pt(i + a, j + 1, z + lo * h)} ${pt(i + b, j + 1, z + lo * h)} ${pt(i + b, j + 1, z + hi * h)} ${pt(i + a, j + 1, z + hi * h)}`,
      fill: decal === 'door' ? '#4a2f1a' : '#9fd3f2',
      'data-decal': decal,
    }, parent);
  }
  if (studs) stud(parent, px(i + 0.5, j + 0.5), py(i + 0.5, j + 0.5, t), paint);
}

// Height map: digits are columns of bricks (top one grass, the rest dirt),
// w is water, s is sand, p is a stone path tile. Row = j, column = i.
const MAP = [
  '4433221111',
  '4332211ww1',
  '33221ppw11',
  '3221pp1w11',
  '221pp11ww1',
  '11pp111sw1',
  '1pp1111sw1',
  'pp111111ws',
  'p1111111ws',
  '1111111sws',
];

interface Spec {
  layer: Layer;
  anim: Anim;
  order: number; // 0..1 within its layer
  depth: number;
  pivot: [number, number];
  draw(g: SVGGElement): void;
}

function depthOf(i: number, j: number, z: number) {
  // Unit bricks: back-to-front by i + j + z; at a tie the lower brick is in front.
  return (i + j + z) * 100 - z;
}

function buildSpecs(): Spec[] {
  const specs: Spec[] = [];
  const heights: number[][] = [];
  let maxK = 0;
  for (let j = 0; j < N; j++) {
    heights.push([]);
    for (let i = 0; i < N; i++) {
      const c = MAP[j][i];
      const n = /\d/.test(c) ? Number(c) : 1;
      heights[j].push(n);
      maxK = Math.max(maxK, n);
    }
  }
  const wave = (i: number, j: number) => (i + j) / (2 * N - 2);

  // Terrain
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const c = MAP[j][i];
      const n = heights[j][i];
      for (let k = 0; k < n; k++) {
        const water = c === 'w';
        const paint = water ? C.water : c === 's' ? C.sand : c === 'p' ? C.stone : k === n - 1 ? C.grass : C.dirt;
        const h = water ? 0.7 : 1;
        specs.push({
          layer: 'terrain',
          anim: 'rise',
          order: (k + wave(i, j) * 1.5) / (maxK - 1 + 1.5),
          depth: depthOf(i, j, k),
          pivot: [px(i + 0.5, j + 0.5), py(i + 0.5, j + 0.5, k)],
          draw: (g) => brick(g, i, j, k, paint, h, !water),
        });
      }
    }
  }

  // Props: placed on the ground at height `base`.
  const props: { i: number; j: number; k: number; paint: Paint; h?: number; studs?: boolean; decal?: Decal; group: number }[] = [];
  // House: 2x2 brick walls, two high, roof on top.
  for (const [i, j] of [[4, 6], [5, 6], [4, 7], [5, 7]] as const) {
    props.push({ i, j, k: 1, paint: C.brick, group: 0, decal: j === 7 && i === 4 ? 'door' : undefined });
    props.push({ i, j, k: 2, paint: C.brick, group: 1, decal: j === 7 && i === 5 ? 'window' : undefined });
    props.push({ i, j, k: 3, paint: C.roof, h: 0.5, group: 2 });
  }
  props.push({ i: 5, j: 6, k: 3.5, paint: C.stone, group: 3 }); // chimney
  // Bridge over the river.
  props.push({ i: 7, j: 2, k: 0.85, paint: C.plank, h: 0.3, group: 1 });
  // Spawn pad and crates.
  props.push({ i: 6, j: 4, k: 1, paint: C.white, h: 0.3, group: 0 });
  props.push({ i: 2, j: 8, k: 1, paint: C.wood, group: 1 });
  props.push({ i: 3, j: 8, k: 1, paint: C.amber, group: 2 });
  props.push({ i: 2, j: 8, k: 2, paint: C.wood, group: 3 });
  // A short tower on the hill.
  for (let k = 4; k < 6; k++) props.push({ i: 0, j: 0, k, paint: C.stone, group: k - 3 });
  props.push({ i: 0, j: 0, k: 6, paint: C.amber, h: 0.5, group: 3 });
  for (const p of props) {
    specs.push({
      layer: 'props',
      anim: 'drop',
      order: (p.group + wave(p.i, p.j) * 0.5) / 3.5,
      depth: depthOf(p.i, p.j, Math.floor(p.k)),
      pivot: [0, 0],
      draw: (g) => brick(g, p.i, p.j, p.k, p.paint, p.h ?? 1, p.studs ?? true, p.decal),
    });
  }

  // Foliage: a trunk, then leaves. Big trees get a cross of leaf bricks.
  const trees: [number, number, boolean][] = [[3, 2, true], [1, 5, true], [6, 1, false], [9, 2, false], [9, 5, false], [1, 9, false]];
  const foliage: { i: number; j: number; k: number; paint: Paint; tree: number }[] = [];
  trees.forEach(([i, j, big], t) => {
    const g = heights[j][i];
    foliage.push({ i, j, k: g, paint: C.trunk, tree: t });
    const ring = big ? [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] : [[0, 0]];
    for (const [di, dj] of ring) {
      foliage.push({ i: i + di, j: j + dj, k: g + 1, paint: di || dj ? C.leafDark : C.leaf, tree: t });
    }
    foliage.push({ i, j, k: g + 2, paint: C.leaf, tree: t });
  });
  // Bushes.
  for (const [i, j] of [[9, 4], [0, 9], [3, 6], [6, 8]] as const) {
    foliage.push({ i, j, k: heights[j][i], paint: C.leafDark, tree: trees.length + (i % 2) });
  }
  const treeCount = trees.length + 2;
  for (const f of foliage) {
    specs.push({
      layer: 'foliage',
      anim: 'pop',
      order: (f.tree + (f.k - (heights[f.j]?.[f.i] ?? 0)) * 0.25) / (treeCount + 0.75),
      depth: depthOf(f.i, f.j, f.k),
      pivot: [px(f.i + 0.5, f.j + 0.5), py(f.i + 0.5, f.j + 0.5, f.k)],
      draw: (g) => brick(g, f.i, f.j, f.k, f.paint),
    });
  }

  // Lighting: soft shadows cast onto the ground cell east of each tree, and
  // beside the house. Each is drawn just after the ground it lies on.
  const SHADE = '#0b1430';
  trees.forEach(([i, j], t) => {
    if (i + 1 >= N) return;
    const g = heights[j][i + 1];
    const cx = px(i + 1.5, j + 0.5);
    const cy = py(i + 1.5, j + 0.5, g);
    specs.push({
      layer: 'lighting',
      anim: 'fade',
      order: 0.2 + t * 0.05,
      depth: depthOf(i + 1, j, g - 1) + 0.5,
      pivot: [0, 0],
      draw: (gr) => el('ellipse', { cx, cy, rx: W * 0.33, ry: H * 0.33, fill: SHADE, opacity: 0.2 }, gr),
    });
  });
  specs.push({
    layer: 'lighting',
    anim: 'fade',
    order: 0.3,
    depth: depthOf(6, 7, 0) + 0.5,
    pivot: [0, 0],
    draw: (gr) =>
      el('polygon', { points: `${pt(6, 6, 1)} ${pt(6.8, 6, 1)} ${pt(6.8, 8, 1)} ${pt(6, 8, 1)}`, fill: SHADE, opacity: 0.16 }, gr),
  });
  return specs;
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}
function easeOutBack(t: number) {
  const c = 1.7;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

function apply(item: Item, t: number) {
  if (t === item.last) return;
  item.last = t;
  const g = item.g;
  if (t <= 0) g.setAttribute('visibility', 'hidden');
  else g.removeAttribute('visibility');
  if (t <= 0 || t >= 1) {
    g.removeAttribute('transform');
    g.removeAttribute('opacity');
    return;
  }
  let op = 1;
  let tr = '';
  switch (item.anim) {
    case 'rise': {
      const e = easeOutCubic(t);
      op = Math.min(1, t * 3);
      tr = `translate(0 ${((1 - e) * Z * 1.1).toFixed(2)})`;
      break;
    }
    case 'drop': {
      const e = easeOutCubic(t);
      op = Math.min(1, t * 4);
      tr = `translate(0 ${(-(1 - e) * Z * 1.6).toFixed(2)})`;
      break;
    }
    case 'pop': {
      const s = Math.max(0, easeOutBack(t));
      op = Math.min(1, t * 4);
      const k = 1 - s;
      tr = `matrix(${s.toFixed(3)} 0 0 ${s.toFixed(3)} ${(item.pivotX * k).toFixed(2)} ${(item.pivotY * k).toFixed(2)})`;
      break;
    }
    case 'fade':
      op = t;
      break;
    case 'sun': {
      const e = easeOutCubic(t);
      op = Math.min(1, t * 2);
      tr = `translate(0 ${((1 - e) * 60).toFixed(2)})`;
      break;
    }
    case 'cloud': {
      const e = easeOutCubic(t);
      op = e;
      tr = `translate(${(-(1 - e) * 50).toFixed(2)} 0)`;
      break;
    }
  }
  if (tr) g.setAttribute('transform', tr);
  else g.removeAttribute('transform');
  g.setAttribute('opacity', op.toFixed(3));
}

function localT(item: Item, p: number) {
  const t = (p - item.start) / item.dur;
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

let mounts = 0;

export function mountFirstWorld(el_: HTMLElement): { update(progress: number): void } {
  const minX = -N * (W / 2) - 24;
  const maxX = N * (W / 2) + 24;
  const minY = -300;
  const maxY = N * H + PLATE * Z + 24;
  const svg = el('svg', {
    viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    width: '100%',
    preserveAspectRatio: 'xMidYMax meet',
    role: 'img',
    'aria-label': 'A world built from studded bricks',
  });
  svg.style.display = 'block';
  svg.style.height = 'auto';
  svg.style.maxWidth = '100%';

  const items: Item[] = [];
  const add = (parent: Element, layer: Layer, anim: Anim, order: number, pivot: [number, number], depth = 0) => {
    const g = el('g', { 'data-layer': layer }, parent);
    const [a, b] = LAYER_WINDOW[layer];
    const dur = DUR[layer];
    const item: Item = { g, layer, anim, start: a + order * (b - a - dur), dur, depth, pivotX: pivot[0], pivotY: pivot[1], last: NaN };
    items.push(item);
    return g;
  };

  // Layer 1 (back): sky, sun and clouds. Part of the lighting pass.
  const id = `fw${++mounts}`;
  const defs = el('defs', {}, svg);
  const grad = el('linearGradient', { id: `${id}-sky`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el('stop', { offset: 0, 'stop-color': '#bfe3ff' }, grad);
  el('stop', { offset: 1, 'stop-color': '#ffffff', 'stop-opacity': 0 }, grad);
  const edge = el('linearGradient', { id: `${id}-edge`, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
  for (const [o, a] of [[0, 0], [0.2, 1], [0.8, 1], [1, 0]]) el('stop', { offset: o, 'stop-color': '#fff', 'stop-opacity': a }, edge);
  const mask = el('mask', { id: `${id}-mask`, maskContentUnits: 'objectBoundingBox' }, defs);
  el('rect', { width: 1, height: 1, fill: `url(#${id}-edge)` }, mask);
  const back = el('g', { 'data-layer-group': 'sky' }, svg);
  el('rect', { x: minX, y: minY, width: maxX - minX, height: maxY - minY, fill: `url(#${id}-sky)`, mask: `url(#${id}-mask)` }, add(back, 'lighting', 'fade', 0, [0, 0]));
  const sun = add(back, 'lighting', 'sun', 0.1, [0, 0]);
  el('circle', { cx: 170, cy: -230, r: 46, fill: '#fff1c2', opacity: 0.9 }, sun);
  el('circle', { cx: 170, cy: -230, r: 30, fill: '#f2a900' }, sun);
  for (const [cx, cy, w, o] of [[-170, -215, 3, 0.35], [40, -255, 2, 0.6]] as const) {
    const cg = add(back, 'lighting', 'cloud', o, [0, 0]);
    for (let n = 0; n < w; n++) {
      el('rect', { x: cx + n * 28, y: cy, width: 30, height: 18, rx: 3, fill: '#ffffff' }, cg);
      el('rect', { x: cx + n * 28 + 4, y: cy - 6, width: 22, height: 8, rx: 3, fill: '#ffffff' }, cg);
    }
  }

  // Layer 2: the baseplate, always present.
  const plate = el('g', { 'data-layer-group': 'plate' }, svg);
  el('polygon', { points: `${pt(0, N, 0)} ${pt(N, N, 0)} ${pt(N, N, -PLATE)} ${pt(0, N, -PLATE)}`, fill: C.plate[1] }, plate);
  el('polygon', { points: `${pt(N, 0, 0)} ${pt(N, N, 0)} ${pt(N, N, -PLATE)} ${pt(N, 0, -PLATE)}`, fill: C.plate[2] }, plate);
  el('polygon', { points: `${pt(0, 0, 0)} ${pt(N, 0, 0)} ${pt(N, N, 0)} ${pt(0, N, 0)}`, fill: C.plate[0] }, plate);
  for (let s = 0; s < 2 * N - 1; s++) {
    for (let i = 0; i < N; i++) {
      const j = s - i;
      if (j < 0 || j >= N) continue;
      stud(plate, px(i + 0.5, j + 0.5), py(i + 0.5, j + 0.5, 0), C.plate);
    }
  }

  // Layer 3: the world. Terrain, props, foliage and shadows are interleaved in
  // painter's order so bricks overlap correctly; each group carries data-layer.
  const world = el('g', { 'data-layer-group': 'world' }, svg);
  const specs = buildSpecs().sort((a, b) => a.depth - b.depth);
  for (const s of specs) s.draw(add(world, s.layer, s.anim, s.order, s.pivot, s.depth));

  el_.appendChild(svg);

  const render = (p: number) => {
    const q = Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
    for (const it of items) apply(it, localT(it, q));
  };

  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    render(1);
    return { update() {} };
  }
  render(0);
  return { update: render };
}
