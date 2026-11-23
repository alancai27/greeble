import * as THREE from 'three';

// Units: 1 = one stud, y up, ground top at y = 0.
export interface Frame { scrollY: number; viewportH: number; time: number; reducedMotion: boolean }
export interface Actor { object: THREE.Object3D; update(f: Frame): void }
export interface Stage { scene: THREE.Scene; camera: THREE.PerspectiveCamera; add(a: Actor): void }

const SCROLL_STOP_MS = 150;

/** One fixed, full-viewport canvas behind the page. Null when WebGL is unavailable. */
export function createStage(): Stage | null {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'stage';
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    zIndex: '-1', pointerEvents: 'none', display: 'block',
  });

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.prepend(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 400);
  camera.position.set(0, 22, 44);
  camera.lookAt(0, 5, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f9e, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-14, 30, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  const sc = sun.shadow.camera;
  sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 90;
  scene.add(sun, sun.target);

  const actors: Actor[] = [];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let width = 0;
  let height = 0;
  let dpr = 0;
  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const r = Math.min(window.devicePixelRatio || 1, 2);
    if (w === width && h === height && r === dpr) return false;
    width = w; height = h; dpr = r;
    renderer.setPixelRatio(r);
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    return true;
  };

  const render = (time: number) => {
    resize();
    const f: Frame = { scrollY: window.scrollY, viewportH: height, time, reducedMotion: motion.matches };
    for (const a of actors) a.update(f);
    renderer.render(scene, camera);
  };

  // Full motion: a frame loop that renders whenever scroll or time moved.
  let raf = 0;
  let lastScroll = NaN;
  let lastTime = NaN;
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const time = now / 1000;
    const scrollY = window.scrollY;
    if (time === lastTime && scrollY === lastScroll && !resize()) return;
    lastTime = time; lastScroll = scrollY;
    render(time);
  };

  // Reduced motion: one render when scrolling stops, with time = 0.
  let stopTimer = 0;
  const onScrollStill = () => {
    clearTimeout(stopTimer);
    stopTimer = window.setTimeout(() => render(0), SCROLL_STOP_MS);
  };

  const applyMode = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('scroll', onScrollStill);
    window.removeEventListener('resize', onScrollStill);
    clearTimeout(stopTimer);
    if (motion.matches) {
      window.addEventListener('scroll', onScrollStill, { passive: true });
      window.addEventListener('resize', onScrollStill);
      render(0);
    } else {
      lastTime = NaN;
      raf = requestAnimationFrame(tick);
    }
  };
  motion.addEventListener('change', applyMode);
  // Start after the current task so callers can add actors first.
  queueMicrotask(applyMode);

  return {
    scene,
    camera,
    add(a: Actor) {
      actors.push(a);
      scene.add(a.object);
      if (motion.matches) onScrollStill();
    },
  };
}
