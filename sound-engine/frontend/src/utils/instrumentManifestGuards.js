import { noteIdToMidi } from './instrumentSelection.js';

const SAFE_SAMPLE_PATH = /^starter-pack\/[A-Za-z0-9/_#.\-]+?\.(wav|flac|aif|aiff|ogg|mp3)$/i;

export const isSafeSamplePath = (samplePath) => (
  typeof samplePath === 'string'
  && SAFE_SAMPLE_PATH.test(samplePath)
  && !samplePath.includes('..')
  && !samplePath.includes('\\')
);

const isValidMidiBoundary = (value) => (
  value == null || (Number.isInteger(value) && value >= 0 && value <= 127)
);

export const isValidInstrumentRange = (instrument = {}) => {
  const { minMidi, maxMidi } = instrument;
  if (!isValidMidiBoundary(minMidi) || !isValidMidiBoundary(maxMidi)) {
    return false;
  }

  if (minMidi != null && maxMidi != null && minMidi > maxMidi) {
    return false;
  }

  return true;
};

export const hasUsableBasePitch = (instrument = {}) => (
  Number.isFinite(instrument.baseMidi) || Number.isFinite(noteIdToMidi(instrument.baseNote))
);

export const isUsableInstrumentDefinition = (instrument = {}) => (
  isSafeSamplePath(instrument.samplePath)
  && isValidInstrumentRange(instrument)
  && hasUsableBasePitch(instrument)
);
