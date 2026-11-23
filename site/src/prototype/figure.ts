// PROTOTYPE (issue #9): the hanging figure, shared by all three variants.
// Original art: a one-block critter with a visor and two stub feet.
// Local units, origin at the tie point (top centre), y pointing down.

export const FIG_H = 46;

export interface Rect { x: number; y: number; w: number; h: number; fill: string }

export const INK = '#1B2238';

export const FIGURE: Rect[] = [
  // tie loop
  { x: -4, y: 0, w: 8, h: 2, fill: INK },
  { x: -4, y: 0, w: 2, h: 7, fill: INK },
  { x: 2, y: 0, w: 2, h: 7, fill: INK },
  // body block: face, lit top, shaded side
  { x: -20, y: 6, w: 40, h: 32, fill: '#F2A900' },
  { x: -20, y: 6, w: 40, h: 6, fill: '#FFD25E' },
  { x: 12, y: 12, w: 8, h: 26, fill: '#C98A00' },
  // visor
  { x: -13, y: 18, w: 19, h: 7, fill: INK },
  { x: -10, y: 20, w: 4, h: 3, fill: '#FFFFFF' },
  // feet
  { x: -16, y: 38, w: 9, h: 8, fill: INK },
  { x: 7, y: 38, w: 9, h: 8, fill: INK },
];
