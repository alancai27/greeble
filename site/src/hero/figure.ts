// The hanging figure: a blocky character in classic proportions, our own drawing.
// Six blocks (head, torso, two arms, two legs) plus a simple face.
// Local units, origin at the tie point (top centre of the head), y pointing down.

export const FIG_H = 64;

export const INK = '#1B2238';

export interface Rect { x: number; y: number; w: number; h: number; fill: string; rx?: number }

const SKIN = '#F5C83A';
const SKIN_SHADE = '#D9A91E';
const SHIRT = '#2F6FD6';
const SHIRT_SHADE = '#2358AE';
const PANTS = '#3F9B4F';
const PANTS_SHADE = '#2F7D3D';

// Each block is a fill plus a shaded right edge, lit from the left.
const block = (x: number, y: number, w: number, h: number, fill: string, shade: string): Rect[] => [
  { x, y, w, h, fill },
  { x: x + w - 3, y, w: 3, h, fill: shade },
];

export const FIGURE: Rect[] = [
  // head
  { x: -8, y: 0, w: 16, h: 14, fill: SKIN, rx: 3.5 },
  // torso and arms
  ...block(-12, 15, 24, 24, SHIRT, SHIRT_SHADE),
  ...block(-24.5, 15, 12, 24, SKIN, SKIN_SHADE),
  ...block(12.5, 15, 12, 24, SKIN, SKIN_SHADE),
  // legs
  ...block(-12, 39.5, 11.5, 24.5, PANTS, PANTS_SHADE),
  ...block(0.5, 39.5, 11.5, 24.5, PANTS, PANTS_SHADE),
  // eyes
  { x: -4.6, y: 4, w: 2, h: 3.6, fill: INK, rx: 1 },
  { x: 2.6, y: 4, w: 2, h: 3.6, fill: INK, rx: 1 },
];

/** the smile, stroked in INK */
export const MOUTH = 'M -4.2 9 Q 0 12.6 4.2 9';
