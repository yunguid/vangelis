// Anti-aliased oscillator core: polyBLEP (step discontinuities) and polyBLAMP
// (slope discontinuities) residual corrections, plus waveform evaluation.

import { TWO_PI, WAVEFORMS, clamp } from './constants.js';

export function polyBlep(t, dt) {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1.0;
  }
  if (t > 1.0 - dt) {
    const x = (t - 1.0) / dt;
    return x * x + x + x + 1.0;
  }
  return 0.0;
}

// 4-point polyBLEP: cubic-B-spline step residual over a ±2-sample window.
// Derived as RES(x) = ∫B3 − u(x) and scaled ×2 to match polyBlep's convention
// (caller multiplies by half the step amplitude). ~15–20 dB lower worst-case
// aliasing than the 2-point residual at high fundamentals.
export function polyBlep4(t, dt) {
  if (t < dt) {
    const x = t / dt;
    return 2.0 * (-0.5 + x * (2.0 / 3.0) - (x * x * x) / 3.0 + (x * x * x * x) / 8.0);
  }
  if (t < 2.0 * dt) {
    const x = 2.0 - t / dt;
    return 2.0 * (-(x * x * x * x) / 24.0);
  }
  if (t > 1.0 - dt) {
    const x = (t - 1.0) / dt;
    return 2.0 * (0.5 + x * (2.0 / 3.0) - (x * x * x) / 3.0 - (x * x * x * x) / 8.0);
  }
  if (t > 1.0 - 2.0 * dt) {
    const x = 2.0 + (t - 1.0) / dt;
    return 2.0 * ((x * x * x * x) / 24.0);
  }
  return 0.0;
}

// The 4-point window spans 2dt each side of an edge; past dt 0.2 it would
// wrap onto itself within one cycle, so heavily FM-widened tones fall back
// to the 2-point residual.
const BLEP4_MAX_DT = 0.2;

// 2-point polyBLAMP residual for a slope discontinuity at phase 0.
// Integral of the polyBlep step residual; rounds corners instead of steps.
export function polyBlamp(t, dt) {
  if (t < dt) {
    const x = t / dt - 1.0;
    return -(x * x * x) / 3.0;
  }
  if (t > 1.0 - dt) {
    const x = (t - 1.0) / dt + 1.0;
    return (x * x * x) / 3.0;
  }
  return 0.0;
}

export function waveformSample(waveform, phase, dt) {
  switch (waveform) {
    case WAVEFORMS.SINE:
      return Math.sin(TWO_PI * phase);
    case WAVEFORMS.SAW: {
      let value = 2.0 * phase - 1.0;
      value -= dt <= BLEP4_MAX_DT ? polyBlep4(phase, dt) : polyBlep(phase, dt);
      return value;
    }
    case WAVEFORMS.SQUARE: {
      let value = phase < 0.5 ? 1.0 : -1.0;
      if (dt <= BLEP4_MAX_DT) {
        value += polyBlep4(phase, dt);
        value -= polyBlep4((phase + 0.5) % 1.0, dt);
      } else {
        value += polyBlep(phase, dt);
        value -= polyBlep((phase + 0.5) % 1.0, dt);
      }
      return value;
    }
    case WAVEFORMS.TRIANGLE: {
      let value = 2.0 * Math.abs(2.0 * phase - 1.0) - 1.0;
      // Slope changes by -8/cycle at the peak (phase 0) and +8/cycle at the
      // trough (phase 0.5); per-sample slope change is 8*dt.
      const blampScale = 8.0 * dt;
      value -= blampScale * polyBlamp(phase, dt);
      value += blampScale * polyBlamp((phase + 0.5) % 1.0, dt);
      return value;
    }
    default:
      return 0.0;
  }
}

export function normalizeWaveform(value) {
  if (typeof value === 'number') {
    return clamp(Math.floor(value), 0, 3);
  }
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase();
    if (key === 'sine') return WAVEFORMS.SINE;
    if (key === 'saw' || key === 'sawtooth') return WAVEFORMS.SAW;
    if (key === 'square') return WAVEFORMS.SQUARE;
    if (key === 'triangle') return WAVEFORMS.TRIANGLE;
  }
  return WAVEFORMS.SINE;
}
