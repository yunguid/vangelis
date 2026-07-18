import { clamp } from './math.js';

export const createLogSpectrumBinRanges = ({
  cells,
  sampleRate,
  fftSize,
  binCount,
  minFrequency = 20,
  maxFrequency = 18000
}) => {
  const ranges = new Uint16Array(cells * 2);
  const hzPerBin = sampleRate / fftSize;
  const frequencyRatio = maxFrequency / minFrequency;
  for (let i = 0; i < cells; i += 1) {
    const f0 = minFrequency * Math.pow(frequencyRatio, i / cells);
    const f1 = minFrequency * Math.pow(frequencyRatio, (i + 1) / cells);
    const lo = clamp(Math.floor(f0 / hzPerBin), 0, binCount - 1);
    const hi = clamp(Math.ceil(f1 / hzPerBin), lo + 1, binCount);
    ranges[i * 2] = lo;
    ranges[i * 2 + 1] = hi;
  }
  return ranges;
};

export const sampleLogSpectrum = ({
  freqData,
  minDb,
  maxDb,
  out,
  smoothed,
  binRanges
}) => {
  for (let i = 0; i < out.length; i += 1) {
    const lo = binRanges[i * 2];
    const hi = binRanges[i * 2 + 1];
    let peak = 0;
    for (let bin = lo; bin < hi; bin += 1) {
      if (freqData[bin] > peak) peak = freqData[bin];
    }
    const db = minDb + (peak / 255) * (maxDb - minDb);
    out[i] = db;
    const previous = smoothed[i];
    const smoothing = db > previous ? 0.55 : 0.14;
    smoothed[i] = previous + (db - previous) * smoothing;
  }
};
