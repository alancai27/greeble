import * as THREE from 'three';
import type { Frame, Stage } from './stage';
import { createHero } from './hero';
import { createWorld, type Theme } from './world1';

// The main page story: the hero hangs from the wordmark's "b", falls as the page snaps to
// world-1, lands at the origin, and the world grows around it. h = scrollY / viewportH.
// Between two world sections the old world shrinks away while the plate turns a quarter
// turn and slides to the other side; the next section's world grows once it arrives.

const HANG_LEN = 9.5;      // studs from the anchor down to the hanging feet
const HANG_FILL = 0.8;     // share of the wordmark-to-copy gap the hanging figure uses
const HERO_Y = 30;         // height the hero camera looks at; the fall starts around here
const SUBJECT_Y = 2.5;     // body centre of the standing character
const LAND_D = 64;         // camera distance on the baseplate
const LAND_AZ = 0.5;       // radians around y, from +z
const LAND_EL = 0.5;       // radians above the horizon
const BUILD_S = 2.5;       // seconds for the world to grow
const CLEAR_S = 0.5;       // seconds for a world to shrink away when another one is due
const CLEAR_AT = 0.85;     // share of a transition by which the old world is gone
const WIDE_PX = 1024;      // at and above: world and copy side by side
const SIDE_X = 0.5;        // NDC x of the world's centre on wide screens: middle of its half
const PLATE_R = 23;        // studs: the plate's widest half-extent at any turn
const FILL = 0.8;          // share of its half of the screen the plate may span
const THEMES: Theme[] = ['meadow', 'desert', 'neon', 'snow'];
const SECTIONS = ['world-1', 'world-2', 'world-3', 'world-4'];
const FALL_FROM = 0.15;    // hero.ts: string snaps
const FALL_TO = 0.85;      // hero.ts: feet touch the ground
const FOV_HALF = THREE.MathUtils.degToRad(35 / 2);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => { const c = clamp01(x); return c * c * (3 - 2 * c); };

interface Layout {
  w: number; h: number;
  heroD: number;       // camera distance at h = 0
  anchor: THREE.Vector3;
  landD: number;
  worldH: number;      // h at which world-1 is snapped into place
  tops: number[];      // per world section: scrollY of its snap point
  shift: number[];     // per world: NDC y the standing character sits at (+ is up)
  shiftX: number[];    // per world: NDC x, so wide screens keep the world beside the copy
  sky: THREE.Color[];  // per world: page background behind the canvas
}

interface Pose { target: THREE.Vector3; d: number; az: number; el: number; shift: number; shiftX: number }

function heroPose(l: Pick<Layout, 'heroD'>): Pose {
  return { target: new THREE.Vector3(0, HERO_Y, 0), d: l.heroD, az: 0, el: 0, shift: 0, shiftX: 0 };
}

function place(cam: THREE.PerspectiveCamera, p: Pose, w: number, h: number) {
  const ce = Math.cos(p.el);
  cam.position.set(
    p.target.x + p.d * Math.sin(p.az) * ce,
    p.target.y + p.d * Math.sin(p.el),
    p.target.z + p.d * Math.cos(p.az) * ce,
  );
  cam.lookAt(p.target);
  // Shift the image so the target sits at NDC (shiftX, shift) without turning the view.
  if (p.shift || p.shiftX) cam.setViewOffset(w, h, (-p.shiftX * w) / 2, (p.shift * h) / 2, w, h);
  else cam.clearViewOffset();
  cam.updateMatrixWorld();
}


