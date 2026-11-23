// PROTOTYPE (issue #9): three takes on the hero and drop, picked with ?variant=a|b|c.
// Throwaway: once a variant wins, rebuild it properly and drop the rest.
import './style.css';
import { startDrop } from './prototype/drop';
import { svgRenderer } from './prototype/render-svg';
import { canvasRenderer } from './prototype/render-canvas';
import { mountSwitcher } from './prototype/switcher';

const NAMES: Record<string, string> = { a: 'Poster', b: 'Headline', c: 'Baseline' };
const KEYS = Object.keys(NAMES);

const asked = (new URLSearchParams(location.search).get('variant') ?? 'a').toLowerCase();
const variant = KEYS.includes(asked) ? asked : 'a';

const app = document.getElementById('app')!;
if (variant !== 'a') {
  const tpl = document.getElementById(`variant-${variant}`) as HTMLTemplateElement;
  app.replaceChildren(tpl.content.cloneNode(true));
}
document.body.dataset.variant = variant;

const $ = (sel: string) => app.querySelector<HTMLElement>(sel)!;
const small = () => window.innerWidth < 640;

if (variant === 'a') {
  // Poster: the figure hangs in the gap between the wordmark and the copy row.
  startDrop({
    letter: $('.anchor'),
    tieX: 0.3,
    tieEm: 0,
    ground: $('.ground'),
    scale: () => (small() ? 0.9 : 1.3),
    stringLen: (a, h) => $('.a-row').getBoundingClientRect().top + window.scrollY - a.y - h - 20,
    drift: 0,
    turns: 0,
    render: svgRenderer(document.body),
  });
} else if (variant === 'b') {
  // Headline: a long string from the small logo; the figure is the picture.
  startDrop({
    letter: $('.anchor'),
    tieX: 0.35,
    tieEm: 0,
    ground: $('.ground'),
    scale: () => (small() ? 1.5 : 2.3),
    stringLen: (a, h) => $('.b-headline').getBoundingClientRect().top + window.scrollY - a.y - h - 40,
    drift: 0.6,
    turns: 1,
    landAt: 0.7,
    render: svgRenderer(document.body),
  });
} else {
  // Baseline: short string under a huge wordmark; it swings out, snaps, flies.
  startDrop({
    letter: $('.anchor'),
    tieX: 0.5,
    tieEm: 0,
    ground: $('.ground'),
    scale: () => (small() ? 1 : 1.5),
    stringLen: (_a, h) => h * 0.9,
    drift: small() ? -1.4 : -3,
    turns: 0,
    windup: 0.22,
    windupAngle: -0.8,
    landAt: 0.6,
    render: canvasRenderer(document.body),
  });
}

if (import.meta.env.DEV) mountSwitcher(KEYS, NAMES, variant);
