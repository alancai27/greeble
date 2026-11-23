// PROTOTYPE (issue #9): scroll-tied hang, snap and drop.
// Position is a pure function of scrollY, so the figure always lands
// exactly on the ground whatever the scroll speed or direction.
// Only the sway and the landing squash run on the clock.

import { FIG_H } from './figure';

export interface Pt { x: number; y: number }

export interface FigureState {
  anchor: Pt;      // where the string is tied to the letter (document px)
  centre: Pt;      // centre of the figure (document px)
  rot: number;     // radians, clockwise
  k: number;       // figure scale
  sx: number;      // squash x
  sy: number;      // squash y
  snapped: boolean;
  tie: Pt;         // tie point on the figure
  upperEnd: Pt;    // end of the string piece left on the letter
  lowerEnd: Pt;    // end of the string piece still on the figure (== anchor while intact)
  scrollY: number;
  progress: number;
}

export interface DropConfig {
  letter: HTMLElement;
  /** fraction across the letter box where the string ties on */
  tieX: number;
  /** distance above the baseline, in em, where the string ties on */
  tieEm: number;
  ground: HTMLElement;
  scale: () => number;
  /** string length in px, given the anchor point and figure height in px */
  stringLen: (anchor: Pt, figH: number) => number;
  /** horizontal travel during the fall, in figure heights */
  drift: number;
  /** whole turns during the fall (integer, so it lands upright) */
  turns: number;
  /** share of the scroll spent swinging out before the snap (0 = snap at once) */
  windup?: number;
  windupAngle?: number;
  /** where the ground sits in the viewport when the landing completes (0..1) */
  landAt?: number;
  render: (s: FigureState) => void;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const rotV = (x: number, y: number, r: number): Pt => ({
  x: x * Math.cos(r) - y * Math.sin(r),
  y: x * Math.sin(r) + y * Math.cos(r),
});

export function startDrop(cfg: DropConfig): () => void {
  const probe = document.createElement('span');
  probe.className = 'baseline-probe';
  probe.setAttribute('aria-hidden', 'true');
  cfg.letter.after(probe);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let m = measure();
  let prevP = 0;
  let landT: number | null = null;
  let raf = 0;

  function measure() {
    const sy = window.scrollY;
    const lr = cfg.letter.getBoundingClientRect();
    const pr = probe.getBoundingClientRect();
    const em = parseFloat(getComputedStyle(cfg.letter).fontSize);
    const anchor = { x: lr.left + window.scrollX + lr.width * cfg.tieX, y: pr.top + sy - cfg.tieEm * em };
    const k = cfg.scale();
    const figH = FIG_H * k;
    const L = Math.max(12, cfg.stringLen(anchor, figH));
    const groundTop = cfg.ground.getBoundingClientRect().top + sy;
    const vh = window.innerHeight;
    const start = 8;
    const end = Math.max(start + 160, groundTop - (cfg.landAt ?? 0.65) * vh);
    return { anchor, k, figH, L, groundTop, start, end };
  }

  function frame(now: number) {
    const still = reduce.matches;
    const { anchor, k, figH, L, groundTop, start, end } = m;
    const scrollY = window.scrollY;
    const p = still ? 0 : clamp((scrollY - start) / (end - start), 0, 1);
    const t = still ? 0 : now / 1000;
    const sway = 0.07 * Math.sin((t * 2 * Math.PI) / 2.8);
    const half = figH / 2;
    const windup = cfg.windup ?? 0;
    const wAngle = cfg.windupAngle ?? 0;

    let centre: Pt;
    let rot: number;
    let snapped: boolean;

    if (p <= windup && (windup > 0 || p === 0)) {
      // hanging: a pendulum from the letter
      const w = windup > 0 ? smooth(p / windup) : 0;
      const th = sway * (1 - w) + wAngle * w;
      centre = { x: anchor.x + (L + half) * Math.sin(th), y: anchor.y + (L + half) * Math.cos(th) };
      rot = -th;
      snapped = false;
    } else {
      const q = windup > 0 ? (p - windup) / (1 - windup) : p;
      const th0 = windup > 0 ? wAngle : 0;
      const c0 = { x: anchor.x + (L + half) * Math.sin(th0), y: anchor.y + (L + half) * Math.cos(th0) };
      const margin = figH;
      const landX = clamp(c0.x + cfg.drift * figH, margin, document.documentElement.clientWidth - margin);
      const c1 = { x: landX, y: groundTop - half };
      // gravity: y goes with q squared; a released swing adds a little lift
      const lift = windup > 0 ? Math.sin(Math.PI * q) * figH * 0.8 * (1 - q) : 0;
      centre = { x: lerp(c0.x, c1.x, windup > 0 ? q : smooth(q)), y: lerp(c0.y, c1.y, q * q) - lift };
      rot = lerp(-th0, 0, smooth(q)) + cfg.turns * 2 * Math.PI * smooth(q);
      snapped = true;
    }

    // landing squash, triggered when the scroll first reaches the ground
    if (p >= 1 && prevP < 1 && !still) landT = now;
    if (p < 1) landT = null;
    prevP = p;
    let sx = 1;
    let sy = 1;
    if (landT !== null) {
      const dt = now - landT;
      if (dt < 700) {
        const s = 0.42 * Math.exp(-dt / 120) * Math.cos(dt / 60);
        sy = 1 - s;
        sx = 1 + s * 0.7;
      }
    }

    const tieOff = rotV(0, k * (FIG_H / 2 - FIG_H * sy), rot);
    const tie = { x: centre.x + tieOff.x, y: centre.y + tieOff.y };
    let upperEnd: Pt;
    let lowerEnd: Pt;
    if (!snapped) {
      upperEnd = tie;
      lowerEnd = anchor;
    } else {
      const ua = sway * 1.6;
      upperEnd = { x: anchor.x + L * 0.42 * Math.sin(ua), y: anchor.y + L * 0.42 * Math.cos(ua) };
      const trail = Math.min(L * 0.35, figH * 1.4) * (1 - 0.5 * p);
      const lo = rotV(Math.sin(t * 9) * 2, -trail, rot);
      lowerEnd = { x: tie.x + lo.x, y: tie.y + lo.y };
    }

    cfg.render({ anchor, centre, rot, k, sx, sy, snapped, tie, upperEnd, lowerEnd, scrollY, progress: p });
    if (!still || landT !== null) raf = requestAnimationFrame(frame);
    else raf = 0;
  }

  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };
  const remeasure = () => {
    m = measure();
    kick();
  };

  window.addEventListener('resize', remeasure);
  window.addEventListener('scroll', kick, { passive: true });
  reduce.addEventListener('change', remeasure);
  const ro = new ResizeObserver(remeasure);
  ro.observe(document.body);
  document.fonts?.ready.then(remeasure);
  kick();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', remeasure);
    window.removeEventListener('scroll', kick);
    reduce.removeEventListener('change', remeasure);
    ro.disconnect();
    probe.remove();
  };
}
