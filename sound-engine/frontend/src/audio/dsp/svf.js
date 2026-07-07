// Topology-preserving-transform (Simper/Cytomic) state-variable filter.
// Unlike the Chamberlin SVF this discretization is unconditionally stable for
// any cutoff below Nyquist and any damping >= 0, so modulation can slam the
// cutoff against its ceiling without the state exploding into crackle.

import { FILTER_MAX_CUTOFF_RATIO, VOICE_SAMPLE_LIMIT, clamp } from './constants.js';

export class StateVariableFilter {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.cutoff = 18000;
    this.targetCutoff = 18000;
    this.resonance = 0.7;
    this.resonanceSmoothed = 0.7;
    this.ic1eq = 0.0;
    this.ic2eq = 0.0;
    this.mode = 0; // 0=lowpass
    // Smoothing coefficient (higher = slower smoothing)
    // ~10ms smoothing at 44100 Hz
    this.smoothCoeff = Math.exp(-1.0 / (0.01 * sampleRate));
  }

  getMaxCutoff() {
    return this.sampleRate * FILTER_MAX_CUTOFF_RATIO;
  }

  setParams({ cutoff, resonance, mode }) {
    if (typeof cutoff === 'number' && Number.isFinite(cutoff)) {
      this.targetCutoff = clamp(cutoff, 20, this.getMaxCutoff());
    }
    if (typeof resonance === 'number' && Number.isFinite(resonance)) {
      this.resonance = clamp(resonance, 0.1, 10.0);
    }
    if (typeof mode === 'number' && Number.isFinite(mode)) {
      this.mode = Math.floor(clamp(mode, 0, 3));
    }
  }

  reset() {
    this.ic1eq = 0.0;
    this.ic2eq = 0.0;
    this.cutoff = this.targetCutoff;
    this.resonanceSmoothed = this.resonance;
  }

  process(input, cutoffOverride) {
    // Apply one-pole smoothing to cutoff/resonance to prevent zipper noise
    const targetCutoff = typeof cutoffOverride === 'number' && Number.isFinite(cutoffOverride)
      ? clamp(cutoffOverride, 20, this.getMaxCutoff())
      : this.targetCutoff;

    this.cutoff = targetCutoff + (this.cutoff - targetCutoff) * this.smoothCoeff;
    this.resonanceSmoothed = this.resonance
      + (this.resonanceSmoothed - this.resonance) * this.smoothCoeff;

    const g = Math.tan(Math.PI * this.cutoff / this.sampleRate);
    const k = 1.0 / this.resonanceSmoothed;
    const a1 = 1.0 / (1.0 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;

    const v3 = input - this.ic2eq;
    const v1 = a1 * this.ic1eq + a2 * v3;
    const v2 = this.ic2eq + a2 * this.ic1eq + a3 * v3;
    this.ic1eq = 2.0 * v1 - this.ic1eq;
    this.ic2eq = 2.0 * v2 - this.ic2eq;

    let output;
    switch (this.mode) {
      case 1:
        output = input - k * v1 - v2; // high-pass
        break;
      case 2:
        output = v1; // band-pass
        break;
      case 3:
        output = input - k * v1; // notch
        break;
      default:
        output = v2; // low-pass
        break;
    }

    if (!Number.isFinite(output) || !Number.isFinite(this.ic1eq) || !Number.isFinite(this.ic2eq)) {
      this.reset();
      return 0.0;
    }

    return clamp(output, -VOICE_SAMPLE_LIMIT, VOICE_SAMPLE_LIMIT);
  }
}
