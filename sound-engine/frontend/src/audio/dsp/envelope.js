// Exponential-approach ADSR envelope (per-stage one-pole coefficients).
//
// Time semantics — deliberate, and NOT the same as the knob label:
// each stage approaches its target as an RC curve with τ = knobTime / 4
// (timeConstant below). Stage completion therefore lags the knob:
//   - attack ends at 0.999 of target  → ln(1000)·τ ≈ 1.73 × knobTime
//   - release ends at MIN_GAIN (1e-4) → ln(S/1e-4)·τ ≈ 2.2 × knobTime
//     from a sustain level S ≈ 0.76
// Calibrating the knob to literal seconds was considered and rejected in
// descent(16): every factory preset was voiced against these curves, so a
// "fix" would re-time the whole bank for a labeling nicety. The RC shape is
// also why note onsets are click-free without extra ramping.
//
// Steal/retrigger: a stolen voice fades ~5 ms (Voice.stealFadeGain), then the
// envelope restarts from 0.001 — it does not resume from the previous level.
// The fade masks the restart; see Voice.queueStart.

import { ENV_STAGE, MIN_GAIN, clamp } from './constants.js';

export class Envelope {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.stage = ENV_STAGE.IDLE;
    this.value = 0.0;
    this.target = 0.0;
    this.sustain = 1.0;
    // Exponential coefficients (pre-calculated for performance)
    this.attackCoeff = 0.0;
    this.decayCoeff = 0.0;
    this.releaseCoeff = 0.0;
    // Time constant multiplier (higher = faster approach)
    this.timeConstant = 4.0;
  }

  setADSR(attack, decay, sustain, release) {
    this.sustain = clamp(sustain, 0, 1);

    // Calculate exponential coefficients
    // coeff = exp(-1 / (time * sampleRate * timeConstant))
    // Smaller coeff = faster approach to target
    const attackTime = Math.max(0.001, attack);
    const decayTime = Math.max(0.001, decay);
    const releaseTime = Math.max(0.001, release);

    this.attackCoeff = Math.exp(-1.0 / (attackTime * this.sampleRate / this.timeConstant));
    this.decayCoeff = Math.exp(-1.0 / (decayTime * this.sampleRate / this.timeConstant));
    this.releaseCoeff = Math.exp(-1.0 / (releaseTime * this.sampleRate / this.timeConstant));
  }

  noteOn() {
    this.stage = ENV_STAGE.ATTACK;
    this.target = 1.0;
    // Start from small positive value for smooth attack
    if (this.value < 0.001) {
      this.value = 0.001;
    }
  }

  setImmediate() {
    this.stage = ENV_STAGE.SUSTAIN;
    this.value = 1.0;
    this.target = 1.0;
  }

  noteOff() {
    if (this.stage === ENV_STAGE.IDLE || this.stage === ENV_STAGE.RELEASE) {
      return;
    }
    this.stage = ENV_STAGE.RELEASE;
    this.target = 0.0;
  }

  next(useAdsr) {
    if (!useAdsr && this.stage !== ENV_STAGE.RELEASE) {
      return 1.0;
    }

    switch (this.stage) {
      case ENV_STAGE.ATTACK:
        // Exponential approach to 1.0
        this.value = this.target + (this.value - this.target) * this.attackCoeff;
        if (this.value >= 0.999) {
          this.value = 1.0;
          this.stage = ENV_STAGE.DECAY;
          this.target = this.sustain;
        }
        break;
      case ENV_STAGE.DECAY:
        // Exponential approach to sustain level
        this.value = this.target + (this.value - this.target) * this.decayCoeff;
        if (Math.abs(this.value - this.sustain) < 0.001) {
          this.value = this.sustain;
          this.stage = ENV_STAGE.SUSTAIN;
        }
        break;
      case ENV_STAGE.SUSTAIN:
        this.value = this.sustain;
        break;
      case ENV_STAGE.RELEASE:
        // Exponential approach to 0
        this.value = this.value * this.releaseCoeff;
        if (this.value <= MIN_GAIN) {
          this.value = 0.0;
          this.stage = ENV_STAGE.IDLE;
        }
        break;
      default:
        this.value = 0.0;
        break;
    }

    return this.value;
  }

  isIdle() {
    return this.stage === ENV_STAGE.IDLE;
  }
}
