import './style.css';
import { startDrop } from './hero/drop';
import { svgRenderer } from './hero/render-svg';

const $ = (sel: string) => document.querySelector<HTMLElement>(sel)!;
const small = () => window.innerWidth < 640;

// The figure hangs from the "b" in the gap between the wordmark and the copy row,
// then drops onto the studded strip at the top of the first world.
startDrop({
  letter: $('.hero .anchor'),
  tieX: 0.3,
  ground: $('#world-1 .strip'),
  scale: () => (small() ? 0.85 : 1.25),
  stringLen: (a, h) => $('.hero-row').getBoundingClientRect().top + window.scrollY - a.y - h - 20,
  landAt: 0.65,
  render: svgRenderer(document.body),
});
