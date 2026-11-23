// Demo page driver for the first world: a slider sets progress.
import { mountFirstWorld } from './first';

const stage = document.getElementById('stage')!;
const slider = document.getElementById('progress') as HTMLInputElement;
const out = document.getElementById('value')!;

const world = mountFirstWorld(stage);

let queued = false;
const sync = () => {
  queued = false;
  const p = Number(slider.value);
  out.textContent = p.toFixed(2);
  world.update(p);
};
slider.addEventListener('input', () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(sync);
});

const q = new URLSearchParams(location.search).get('p');
if (q !== null) slider.value = q;
sync();
