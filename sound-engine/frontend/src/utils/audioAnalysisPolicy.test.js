import { describe, expect, it } from 'vitest';
import {
  MONO_ANALYSER_FFT_SIZE,
  SCOPE_SAMPLES_PER_CSS_PIXEL,
  STEREO_ANALYSER_FFT_SIZE,
  STEREO_VISUAL_SAMPLE_STRIDE,
  getScopeTraceStride,
  getStereoPairEvaluationsPerFrame,
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

  it('derives meter data from the goniometer traversal', () => {
    expect(STEREO_VISUAL_SAMPLE_STRIDE).toBe(2);
    expect(getStereoPairEvaluationsPerFrame()).toBe(512);
  });

  it('caps scope points at two samples per CSS pixel', () => {
    expect(SCOPE_SAMPLES_PER_CSS_PIXEL).toBe(2);
    expect(getScopeTraceStride(1024, 512)).toBe(1);
    expect(getScopeTraceStride(1024, 330)).toBe(2);
    expect(getScopeTraceStride(1024, 200)).toBe(3);
    expect(getScopeTraceStride(1, 0)).toBe(1);
  });
});
