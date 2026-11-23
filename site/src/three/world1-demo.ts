import * as THREE from 'three';
import { createWorld1 } from './world1';

// Demo: a slider drives the world's progress; the camera orbits slowly.
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 400);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f9e, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-14, 30, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
scene.add(sun, sun.target);

const world = createWorld1();
scene.add(world.object);

const slider = document.querySelector<HTMLInputElement>('#p')!;
const pv = document.querySelector<HTMLElement>('#pv')!;
const stats = document.querySelector<HTMLElement>('#stats')!;
const initial = Number(new URLSearchParams(location.search).get('p') ?? 0);
slider.value = String(initial);

let progress = NaN;
const sky = (p: number) => {
  const l = Math.min(1, Math.max(0, (p - 0.8) / 0.2));
  const top = new THREE.Color(0xbfe3ff).lerp(new THREE.Color(0xffb27a), l * 0.8);
  const bottom = new THREE.Color(0xeef7ff).lerp(new THREE.Color(0xffe2b8), l);
  document.body.style.background = `linear-gradient(#${top.getHexString()}, #${bottom.getHexString()})`;
};

const RADIUS = 24; // bounding radius of the world and its tallest pieces
const resize = () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
};
window.addEventListener('resize', resize);
resize();

const still = new URLSearchParams(location.search).has('still');
const tick = (now: number) => {
  requestAnimationFrame(tick);
  const p = Number(slider.value);
  if (p !== progress) {
    progress = p;
    world.setProgress(p);
    pv.textContent = p.toFixed(2);
    sky(p);
  }
  const vFov = THREE.MathUtils.degToRad(camera.fov) / 2;
  const hFov = Math.atan(Math.tan(vFov) * camera.aspect);
  const dist = RADIUS / Math.sin(Math.min(vFov, hFov));
  const a = still ? 0.6 : 0.6 + now * 0.00008;
  camera.position.set(Math.sin(a) * dist * 0.85, dist * 0.52, Math.cos(a) * dist * 0.85);
  camera.lookAt(0, 1, 0);
  renderer.render(scene, camera);
  stats.textContent = `${renderer.info.render.calls} draw calls`;
};
requestAnimationFrame(tick);
