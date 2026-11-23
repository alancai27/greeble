import { createStage } from './stage';
import { studdedBrick } from './studs';

const stage = createStage();
if (!stage) {
  document.querySelector('#note')!.textContent = 'WebGL is unavailable in this browser.';
} else {
  stage.camera.position.set(0, 9, 16);
  stage.camera.lookAt(0, 1, 0);

  const ground = studdedBrick(16, 0.4, 10, 0x3f9b4f);
  ground.position.y = -0.4;
  stage.add({ object: ground, update() {} });

  const bricks: [w: number, h: number, d: number, color: number, x: number, z: number][] = [
    [1, 1.2, 1, 0xf2a900, -5.5, 0.5],
    [2, 1.2, 2, 0xd9342b, -3, 0],
    [4, 1.2, 2, 0x1e6fd9, 1, 0],
    [2, 0.4, 6, 0xf4f4f0, 5, 1],
    [3, 2.4, 1, 0x1b2238, -0.5, -3.5],
  ];
  for (const [w, h, d, color, x, z] of bricks) {
    const b = studdedBrick(w, h, d, color);
    b.position.set(x, 0, z);
    const base = b.rotation.y;
    stage.add({
      object: b,
      update: (f) => { b.rotation.y = base + Math.sin(f.time * 0.6 + x) * 0.15; },
    });
  }
}
