import { describe, expect, it } from 'vitest';
import { quantizeValue } from './useDragValue.js';

describe('quantizeValue', () => {
  it('clamps to min/max', () => {
    expect(quantizeValue(-5, 0, 10, 1)).toBe(0);
    expect(quantizeValue(50, 0, 10, 1)).toBe(10);
  });

  it('snaps to the nearest step', () => {
    expect(quantizeValue(4.6, 0, 10, 1)).toBe(5);
    expect(quantizeValue(4.4, 0, 10, 1)).toBe(4);
  });

  it('snaps fractional steps without float dust', () => {
    expect(quantizeValue(0.29, 0, 1, 0.1)).toBeCloseTo(0.3, 10);
    expect(quantizeValue(0.31, 0, 1, 0.1)).toBeCloseTo(0.3, 10);
    // The classic 0.1 + 0.2 float-dust trap: value should come back exact.
    expect(quantizeValue(0.30000000000000004, 0, 1, 0.01)).toBe(0.3);
  });

  it('stays continuous (clamp-only) when step is falsy', () => {
    expect(quantizeValue(0.123456, 0, 1, 0)).toBeCloseTo(0.123456, 10);
    expect(quantizeValue(0.123456, 0, 1, undefined)).toBeCloseTo(0.123456, 10);
  });

  it('treats a non-finite raw value as min', () => {
    expect(quantizeValue(NaN, 5, 10, 1)).toBe(5);
  });

  it('snaps to integer steps for a Fader-style stepped range', () => {
    expect(quantizeValue(3.6, 0, 7, 1)).toBe(4);
    expect(quantizeValue(-1, 0, 7, 1)).toBe(0);
    expect(quantizeValue(9, 0, 7, 1)).toBe(7);
  });
});
