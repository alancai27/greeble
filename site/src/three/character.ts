import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Units: studs. Feet at y = 0, 5 studs tall. Classic six-part build in flat plastic colours.
export type PoseName = 'hang' | 'fall' | 'land' | 'stand';
export interface Character { object: THREE.Object3D; pose(name: PoseName, t: number): void }

const SKIN = 0xf5cd30;  // bright yellow: head and arms
const SHIRT = 0x0d69ac; // bright blue torso
const PANTS = 0xa4bd47; // yellowish green legs

const HIP_Y = 2;
const SHOULDER_Y = 4;
const NECK_Y = 4;

/** Hand tip of the right arm in `hang`, relative to the feet. hero.ts ties the string here. */
export const HANG_GRIP = new THREE.Vector3(1.5, SHOULDER_Y + 2, 0);

function plastic(color: number) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0 });
}

function part(geo: THREE.BufferGeometry, mat: THREE.Material, y: number) {
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function faceTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#1b1b1b';
    for (const x of [96, 160]) {
      g.beginPath();
      g.ellipse(x, 46, 9, 15, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#1b1b1b';
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(128, 62, 36, Math.PI * 0.2, Math.PI * 0.8);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A pivot group at `pos` with `mesh` hung below it (limbs) or sitting on it (head). */
function joint(pos: THREE.Vector3, ...children: THREE.Object3D[]) {
  const j = new THREE.Group();
  j.position.copy(pos);
  j.add(...children);
  return j;
}

interface Joints { rArm: THREE.Euler; lArm: THREE.Euler; rLeg: THREE.Euler; lLeg: THREE.Euler; neck: THREE.Euler }
type Angles = { [K in keyof Joints]: [number, number, number] };

const ZERO: Angles = { rArm: [0, 0, 0], lArm: [0, 0, 0], rLeg: [0, 0, 0], lLeg: [0, 0, 0], neck: [0, 0, 0] };

// Rotation z on an arm: positive swings the right arm out to +x; PI points it straight up.
function hangAngles(time: number): Angles {
  const k = Math.sin(time * 2.1);
  const k2 = Math.sin(time * 2.1 + 1.7);
  return {
    rArm: [0, 0, Math.PI],
    lArm: [0.1 * k2, 0, -0.45 - 0.12 * k],
    rLeg: [0.28 * k, 0, 0.06],
    lLeg: [-0.28 * k, 0, -0.06],
    neck: [0.18, 0, 0.1],
  };
}

function fallAngles(t: number): Angles {
  const w = Math.sin(t * Math.PI * 6) * (1 - t); // flail, settling as it nears the ground
  const spread = 1 - 0.5 * t;
  return {
    rArm: [0.3 * w, 0, Math.PI - 0.7 * spread + 0.25 * w],
    lArm: [-0.3 * w, 0, -(Math.PI - 0.7 * spread) + 0.25 * w],
    rLeg: [0.35 * w, 0, 0.3 * (1 - t)],
    lLeg: [-0.35 * w, 0, -0.3 * (1 - t)],
    neck: [-0.25 * spread, 0, 0],
  };
}

function mix(a: Angles, b: Angles, k: number): Angles {
  const out = {} as Angles;
  for (const key of Object.keys(a) as (keyof Angles)[]) {
    out[key] = [0, 1, 2].map((i) => a[key][i] + (b[key][i] - a[key][i]) * k) as [number, number, number];
  }
  return out;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => { const c = clamp01(x); return c * c * (3 - 2 * c); };

/**
 * pose(name, t):
 *   hang  t = seconds, drives a gentle leg kick (pass 0 for a still pose)
 *   fall  t = 0..1 through the fall
 *   land  t = 0..1 from impact to standing; squashes about the feet, ends exactly in `stand`
 *   stand t ignored
 */
export function createCharacter(): Character {
  const root = new THREE.Group();
  root.name = 'character';
  const body = new THREE.Group(); // squash pivot at the feet
  root.add(body);

  const skin = plastic(SKIN);
  const limb = new THREE.BoxGeometry(1, 2, 1);

  const torso = part(new THREE.BoxGeometry(2, 2, 1), plastic(SHIRT), 3);

  const headMesh = part(new RoundedBoxGeometry(2, 1, 1, 4, 0.32), skin, 0.5);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.8),
    new THREE.MeshStandardMaterial({ map: faceTexture(), transparent: true, alphaTest: 0.5, roughness: 0.5 }),
  );
  face.position.set(0, 0.5, 0.503);
  const neck = joint(new THREE.Vector3(0, NECK_Y, 0), headMesh, face);

  const rArm = joint(new THREE.Vector3(1.5, SHOULDER_Y, 0), part(limb, skin, -1));
  const lArm = joint(new THREE.Vector3(-1.5, SHOULDER_Y, 0), part(limb, skin, -1));
  const pants = plastic(PANTS);
  const rLeg = joint(new THREE.Vector3(0.5, HIP_Y, 0), part(limb, pants, -1));
  const lLeg = joint(new THREE.Vector3(-0.5, HIP_Y, 0), part(limb, pants, -1));

  body.add(torso, neck, rArm, lArm, rLeg, lLeg);
  const joints = { rArm, lArm, rLeg, lLeg, neck };

  const apply = (a: Angles) => {
    for (const key of Object.keys(joints) as (keyof Joints)[]) joints[key].rotation.set(...a[key]);
  };

  const squash = (amount: number) => {
    const y = 1 - amount;
    const xz = 1 / Math.sqrt(y); // keep the volume
    body.scale.set(xz, y, xz);
  };

  return {
    object: root,
    pose(name, t) {
      switch (name) {
        case 'hang':
          apply(hangAngles(t)); squash(0); break;
        case 'fall':
          apply(fallAngles(clamp01(t))); squash(0); break;
        case 'land': {
          const c = clamp01(t);
          apply(mix(fallAngles(1), ZERO, smooth(c / 0.7)));
          squash(c >= 1 ? 0 : 0.34 * Math.sin(Math.PI * Math.sqrt(c)));
          break;
        }
        default:
          apply(ZERO); squash(0);
      }
    },
  };
}
