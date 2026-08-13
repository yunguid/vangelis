export const SCENE_FREQUENCY_BANDS = Object.freeze([
  Object.freeze([30, 250]),
  Object.freeze([250, 2000]),
  Object.freeze([2000, 12000]),
  Object.freeze([30, 80]),
  Object.freeze([80, 160]),
  Object.freeze([160, 350]),
  Object.freeze([350, 700]),
  Object.freeze([700, 1400]),
  Object.freeze([1400, 3000]),
  Object.freeze([3000, 6500]),
  Object.freeze([6500, 13000])
]);

export const createSceneBandBinRanges = ({
  sampleRate,
  fftSize,
  binCount,
  frequencyBands = SCENE_FREQUENCY_BANDS
}) => {
  const ranges = new Uint16Array(frequencyBands.length * 2);
  if (sampleRate <= 0 || fftSize <= 0 || binCount <= 0) return ranges;

  const hzPerBin = sampleRate / fftSize;
  const lastBin = binCount - 1;
  for (let band = 0; band < frequencyBands.length; band += 1) {
    const [lowHz, highHz] = frequencyBands[band];
    ranges[band * 2] = Math.max(0, Math.min(lastBin, Math.floor(lowHz / hzPerBin)));
    ranges[band * 2 + 1] = Math.max(0, Math.min(lastBin, Math.ceil(highHz / hzPerBin)));
  }
  return ranges;
};

export const sampleSceneBandEnergies = (freqData, binRanges, out) => {
  const bandCount = Math.min(out.length, Math.floor(binRanges.length / 2));
  for (let band = 0; band < bandCount; band += 1) {
    const lo = binRanges[band * 2];
    const hi = binRanges[band * 2 + 1];
    if (hi <= lo) {
      out[band] = 0;
      continue;
    }

    let sum = 0;
    for (let bin = lo; bin <= hi; bin += 1) sum += freqData[bin];
    out[band] = sum / ((hi - lo + 1) * 255);
  }
  return out;
};
