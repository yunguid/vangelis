import { describe, expect, it } from 'vitest';
import {
  createLogSpectrumBinRanges,
  sampleLogSpectrum
} from './spectrumAnalysis.js';

describe('spectrumAnalysis', () => {
  it('builds ordered, clamped bin ranges for each display cell', () => {
    const ranges = createLogSpectrumBinRanges({
      cells: 96,
      sampleRate: 48000,
      fftSize: 1024,
      binCount: 512
    });

    expect(ranges).toHaveLength(192);
    for (let i = 0; i < 96; i += 1) {
      const lo = ranges[i * 2];
      const hi = ranges[i * 2 + 1];
      expect(lo).toBeLessThan(hi);
      expect(hi).toBeLessThanOrEqual(512);
      if (i > 0) expect(lo).toBeGreaterThanOrEqual(ranges[(i - 1) * 2]);
    }
  });

  it('samples peak bins with the existing attack and release ballistics', () => {
    const freqData = new Uint8Array([0, 64, 128, 255]);
    const out = new Float32Array(2);
    const smoothed = new Float32Array([-70, 0]);
    const binRanges = new Uint16Array([0, 2, 2, 4]);

    sampleLogSpectrum({
      freqData,
      minDb: -100,
      maxDb: 0,
      out,
      smoothed,
      binRanges
    });

    expect(out[0]).toBeCloseTo(-74.90196, 4);
    expect(out[1]).toBeCloseTo(0, 5);
    expect(smoothed[0]).toBeCloseTo(-70.68627, 4);
    expect(smoothed[1]).toBeCloseTo(0, 5);
  });
});
