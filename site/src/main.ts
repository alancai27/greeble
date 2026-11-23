import './style.css';
import { createStage } from './three/stage';
import { studdedBrick } from './three/studs';

const TURF = 0xcfe8c8; // pale turf keeps dark copy readable on top of it
const PLATE = 32;
const PLATE_H = 0.4;

// Without WebGL the page is the copy alone.
const stage = createStage();
if (stage) {
  const plate = studdedBrick(PLATE, PLATE_H, PLATE, TURF);
  plate.position.y = -PLATE_H; // top face at ground level
  stage.add({ object: plate, update() {} });
}
