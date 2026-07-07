// Multi-shape LFO with sample & hold. S&H draws from Math.random, which the
// offline audit harness replaces with a seeded PRNG for determinism.

import { TWO_PI, LFO_SHAPES } from './constants.js';

export class LFO {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.shape = LFO_SHAPES.SINE;
    this.rate = 0.0;
    this.phase = 0.0;
    this.holdValue = 0.0;
  }

  reset() {
    this.phase = 0.0;
    this.holdValue = Math.random() * 2.0 - 1.0;
  }

  next() {
    if (this.rate <= 0.0) return 0.0;
    const prevPhase = this.phase;
    let phase = prevPhase + this.rate / this.sampleRate;
    if (phase >= 1.0) {
      phase -= 1.0;
      if (this.shape === LFO_SHAPES.SAMPLE_HOLD) {
        this.holdValue = Math.random() * 2.0 - 1.0;
      }
    }
    this.phase = phase;

    switch (this.shape) {
      case LFO_SHAPES.SINE:
        return Math.sin(TWO_PI * phase);
      case LFO_SHAPES.TRIANGLE:
        return 1.0 - 4.0 * Math.abs(phase - 0.5);
      case LFO_SHAPES.SQUARE:
        return phase < 0.5 ? 1.0 : -1.0;
      case LFO_SHAPES.SAW_UP:
        return 2.0 * phase - 1.0;
      case LFO_SHAPES.SAW_DOWN:
        return 1.0 - 2.0 * phase;
      case LFO_SHAPES.SAMPLE_HOLD:
        return this.holdValue;
      default:
        return 0.0;
    }
  }
}
