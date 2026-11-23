import * as THREE from 'three';
import type { Frame, Stage } from './stage';
import { createHero } from './hero';
import { createWorld1 } from './world1';

// The main page story: the hero hangs from the wordmark's "b", falls as the page snaps to
// world-1, lands at the origin, and the world grows around it. h = scrollY / viewportH.

const HANG_LEN = 9.5;      // studs from the anchor down to the hanging feet
const HANG_FILL = 0.8;     // share of the wordmark-to-copy gap the hanging figure uses
const HERO_Y = 30;         // height the hero camera looks at; the fall starts around here
const SUBJECT_Y = 2.5;     // body centre of the standing character
const LAND_D = 64;         // camera distance on the baseplate
const LAND_AZ = 0.5;       // radians around y, from +z
const LAND_EL = 0.5;       // radians above the horizon
const ORBIT = 0.7;         // extra radians of orbit while scrolling through world-1
const BUILD_S = 2.5;       // seconds for the world to grow
const FALL_FROM = 0.15;    // hero.ts: string snaps
const FALL_TO = 0.85;      // hero.ts: feet touch the ground
const FOV_HALF = THREE.MathUtils.degToRad(35 / 2);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => { const c = clamp01(x); return c * c * (3 - 2 * c); };

interface Layout {
  w: number; h: number;
  heroD: number;       // camera distance at h = 0
  anchor: THREE.Vector3;
  landShift: number;   // NDC y the standing character should sit at (+ is up)
  landShiftX: number;  // NDC x, so wide screens keep the world beside the copy
  landD: number;
  worldH: number;      // h at which world-1 is snapped into place
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
  const art = document.querySelector('#world-1 .art');
  const world = document.getElementById('world-1');
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

  // Standing character sits in the middle of world-1's art band, above the copy.
  const top = world ? world.getBoundingClientRect().top + sy : h;
  const ar = art?.getBoundingClientRect();
  const artMid = ar ? ar.top + sy + ar.height / 2 - top : h * 0.25;
  // Wide screens: the world sits right of the copy. Narrow: the figure stands in the art band.
  const aspect = w / Math.max(h, 1);
  const wide = aspect > 1.2;
  const landShift = wide ? 0.1 : THREE.MathUtils.clamp(1 - (artMid / h) * 2, 0, 0.8);
  const landShiftX = wide ? 0.42 : 0;
  const landD = LAND_D * (aspect < 1 ? 1 + (1 - aspect) * 0.8 : 1);

  return { w, h, heroD, anchor, landShift, landShiftX, landD, worldH: Math.min(1, top / Math.max(h, 1)) };
}

/** Mounts the hero and world-1 on the stage and drives the camera from scroll. */
export function mountScene(stage: Stage): void {
  const { camera } = stage;
  let layout: Layout | null = null;
  let dirty = true;
  const remeasure = () => { dirty = true; };
  window.addEventListener('resize', remeasure);
  document.fonts?.ready.then(remeasure);

  const anchor = new THREE.Vector3();
  const world = createWorld1();
  let progress = 0;
  let shown = -1;
  let lastTime = NaN;

  const land: Pose = { target: new THREE.Vector3(0, SUBJECT_Y, 0), d: LAND_D, az: LAND_AZ, el: LAND_EL, shift: 0, shiftX: 0 };
  const pose: Pose = { target: new THREE.Vector3(), d: 0, az: 0, el: 0, shift: 0, shiftX: 0 };

  // The director runs first each frame: layout, camera and world progress.
  stage.add({
    object: world.object,
    update(f: Frame) {
      const w = window.innerWidth;
      const vh = f.viewportH;
      if (dirty || !layout || layout.w !== w || layout.h !== vh) {
        layout = measure(w, vh);
        anchor.copy(layout.anchor);
        dirty = false;
      }
      const h = Math.max(0, f.scrollY / Math.max(vh, 1));

      // Camera: hero pose -> landing pose over the fall, then a slow orbit through world-1.
      const hero = heroPose(layout);
      land.d = layout.landD;
      land.shift = layout.landShift;
      land.shiftX = layout.landShiftX;
      const k = smooth(h / 0.95);
      // The look point drops with the same gravity curve as the fall in hero.ts.
      pose.target.lerpVectors(hero.target, land.target, clamp01((h - FALL_FROM) / (FALL_TO - FALL_FROM)) ** 2);
      pose.d = hero.d + (land.d - hero.d) * k;
      pose.el = hero.el + (land.el - hero.el) * k;
      pose.az = hero.az + (land.az - hero.az) * k + ORBIT * clamp01(h - 1);
      pose.shift = hero.shift + (land.shift - hero.shift) * k;
      pose.shiftX = hero.shiftX + (land.shiftX - hero.shiftX) * k;
      place(camera, pose, w, vh);

      // World: grows over BUILD_S once world-1 is in place, shrinks back when it leaves.
      const atWorld = h >= layout.worldH - 0.01;
      if (f.reducedMotion) {
        progress = atWorld ? 1 : 0;
      } else {
        const dt = Number.isFinite(lastTime) ? Math.min(Math.max(f.time - lastTime, 0), 0.1) : 0;
        progress = clamp01(progress + (atWorld ? dt : -dt) / BUILD_S);
      }
      lastTime = f.time;
      if (progress !== shown) {
        world.setProgress(progress);
        shown = progress;
      }
    },
  });

  stage.add(createHero(() => anchor));
}
