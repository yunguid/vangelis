import { describe, expect, it } from 'vitest';
import {
  MONO_ANALYSER_FFT_SIZE,
  STEREO_ANALYSER_FFT_SIZE,
  getWaveCandySamplesPerFrame
} from './audioAnalysisPolicy.js';

describe('audioAnalysisPolicy', () => {
  it('keeps mono frequency and scope analysis at 1024 samples', () => {
    expect(MONO_ANALYSER_FFT_SIZE).toBe(1024);
  });

  it('uses a compact stereo window for the meter and goniometer', () => {
    expect(STEREO_ANALYSER_FFT_SIZE).toBe(1024);
    expect(getWaveCandySamplesPerFrame()).toBe(3584);
  });
});
