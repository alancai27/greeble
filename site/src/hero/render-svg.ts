// SVG overlay for the figure and its string, drawn in document coordinates.
import { FIGURE, FIG_H, INK, MOUTH } from './figure';
import type { FigureState, Pt } from './drop';

const NS = 'http://www.w3.org/2000/svg';

export function svgRenderer(host: HTMLElement) {
  const layer = document.createElement('div');
  layer.className = 'figure-layer';
  layer.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '1');
  svg.setAttribute('height', '1');
  const mkLine = () => {
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('stroke', INK);
    l.setAttribute('stroke-width', '1.5');
    l.setAttribute('stroke-linecap', 'round');
    svg.appendChild(l);
    return l;
  };
  const upper = mkLine();
  const lower = mkLine();
  const g = document.createElementNS(NS, 'g');
  for (const r of FIGURE) {
    const el = document.createElementNS(NS, 'rect');
    el.setAttribute('x', String(r.x));
    el.setAttribute('y', String(r.y));
    el.setAttribute('width', String(r.w));
    el.setAttribute('height', String(r.h));
    if (r.rx) el.setAttribute('rx', String(r.rx));
    el.setAttribute('fill', r.fill);
    g.appendChild(el);
  }
  const mouth = document.createElementNS(NS, 'path');
  mouth.setAttribute('d', MOUTH);
  mouth.setAttribute('fill', 'none');
  mouth.setAttribute('stroke', INK);
  mouth.setAttribute('stroke-width', '1.4');
  mouth.setAttribute('stroke-linecap', 'round');
  g.appendChild(mouth);
  svg.appendChild(g);
  layer.appendChild(svg);
  host.appendChild(layer);

  const set = (l: SVGLineElement, a: Pt, b: Pt) => {
    l.setAttribute('x1', a.x.toFixed(2));
    l.setAttribute('y1', a.y.toFixed(2));
    l.setAttribute('x2', b.x.toFixed(2));
    l.setAttribute('y2', b.y.toFixed(2));
  };

  return (s: FigureState) => {
    if (s.snapped) {
      set(upper, s.anchor, s.upperEnd);
      set(lower, s.tie, s.lowerEnd);
      lower.style.display = '';
    } else {
      set(upper, s.anchor, s.tie);
      lower.style.display = 'none';
    }
    g.setAttribute(
      'transform',
      `translate(${s.centre.x.toFixed(2)} ${s.centre.y.toFixed(2)}) rotate(${((s.rot * 180) / Math.PI).toFixed(2)}) ` +
        `scale(${s.k}) translate(0 ${FIG_H / 2}) scale(${s.sx.toFixed(3)} ${s.sy.toFixed(3)}) translate(0 ${-FIG_H})`,
    );
  };
}
