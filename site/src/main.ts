import './style.css';
import { createStage } from './three/stage';
import { mountScene } from './three/scene';

// Without WebGL the page is the copy alone.
const stage = createStage();
if (stage) mountScene(stage);