function measure(w: number, h: number): Layout {
  const b = document.querySelector('.wordmark .anchor');
  const row = document.querySelector('.hero-row');
  const sy = window.scrollY;

  // Glyph bottom of the "b": its baseline sits about a fifth of the em box above the box bottom.
  const br = b?.getBoundingClientRect();
  const bx = br ? br.left + br.width * 0.55 : w / 2;
  const by = br ? br.bottom + sy - br.height * 0.2 : h * 0.3;
  const rowTop = row ? row.getBoundingClientRect().top + sy : by + h * 0.25;
  const gap = Math.max(rowTop - by, h * 0.12);
  const pxPerStudAt1 = h / (2 * Math.tan(FOV_HALF));
  const heroD = THREE.MathUtils.clamp((HANG_LEN * pxPerStudAt1) / (gap * HANG_FILL), 30, 160);

  // Anchor: the "b" unprojected onto the z = 0 plane through the hero camera. Fixed in the world.
  const cam = new THREE.PerspectiveCamera(35, w / Math.max(h, 1), 0.5, 400);
  place(cam, heroPose({ heroD }), w, h);
  const ndc = new THREE.Vector3((bx / w) * 2 - 1, 1 - (by / h) * 2, 0.5).unproject(cam);
  const dir = ndc.sub(cam.position).normalize();
  const t = -cam.position.z / dir.z;
  const anchor = cam.position.clone().addScaledVector(dir, t);

  // Wide: the world fills the middle of its half, the copy has the other half; sides alternate.
  // Narrow: the world stands in the art band above the copy card.
  const aspect = w / Math.max(h, 1);
  const wide = w >= WIDE_PX;
  const tanH = Math.tan(FOV_HALF);
  const landD = wide
    ? Math.max(LAND_D, PLATE_R / ((FILL * tanH * aspect) / 2))
    : LAND_D * (aspect < 1 ? 1 + (1 - aspect) * 0.8 : 1);

  const tops: number[] = [];
  const shift: number[] = [];
  const shiftX: number[] = [];
  const sky: THREE.Color[] = [];
  SECTIONS.forEach((id, i) => {
    const sec = document.getElementById(id);
    const r = sec?.getBoundingClientRect();
    const top = r ? r.top + sy : h * (i + 1);
    tops.push(top);
    const ar = sec?.querySelector('.art')?.getBoundingClientRect();
    const artMid = ar && ar.height ? ar.top + sy + ar.height / 2 - top : h * 0.25;
    shift.push(wide ? 0 : THREE.MathUtils.clamp(1 - (artMid / h) * 2, 0, 0.8));
    shiftX.push(wide ? (i % 2 ? -SIDE_X : SIDE_X) : 0);
    const c = sec ? getComputedStyle(sec).getPropertyValue('--sky').trim() : '';
    sky.push(new THREE.Color(c || '#ffffff'));
  });

  return { w, h, heroD, anchor, landD, worldH: Math.min(1, tops[0] / Math.max(h, 1)), tops, shift, shiftX, sky };
}

/** Where scrollY sits in the world sections: between world n and n + 1, u of the way. */
function locate(l: Layout, y: number): { n: number; u: number } {
  const last = SECTIONS.length - 1;
  for (let n = 0; n < last; n++) {
    const end = l.tops[n + 1];
    if (y >= end) continue;
    // The turn runs over the last screen of scrolling before the next snap point,
    // so a section taller than the screen keeps its world while its copy scrolls.
    const start = Math.min(end - 1, Math.max(l.tops[n], end - l.h));
    return { n, u: clamp01((y - start) / (end - start)) };
  }
  return { n: last, u: 0 }; // the last world, and the footer: it stays
}

