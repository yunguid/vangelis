// One-pole DC blocker: y[n] = x[n] - x[n-1] + R*y[n-1].
// Integer-ratio phase modulation (e.g. fmRatio 1) puts a Bessel-weighted
// component at exactly 0 Hz; summed across chord voices that becomes a real
// offset that shifts the clip knee's operating point. A ~5 Hz corner removes
// it while costing < 0.03 dB at the lowest playable fundamentals.

import { TWO_PI } from './constants.js';

export class DCBlocker {
  constructor(sampleRate, cornerHz = 5) {
    this.R = 1 - (TWO_PI * cornerHz) / sampleRate;
    this.prevX = 0.0;
    this.prevY = 0.0;
  }

  reset() {
    this.prevX = 0.0;
    this.prevY = 0.0;
  }

  process(x) {
    const y = x - this.prevX + this.R * this.prevY;
    this.prevX = x;
    this.prevY = y;
    return y;
  }
}
