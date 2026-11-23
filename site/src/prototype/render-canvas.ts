// PROTOTYPE (issue #9): canvas renderer, a fixed viewport-sized layer.
import { FIGURE, FIG_H, INK } from './figure';
import type { FigureState } from './drop';

export function canvasRenderer(host: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.className = 'figure-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  };
  fit();
  window.addEventListener('resize', fit);

  return (s: FigureState) => {
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(window.innerWidth * dpr)) fit();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.translate(-window.scrollX, -s.scrollY);

    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (s.snapped) {
      ctx.moveTo(s.anchor.x, s.anchor.y);
      ctx.lineTo(s.upperEnd.x, s.upperEnd.y);
      ctx.moveTo(s.tie.x, s.tie.y);
      ctx.lineTo(s.lowerEnd.x, s.lowerEnd.y);
    } else {
      ctx.moveTo(s.anchor.x, s.anchor.y);
      ctx.lineTo(s.tie.x, s.tie.y);
    }
    ctx.stroke();

    ctx.save();
    ctx.translate(s.centre.x, s.centre.y);
    ctx.rotate(s.rot);
    ctx.scale(s.k, s.k);
    ctx.translate(0, FIG_H / 2);
    ctx.scale(s.sx, s.sy);
    ctx.translate(0, -FIG_H);
    for (const r of FIGURE) {
      ctx.fillStyle = r.fill;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    ctx.restore();
  };
}
