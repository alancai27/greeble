import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const STUD_RADIUS = 0.3;
const STUD_HEIGHT = 0.18;
const STUD_SEGMENTS = 16;

/**
 * A brick w x h x d (in studs) with one round stud per whole stud on its top face.
 * Origin is the centre of the bottom face, so the stud bases sit at y = h.
 */
export function studdedBrick(w: number, h: number, d: number, color: number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.BoxGeometry(w, h, d);
  body.translate(0, h / 2, 0);
  parts.push(body);

  const nx = Math.max(1, Math.floor(w));
  const nz = Math.max(1, Math.floor(d));
  const stud = new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, STUD_SEGMENTS);
  for (let i = 0; i < nx; i++) {
    for (let k = 0; k < nz; k++) {
      const g = stud.clone();
      g.translate(-nx / 2 + 0.5 + i, h + STUD_HEIGHT / 2, -nz / 2 + 0.5 + k);
      parts.push(g);
    }
  }
  const geometry = mergeGeometries(parts) ?? body;
  for (const p of parts) if (p !== geometry) p.dispose();
  stud.dispose();

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0 }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
