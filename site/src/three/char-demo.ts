import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createCharacter, type PoseName } from './character';
import { createHero } from './hero';
import { studdedBrick } from './studs';

// Orbit the character; scrub h (hang, snap, fall, land) or a single pose's t.
const VIEWPORT_H = 1000; // fake viewport so h = scrollY / VIEWPORT_H
const ANCHOR = new THREE.Vector3(0, 15, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0xeef1f6);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 400);
camera.position.set(18, 12, 30);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 7, 0);
controls.enableDamping = true;
controls.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f9e, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-14, 30, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 20, bottom: -16 });
sun.shadow.bias = -0.0005;
scene.add(sun);

const plate = studdedBrick(16, 0.4, 16, 0xcfe8c8);
plate.position.y = -0.4;
scene.add(plate);

const hook = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 1), new THREE.MeshStandardMaterial({ color: 0x1b2238 }));
hook.position.copy(ANCHOR).add(new THREE.Vector3(0, 0.3, 0));
scene.add(hook);

const hero = createHero(() => ANCHOR);
scene.add(hero.object);
const solo = createCharacter();
scene.add(solo.object);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const mode = $<HTMLSelectElement>('mode');
const slider = $<HTMLInputElement>('t');
const out = $<HTMLOutputElement>('out');
const play = $<HTMLButtonElement>('play');
const calm = $<HTMLInputElement>('calm');

let playing = false;
let playFrom = 0;
play.addEventListener('click', () => {
  playing = !playing;
  play.textContent = playing ? 'Pause' : 'Play';
  if (playing && Number(slider.value) >= Number(slider.max)) slider.value = '0';
  playFrom = performance.now() / 1000 - Number(slider.value) / 0.4;
});
mode.addEventListener('change', () => {
  slider.max = mode.value === 'hero' ? '1.2' : mode.value === 'hang' ? '10' : '1';
  slider.value = '0';
});

const resize = () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  renderer.domElement.style.height = `${h}px`;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop((now) => {
  const time = now / 1000;
  if (playing) {
    const v = (time - playFrom) * 0.4;
    if (v >= Number(slider.max)) { playing = false; play.textContent = 'Play'; }
    slider.value = String(Math.min(v, Number(slider.max)));
  }
  const v = Number(slider.value);
  const isHero = mode.value === 'hero';
  hero.object.visible = isHero;
  solo.object.visible = !isHero;
  if (isHero) {
    hero.update({ scrollY: v * VIEWPORT_H, viewportH: VIEWPORT_H, time, reducedMotion: calm.checked });
    out.value = `h ${v.toFixed(3)}`;
  } else {
    solo.pose(mode.value as PoseName, v);
    out.value = `t ${v.toFixed(3)}`;
  }
  controls.update();
  renderer.render(scene, camera);
});

// For checks: hero transforms at a given h, time fixed.
window.heroAt = (h: number) => {
  hero.update({ scrollY: h * VIEWPORT_H, viewportH: VIEWPORT_H, time: 0, reducedMotion: calm.checked });
  hero.object.updateMatrixWorld(true);
  const vals: number[] = [];
  hero.object.traverse((o) => vals.push(...o.matrixWorld.elements));
  return vals;
};
(window as unknown as { feetAt: (h: number) => number }).feetAt = (h: number) => {
  window.heroAt(h);
  hero.object.children.forEach((c) => { c.visible = c.type !== 'Mesh'; }); // ignore the string
  const y = new THREE.Box3().setFromObject(hero.object, true).min.y;
  hero.object.children.forEach((c) => { c.visible = true; });
  return y;
};
// For checks: frame the solo character's head (or whole body) from an azimuth in degrees (0 = front).
(window as unknown as { view: (deg: number, close?: boolean) => void }).view = (deg, close = true) => {
  const a = (deg * Math.PI) / 180;
  const [y, d] = close ? [4.3, 9] : [2.6, 16];
  controls.target.set(0, y, 0);
  camera.position.set(Math.sin(a) * d, y + d * 0.12, Math.cos(a) * d);
  controls.update();
};
declare global { interface Window { heroAt: (h: number) => number[] } }
