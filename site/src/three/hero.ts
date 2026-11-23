import * as THREE from 'three';
import type { Actor, Frame } from './stage';
import { createCharacter, HANG_GRIP } from './character';

// h = scrollY / viewportH. Every pose below is a function of h (plus Frame.time for the
// sway, which fades to zero before the snap), so jumps and slow scrolls land on the same state.
const SNAP_H = 0.15;     // string breaks
const RETRACT_H = 0.12;  // the broken ends spring back over this much h
const LAND_H = 0.85;     // feet touch y = 0 with the next section mostly in view
const STAND_H = 1;       // squash done, standing

const STRING_LEN = 3;    // studs between anchor and hand
const STRETCH = 0.8;     // the string gives this much before it snaps
const SWAY = 0.12;       // radians
const TWIST = 0.35;      // radians, slow turn on the string
const CENTER_Y = 2.5;    // body centre above the feet; tumbles turn about it

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => { const c = clamp01(x); return c * c * (3 - 2 * c); };

const Z = new THREE.Vector3(0, 0, 1);
const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);

function stringMesh(mat: THREE.Material) {
  const geo = new THREE.CylinderGeometry(0.06, 0.06, 1, 6);
  geo.translate(0, -0.5, 0); // spans y 0..-1, so scale.y is its length
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

/** anchor: world point the string hangs from, read every frame. */
export function createHero(anchor: () => THREE.Vector3): Actor {
  const root = new THREE.Group();
  root.name = 'hero';
  const character = createCharacter();
  const carrier = new THREE.Group(); // sits at the body centre
  character.object.position.y = -CENTER_Y;
  carrier.add(character.object);

  // Grip relative to the body centre; tilt so the hand is straight above the centre.
  const grip = HANG_GRIP.clone().setY(HANG_GRIP.y - CENTER_Y);
  const gripLen = grip.length();
  const tilt = Math.atan2(grip.x, grip.y);
  const qTilt = new THREE.Quaternion().setFromAxisAngle(Z, tilt);

  const stringMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.8 });
  const upper = stringMesh(stringMat);
  // The piece left in the hand points from the grip back along the old string line.
  const lower = stringMesh(stringMat);
  lower.position.copy(grip);
  lower.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), grip.clone().normalize());
  carrier.add(lower);
  root.add(upper, carrier);

  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const tmp = new THREE.Vector3();

  const update = (f: Frame) => {
    const h = Math.max(0, f.scrollY / Math.max(f.viewportH, 1));
    const a = anchor();
    const calm = f.reducedMotion;
    const len = STRING_LEN + STRETCH * clamp01(h / SNAP_H) ** 2;

    if (h < SNAP_H) {
      const live = calm ? 0 : 1 - smooth(h / SNAP_H);
      const sway = SWAY * live * Math.sin(f.time * 1.6);
      const twist = TWIST * live * Math.sin(f.time * 0.7);
      qa.setFromAxisAngle(Z, sway);
      // carrier = sway * twist * tilt, hung (len + grip) below the anchor along the swung string
      carrier.quaternion.copy(qa).multiply(qb.setFromAxisAngle(Y, twist)).multiply(qTilt);
      tmp.set(0, -(len + gripLen), 0).applyQuaternion(qa);
      carrier.position.copy(a).add(tmp);
      upper.position.copy(a);
      upper.quaternion.copy(qa);
      upper.scale.y = len;
      upper.visible = true;
      lower.visible = false;
      lower.scale.y = len * 0.5;
      character.pose('hang', calm ? 0 : f.time * live);
      return;
    }

    // Broken ends spring back: the top piece to the anchor, the bottom piece into the hand.
    const left = 1 - smooth((h - SNAP_H) / RETRACT_H);
    upper.visible = lower.visible = left > 0;
    upper.position.copy(a);
    upper.quaternion.identity();
    upper.scale.y = Math.max(left * len * 0.5, 1e-3);
    lower.scale.y = Math.max(left * len * 0.5, 1e-3);

    if (h < LAND_H) {
      const u = (h - SNAP_H) / (LAND_H - SNAP_H);
      const startY = a.y - (len + gripLen);
      const e = smooth(u);
      carrier.position.set(
        a.x * (1 - e),
        startY + (CENTER_Y - startY) * u * u, // gravity: slow off the string, fastest at impact
        a.z * (1 - e),
      );
      // One forward tumble while the tilt from hanging unwinds.
      carrier.quaternion.setFromAxisAngle(X, -Math.PI * 2 * e).multiply(qb.setFromAxisAngle(Z, tilt * (1 - e)));
      character.pose('fall', u);
      return;
    }

    carrier.position.set(0, CENTER_Y, 0);
    carrier.quaternion.identity();
    if (calm || h >= STAND_H) character.pose('stand', 0);
    else character.pose('land', (h - LAND_H) / (STAND_H - LAND_H));
  };

  return { object: root, update };
}
