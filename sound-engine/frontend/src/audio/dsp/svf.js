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
    this.coefficientCutoff = NaN;
    this.coefficientResonance = NaN;
    this.coefficientK = 1.0;
    this.coefficientA1 = 1.0;
    this.coefficientA2 = 0.0;
    this.coefficientA3 = 0.0;
    // Smoothing coefficient (higher = slower smoothing), ~10ms at the
    // context sample rate
    this.smoothCoeff = Math.exp(-1.0 / (0.01 * sampleRate));
    this.recalculateCoefficients();
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
    this.recalculateCoefficients();
  }

  recalculateCoefficients() {
    const g = Math.tan(Math.PI * this.cutoff / this.sampleRate);
    const k = 1.0 / this.resonanceSmoothed;
    const a1 = 1.0 / (1.0 + g * (g + k));
    const a2 = g * a1;

    this.coefficientCutoff = this.cutoff;
    this.coefficientResonance = this.resonanceSmoothed;
    this.coefficientK = k;
    this.coefficientA1 = a1;
    this.coefficientA2 = a2;
    this.coefficientA3 = g * a2;
  }

  process(input, cutoffOverride) {
    // Apply one-pole smoothing to cutoff/resonance to prevent zipper noise
    const targetCutoff = typeof cutoffOverride === 'number' && Number.isFinite(cutoffOverride)
      ? clamp(cutoffOverride, 20, this.getMaxCutoff())
      : this.targetCutoff;

    this.cutoff = targetCutoff + (this.cutoff - targetCutoff) * this.smoothCoeff;
    this.resonanceSmoothed = this.resonance
      + (this.resonanceSmoothed - this.resonance) * this.smoothCoeff;

    if (
      this.cutoff !== this.coefficientCutoff
      || this.resonanceSmoothed !== this.coefficientResonance
    ) {
      this.recalculateCoefficients();
    }

    const k = this.coefficientK;
    const a1 = this.coefficientA1;
    const a2 = this.coefficientA2;
    const a3 = this.coefficientA3;

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

  // Stereo unison feeds the same cutoff, resonance, and mode to a matched
  // filter pair. Reuse the left filter's already-smoothed coefficients for
  // the right channel; only the integrator state is channel-specific.
  processStereoPartner(input, coefficientSource) {
    this.cutoff = coefficientSource.cutoff;
    this.resonanceSmoothed = coefficientSource.resonanceSmoothed;
    this.coefficientCutoff = coefficientSource.coefficientCutoff;
    this.coefficientResonance = coefficientSource.coefficientResonance;
    this.coefficientK = coefficientSource.coefficientK;
    this.coefficientA1 = coefficientSource.coefficientA1;
    this.coefficientA2 = coefficientSource.coefficientA2;
    this.coefficientA3 = coefficientSource.coefficientA3;

    const k = this.coefficientK;
    const a1 = this.coefficientA1;
    const a2 = this.coefficientA2;
    const a3 = this.coefficientA3;
    const v3 = input - this.ic2eq;
    const v1 = a1 * this.ic1eq + a2 * v3;
    const v2 = this.ic2eq + a2 * this.ic1eq + a3 * v3;
    this.ic1eq = 2.0 * v1 - this.ic1eq;
    this.ic2eq = 2.0 * v2 - this.ic2eq;

    let output;
    switch (this.mode) {
      case 1:
        output = input - k * v1 - v2;
        break;
      case 2:
        output = v1;
        break;
      case 3:
        output = input - k * v1;
        break;
      default:
        output = v2;
        break;
    }

    if (!Number.isFinite(output) || !Number.isFinite(this.ic1eq) || !Number.isFinite(this.ic2eq)) {
      this.reset();
      return 0.0;
    }

    return clamp(output, -VOICE_SAMPLE_LIMIT, VOICE_SAMPLE_LIMIT);
  }
}
