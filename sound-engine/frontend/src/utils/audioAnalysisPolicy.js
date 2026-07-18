export const MONO_ANALYSER_FFT_SIZE = 1024;
export const STEREO_ANALYSER_FFT_SIZE = 1024;
export const STEREO_VISUAL_SAMPLE_STRIDE = 2;
export const SCOPE_SAMPLES_PER_CSS_PIXEL = 2;

export const getScopeTraceStride = (sampleCount, cssWidth) => {
  if (sampleCount <= 1) return 1;
  const maximumPointCount = Math.max(
    2,
    Math.floor(Math.max(1, cssWidth) * SCOPE_SAMPLES_PER_CSS_PIXEL)
  );
  return Math.max(1, Math.ceil((sampleCount - 1) / (maximumPointCount - 1)));
};

export const getWaveCandySamplesPerFrame = () => (
  (MONO_ANALYSER_FFT_SIZE / 2)
  + MONO_ANALYSER_FFT_SIZE
  + (STEREO_ANALYSER_FFT_SIZE * 2)
);

export const getStereoPairEvaluationsPerFrame = () => (
  Math.ceil(STEREO_ANALYSER_FFT_SIZE / STEREO_VISUAL_SAMPLE_STRIDE)
);
