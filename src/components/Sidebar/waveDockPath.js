// The sidebar dock's outline: a flat-topped bell bulging out of the left wall,
// drawn in a 120 x 440 box that renders at 120 x 440 CSS px (1 unit = 1px).
export const WAVE_HEIGHT = 440;
export const WAVE_REACH = 74;

const bell = (y) => 1 / (1 + Math.abs((y - 220) / 200 / 0.62) ** 6);
// The raw bell is still 3% of the reach at the box's top and bottom; shifting it
// by that much lands both tails on the wall instead of stopping 2px short of it.
const EDGE = bell(0);

// How far the rim stands off the wall at height y: the bell, a ripple so it reads
// as a wave rather than a lozenge, and a swell under the pointer when there is one.
export const waveX = (y, pointerY) => {
  const f = (bell(y) - EDGE) / (1 - EDGE);
  let x = (WAVE_REACH + 2.5 * Math.sin((3 * Math.PI * (y - 220)) / 200)) * f;
  if (pointerY != null) x += 8 * Math.exp(-(((y - pointerY) / 38) ** 2)) * f;
  return x;
};

// The rim as a 64-point polyline from the top of the wall to the bottom
// (implicit lineto after M); `scale` draws the engraved line inside it.
export const wavePath = (pointerY, scale = 1) => {
  let d = 'M';
  for (let i = 0; i < 64; i += 1) {
    const y = (i * WAVE_HEIGHT) / 63;
    d += `${(scale * waveX(y, pointerY)).toFixed(1)} ${+y.toFixed(1)} `;
  }
  return d.trim();
};
