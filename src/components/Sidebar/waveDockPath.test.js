import { describe, expect, it } from 'vitest';
import { WAVE_HEIGHT, WAVE_REACH, waveX, wavePath } from './waveDockPath.js';

const points = (d) => {
  const numbers = d.slice(1).trim().split(/\s+/).map(Number);
  return Array.from({ length: numbers.length / 2 }, (_, i) => [numbers[2 * i], numbers[2 * i + 1]]);
};

describe('waveDockPath', () => {
  it('draws a 64-point rim from the top of the wall to the bottom', () => {
    const rim = points(wavePath());
    expect(rim).toHaveLength(64);
    expect(rim[0]).toEqual([0, 0]);
    expect(rim[63]).toEqual([0, WAVE_HEIGHT]);
    rim.slice(1).forEach(([, y], i) => expect(y).toBeGreaterThan(rim[i][1]));
  });

  it('lands on the wall at both ends and reaches its full width in the middle', () => {
    expect(waveX(0)).toBeCloseTo(0, 10);
    expect(waveX(WAVE_HEIGHT)).toBeCloseTo(0, 10);
    // It leaves the wall at a shallow angle: 2px in, it is under a pixel out.
    expect(waveX(2)).toBeLessThan(1);
    expect(waveX(WAVE_HEIGHT - 2)).toBeLessThan(1);
    expect(waveX(WAVE_HEIGHT / 2)).toBeCloseTo(WAVE_REACH, 10);
  });

  it('centres the bell: mirror heights differ only by the ripple', () => {
    // The ripple is odd about the middle, so mirror points coincide at its nodes
    // (every third of the 200px half-span)...
    [200 / 3, 400 / 3, 200].forEach((offset) => {
      expect(waveX(220 + offset)).toBeCloseTo(waveX(220 - offset), 10);
    });
    // ...and their average, the bell itself, falls away from the middle.
    const bell = (offset) => (waveX(220 + offset) + waveX(220 - offset)) / 2;
    for (let offset = 5; offset <= 220; offset += 5) {
      expect(bell(offset)).toBeLessThanOrEqual(bell(offset - 5));
    }
  });

  it('swells under the pointer and nowhere far from it', () => {
    expect(waveX(250, 250) - waveX(250)).toBeGreaterThan(7.9);
    expect(waveX(100, 250) - waveX(100)).toBeLessThan(0.01);
    expect(wavePath(250)).not.toBe(wavePath());
    expect(wavePath(undefined)).toBe(wavePath(null));
  });

  it('never swells past 85px, so the rim clears the panel at the 86px dock reach', () => {
    let reach = 0;
    for (let pointerY = 0; pointerY <= WAVE_HEIGHT; pointerY += 2) {
      points(wavePath(pointerY)).forEach(([x]) => { reach = Math.max(reach, x); });
    }
    expect(reach).toBeLessThan(85);
  });

  it('draws the engraved line inside the rim', () => {
    const rim = points(wavePath());
    points(wavePath(null, 0.86)).forEach(([x, y], i) => {
      expect(y).toBe(rim[i][1]);
      expect(x).toBeLessThanOrEqual(rim[i][0]);
    });
  });
});
