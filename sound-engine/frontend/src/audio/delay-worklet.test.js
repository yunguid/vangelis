import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Feedback-loop stability: at maximum legal settings (feedback 0.96 +
 * crossfeed 0.96 + drive 0.4) the loop must stay contractive — echoes decay
 * instead of settling into a self-oscillating drone (the pre-descent(12)
 * behavior recorded in golden/fx/delay-stress.json: tailRms 0.87 forever).
 */

const SR = 48000;
const BLOCK = 128;

let DelayProcessor = null;

beforeAll(async () => {
  globalThis.sampleRate = SR;
  globalThis.AudioWorkletProcessor = class {
    constructor() {
      this.port = { onmessage: null, postMessage() {} };
    }
  };
  globalThis.registerProcessor = (_name, cls) => {
    DelayProcessor = cls;
  };
  await import('./delay-worklet.js');
});

const MAX_PARAMS = {
  enabled: true,
  inputLeft: 1,
  inputRight: 1,
  timeLeft: 0.2,
  timeRight: 0.26,
  feedback: 0.96,
  crossfeed: 0.96,
  lowCut: 90,
  highCut: 5400,
  drive: 0.4,
  modRate: 0.5,
  modDepth: 0.0005,
  flutterRate: 4,
  flutterDepth: 0.0001,
  width: 0.7,
  ducking: 0,
  duckRelease: 0.18
};

function windowRms(proc, seconds, feed) {
  const inL = new Float32Array(BLOCK);
  const inR = new Float32Array(BLOCK);
  const outL = new Float32Array(BLOCK);
  const outR = new Float32Array(BLOCK);
  const inputs = [[inL, inR]];
  const outputs = [[outL, outR]];
  const blocks = Math.ceil((seconds * SR) / BLOCK);
  let sumsq = 0;
  let n = 0;
  let finite = true;
  for (let b = 0; b < blocks; b++) {
    for (let i = 0; i < BLOCK; i++) {
      const s = feed ? feed(b * BLOCK + i) : 0;
      inL[i] = s;
      inR[i] = s;
    }
    proc.process(inputs, outputs);
    for (let i = 0; i < BLOCK; i++) {
      if (!Number.isFinite(outL[i])) finite = false;
      sumsq += outL[i] * outL[i];
      n++;
    }
  }
  return { rms: Math.sqrt(sumsq / n), finite };
}

describe('delay feedback loop stability', () => {
  it('decays instead of self-oscillating at max feedback+crossfeed+drive', () => {
    const proc = new DelayProcessor({ processorOptions: { paramDefaults: MAX_PARAMS } });
    proc.port.onmessage({ data: { type: 'setParams', params: MAX_PARAMS } });

    // 0.3s burst, then watch the tail in 2s windows
    const burst = windowRms(proc, 0.3, (n) => 0.5 * Math.sin((2 * Math.PI * 220 * n) / SR));
    expect(burst.finite).toBe(true);

    const early = windowRms(proc, 2.0, null);
    const late = windowRms(proc, 2.0, null);
    const later = windowRms(proc, 2.0, null);

    expect(early.finite && late.finite && later.finite).toBe(true);
    expect(early.rms).toBeGreaterThan(0.001); // echoes exist
    expect(late.rms).toBeLessThan(early.rms); // strictly decaying...
    expect(later.rms).toBeLessThan(late.rms);
    // ...and materially so across 4s (contractive loop, not a limit cycle)
    expect(later.rms).toBeLessThan(early.rms * 0.8);
  });

  it('moderate settings still produce audible repeats', () => {
    const params = { ...MAX_PARAMS, feedback: 0.45, crossfeed: 0, drive: 0.05 };
    const proc = new DelayProcessor({ processorOptions: { paramDefaults: params } });
    proc.port.onmessage({ data: { type: 'setParams', params } });
    windowRms(proc, 0.3, (n) => 0.5 * Math.sin((2 * Math.PI * 220 * n) / SR));
    const echoes = windowRms(proc, 1.0, null);
    expect(echoes.rms).toBeGreaterThan(0.01);
  });
});
