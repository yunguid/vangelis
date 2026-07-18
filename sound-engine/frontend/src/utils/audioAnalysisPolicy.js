export const MONO_ANALYSER_FFT_SIZE = 1024;
export const STEREO_ANALYSER_FFT_SIZE = 1024;
export const STEREO_VISUAL_SAMPLE_STRIDE = 2;

export const getWaveCandySamplesPerFrame = () => (
  (MONO_ANALYSER_FFT_SIZE / 2)
  + MONO_ANALYSER_FFT_SIZE
  + (STEREO_ANALYSER_FFT_SIZE * 2)
);

export const getStereoPairEvaluationsPerFrame = () => (
  Math.ceil(STEREO_ANALYSER_FFT_SIZE / STEREO_VISUAL_SAMPLE_STRIDE)
);
