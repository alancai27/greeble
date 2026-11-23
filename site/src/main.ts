import './style.css';
import { createStage } from './three/stage';
import { mountScene } from './three/scene';

// Without WebGL the page is the copy alone, on each section's own sky.
const stage = createStage();
if (stage) {
  // With the stage, sections are see-through and the scene paints the sky on <html>.
  document.documentElement.classList.add('has-stage');
  mountScene(stage);
}
