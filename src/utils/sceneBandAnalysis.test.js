import { describe, expect, it } from 'vitest';
import {
  SCENE_FREQUENCY_BANDS,
  createSceneBandBinRanges,
  sampleSceneBandEnergies
} from './sceneBandAnalysis.js';

describe('sceneBandAnalysis', () => {
  it('builds the same inclusive bin boundaries as the former frame-local calculation', () => {
    const ranges = createSceneBandBinRanges({
      sampleRate: 48000,
      fftSize: 1024,
      binCount: 512
    });

    expect([...ranges]).toEqual([
      0, 6,
      5, 43,
      42, 256,
      0, 2,
      1, 4,
      3, 8,
      7, 15,
      14, 30,
      29, 64,
      64, 139,
      138, 278
    ]);
  });

  it('matches the former normalized average for every scene band', () => {
    const freqData = Uint8Array.from({ length: 512 }, (_, index) => (index * 37) % 256);
    const ranges = createSceneBandBinRanges({
      sampleRate: 48000,
      fftSize: 1024,
      binCount: freqData.length
    });
    const out = new Float64Array(SCENE_FREQUENCY_BANDS.length);

    sampleSceneBandEnergies(freqData, ranges, out);

    const hzPerBin = 48000 / 1024;
    SCENE_FREQUENCY_BANDS.forEach(([lowHz, highHz], band) => {
      const lo = Math.max(0, Math.floor(lowHz / hzPerBin));
      const hi = Math.min(freqData.length - 1, Math.ceil(highHz / hzPerBin));
      let sum = 0;
      for (let bin = lo; bin <= hi; bin += 1) sum += freqData[bin];
      expect(out[band]).toBe(sum / ((hi - lo + 1) * 255));
    });
  });

  it('returns zero for collapsed ranges and empty analyser configurations', () => {
    const out = new Float32Array(2).fill(1);
    sampleSceneBandEnergies(
      new Uint8Array([255]),
      new Uint16Array([0, 0, 0, 0]),
      out
    );

    expect([...out]).toEqual([0, 0]);
    expect([...createSceneBandBinRanges({
      sampleRate: 48000,
      fftSize: 1024,
      binCount: 0
    })]).toEqual(new Array(SCENE_FREQUENCY_BANDS.length * 2).fill(0));
  });
});
