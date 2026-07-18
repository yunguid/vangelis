export const MONO_ANALYSER_FFT_SIZE = 1024;
export const STEREO_ANALYSER_FFT_SIZE = 1024;

export const getWaveCandySamplesPerFrame = () => (
  (MONO_ANALYSER_FFT_SIZE / 2)
  + MONO_ANALYSER_FFT_SIZE
  + (STEREO_ANALYSER_FFT_SIZE * 2)
);
