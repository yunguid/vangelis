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
      value -= polyBlep(phase, dt);
      return value;
    }
    case WAVEFORMS.SQUARE: {
      let value = phase < 0.5 ? 1.0 : -1.0;
      value += polyBlep(phase, dt);
      value -= polyBlep((phase + 0.5) % 1.0, dt);
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