/** Mounts the hero and the four section worlds on the stage and drives them from scroll. */
export function mountScene(stage: Stage): void {
  const { camera } = stage;
  let layout: Layout | null = null;
  let dirty = true;
  const remeasure = () => { dirty = true; };
  window.addEventListener('resize', remeasure);
  document.fonts?.ready.then(remeasure);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);

  const anchor = new THREE.Vector3();
  // Only the world being shown is in the scene; the plate turns about its centre, under the character.
  const worlds = THEMES.map((t) => createWorld(t));
  const pivot = new THREE.Group();
  pivot.name = 'worlds';
  let shown = 0;
  pivot.add(worlds[0].object);
  let progress = 0;
  let applied = -1;
  let lastTime = NaN;
  let bg = '';
  const sky = new THREE.Color();

  const show = (i: number) => {
    if (i === shown) return;
    pivot.remove(worlds[shown].object);
    worlds[shown].setProgress(0);
    shown = i;
    pivot.add(worlds[i].object);
    applied = -1;
  };

  // The character belongs to world-1: it shrinks away with the meadow through the first
  // turn, on the same scroll value, and is out of the scene for the later worlds.
  const character = createHero(() => anchor);
  const figure = character.object;

  const land: Pose = { target: new THREE.Vector3(0, SUBJECT_Y, 0), d: LAND_D, az: LAND_AZ, el: LAND_EL, shift: 0, shiftX: 0 };
  const pose: Pose = { target: new THREE.Vector3(), d: 0, az: 0, el: 0, shift: 0, shiftX: 0 };

  // The director runs first each frame: layout, camera, the plate's turn and world progress.
  stage.add({
    object: pivot,
    update(f: Frame) {
      const w = window.innerWidth;
      const vh = f.viewportH;
      if (dirty || !layout || layout.w !== w || layout.h !== vh) {
        layout = measure(w, vh);
        anchor.copy(layout.anchor);
        dirty = false;
      }
      const l = layout;
      const h = Math.max(0, f.scrollY / Math.max(vh, 1));
      const pre = h < l.worldH - 0.01; // still above world-1's snap point
      const { n, u } = pre ? { n: 0, u: 0 } : locate(l, f.scrollY);
      const calm = f.reducedMotion;
      // Reduced motion: no turn and no build; the nearer section's world just appears.
      const at = calm ? (u >= 0.5 ? n + 1 : n) : n;
      const e = calm ? 0 : smooth(u);
      const next = Math.min(at + 1, SECTIONS.length - 1);

      // Camera: hero pose -> landing pose over the fall; on the plate it only slides sideways.
      const hero = heroPose(l);
      land.d = l.landD;
      land.shift = l.shift[at] + (l.shift[next] - l.shift[at]) * e;
      land.shiftX = l.shiftX[at] + (l.shiftX[next] - l.shiftX[at]) * e;
      const k = smooth(h / 0.95);
      // The look point drops with the same gravity curve as the fall in hero.ts.
      pose.target.lerpVectors(hero.target, land.target, clamp01((h - FALL_FROM) / (FALL_TO - FALL_FROM)) ** 2);
      pose.d = hero.d + (land.d - hero.d) * k;
      pose.el = hero.el + (land.el - hero.el) * k;
      pose.az = hero.az + (land.az - hero.az) * k;
      pose.shift = hero.shift + (land.shift - hero.shift) * k;
      pose.shiftX = hero.shiftX + (land.shiftX - hero.shiftX) * k;
      place(camera, pose, w, vh);

      // The plate: a quarter turn per section, driven by scroll so it reverses.
      pivot.rotation.y = -(at + e) * (Math.PI / 2);

      // Page sky follows the section, blended through the turn.
      sky.copy(l.sky[at]).lerp(l.sky[next], e);
      const css = `#${sky.getHexString()}`;
      if (css !== bg) {
        document.documentElement.style.backgroundColor = css;
        bg = css;
      }

      // World: the old one shrinks with the scroll through the turn; the new one grows over
      // BUILD_S once it has arrived. A world that isn't due shrinks away before the swap.
      const dt = Number.isFinite(lastTime) ? Math.min(Math.max(f.time - lastTime, 0), 0.1) : 0;
      lastTime = f.time;
      if (calm) {
        show(at);
        progress = pre ? 0 : 1;
      } else {
        const target = pre ? 0 : 1 - clamp01(u / CLEAR_AT);
        if (shown !== n) {
          progress -= dt / CLEAR_S;
          if (progress <= 0) {
            show(n);
            progress = 0;
          }
        } else if (progress < target) {
          progress = Math.min(target, progress + dt / BUILD_S);
        } else {
          progress = Math.max(target, progress - dt / (pre ? BUILD_S : CLEAR_S));
        }
      }
      const keep = pre ? 1 : calm ? (at === 0 ? 1 : 0) : n === 0 ? 1 - smooth(u / CLEAR_AT) : 0;
      figure.visible = keep > 0.001;
      figure.scale.setScalar(Math.max(keep, 0.001));

      if (progress !== applied) {
        worlds[shown].setProgress(progress);
        applied = progress;
      }
    },
  });

  stage.add(character);
}
