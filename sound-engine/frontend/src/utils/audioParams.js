import { clamp } from './math.js';

export const MICRO_FADE_TIME = 0.005;
export const DEFAULT_TRANSPORT_TEMPO = 120;

export const DELAY_MODE_OPTIONS = [
  { value: 'digital', label: 'Digital' },
  { value: 'tape', label: 'Tape' },
  { value: 'ping-pong', label: 'Ping-pong' }
];

export const DELAY_DIVISION_OPTIONS = [
  { value: '1/16', label: '1/16', beats: 0.25 },
  { value: '1/8T', label: '1/8T', beats: 1 / 3 },
  { value: '1/8', label: '1/8', beats: 0.5 },
  { value: '1/8.', label: '1/8.', beats: 0.75 },
  { value: '1/4T', label: '1/4T', beats: 2 / 3 },
  { value: '1/4', label: '1/4', beats: 1 },
  { value: '1/4.', label: '1/4.', beats: 1.5 },
  { value: '1/2', label: '1/2', beats: 2 },
  { value: '1/1', label: '1/1', beats: 4 }
];

export const DELAY_PRESET_OPTIONS = [
  { value: 'custom', label: 'Custom' },
  { value: 'clean-slap', label: 'Clean Slap' },
  { value: 'wide-quarter', label: 'Wide Quarter' },
  { value: 'tape-echo', label: 'Tape Echo' },
  { value: 'ping-pong', label: 'Ping-Pong' }
];

export const REVERB_MODE_OPTIONS = [
  { value: 'room', label: 'Room' },
  { value: 'plate', label: 'Plate' },
  { value: 'hall', label: 'Hall' },
  { value: 'ambient', label: 'Ambient' }
];

const DELAY_MODE_VALUES = new Set(DELAY_MODE_OPTIONS.map(({ value }) => value));
const REVERB_MODE_VALUES = new Set(REVERB_MODE_OPTIONS.map(({ value }) => value));
const DELAY_DIVISION_BEATS = Object.fromEntries(
  DELAY_DIVISION_OPTIONS.map(({ value, beats }) => [value, beats])
);
const DELAY_PRESET_VALUES = new Set(DELAY_PRESET_OPTIONS.map(({ value }) => value));

const LEGACY_EFFECT_SIGNATURE = Object.freeze({
  reverbEnabled: true,
  reverbMix: 0.24,
  delayEnabled: true,
  delayTime: 72,
  delayFeedback: 0.26,
  delayMix: 0.18
});

const LEGACY_CORE_TONE_SIGNATURE = Object.freeze({
  useFilter: true,
  filterCutoff: 13200,
  filterResonance: 0.82,
  unisonVoices: 2,
  unisonDetune: 7
});

const CLEAN_EFFECT_DEFAULTS = Object.freeze({
  reverb: 0,
  reverbEnabled: false,
  reverbMix: 0,
  delayEnabled: false,
  delayMix: 0
});

const CLEAN_CORE_TONE_DEFAULTS = Object.freeze({
  useFilter: false,
  filterCutoff: 18000,
  filterResonance: 0.7,
  filterMode: 0,
  unisonVoices: 1,
  unisonDetune: 0
});

const DELAY_PRESET_PATCHES = {
  'clean-slap': {
    delayMode: 'digital',
    delaySync: false,
    delayTime: 112,
    delayDivision: '1/8',
    delayFeedback: 0.18,
    delayMix: 0.16,
    delayStereo: 0.22,
    delayLowCut: 180,
    delayHighCut: 7600,
    delayDucking: 0.16,
    delayAge: 0.08,
    delayMotion: 0.14
  },
  'wide-quarter': {
    delayMode: 'digital',
    delaySync: true,
    delayTime: 420,
    delayDivision: '1/4',
    delayFeedback: 0.38,
    delayMix: 0.24,
    delayStereo: 0.72,
    delayLowCut: 140,
    delayHighCut: 6200,
    delayDucking: 0.24,
    delayAge: 0.18,
    delayMotion: 0.42
  },
  'tape-echo': {
    delayMode: 'tape',
    delaySync: true,
    delayTime: 440,
    delayDivision: '1/8.',
    delayFeedback: 0.52,
    delayMix: 0.28,
    delayStereo: 0.58,
    delayLowCut: 180,
    delayHighCut: 4200,
    delayDucking: 0.18,
    delayAge: 0.72,
    delayMotion: 0.66
  },
  'ping-pong': {
    delayMode: 'ping-pong',
    delaySync: true,
    delayTime: 280,
    delayDivision: '1/8',
    delayFeedback: 0.46,
    delayMix: 0.26,
    delayStereo: 1,
    delayLowCut: 220,
    delayHighCut: 6400,
    delayDucking: 0.22,
    delayAge: 0.2,
    delayMotion: 0.56
  }
};

const isSameDelayPresetValue = (actual, expected) => {
  if (typeof expected === 'number') {
    return Math.abs((actual ?? 0) - expected) < 1e-6;
  }
  return actual === expected;
};

export const AUDIO_PARAM_DEFAULTS = {
  reverb: 0,
  reverbEnabled: false,
  reverbMode: 'hall',
  reverbSize: 0.58,
  reverbDecay: 0.52,
  reverbTone: 0.56,
  reverbMix: 0,
  reverbPreDelay: 18,
  reverbWidth: 0.82,
  delayEnabled: false,
  delayMode: 'digital',
  delaySync: false,
  delayTime: 72,
  delayDivision: '1/8',
  delayFeedback: 0.26,
  delayMix: 0,
  delayStereo: 0.7,
  delayLowCut: 90,
  delayHighCut: 5400,
  delayDucking: 0.12,
  delayAge: 0.22,
  delayMotion: 0.3,
  distortion: 0,
  volume: 0.68,
  useADSR: true,
  attack: 0.012,
  decay: 0.18,
  sustain: 0.76,
  release: 0.42,
  useFM: false,
  fmRatio: 2,
  fmIndex: 2,
  pan: 0.5,
  phaseOffset: 0,
  useFilter: false,
  filterCutoff: 18000,
  filterResonance: 0.7,
  filterMode: 0,
  lfoRate: 0,
  lfoDepth: 0,
  lfoTarget: 0,
  unisonVoices: 1,
  unisonDetune: 0
};

export const AUDIO_PARAM_RANGES = {
  volume: { min: 0, max: 1, step: 0.01 },
  delayTime: { min: 20, max: 1600, step: 1 },
  delayFeedback: { min: 0, max: 0.92, step: 0.01 },
  delayMix: { min: 0, max: 1, step: 0.01 },
  delayStereo: { min: 0, max: 1, step: 0.01 },
  delayLowCut: { min: 20, max: 2000, step: 1 },
  delayHighCut: { min: 800, max: 14000, step: 1 },
  delayDucking: { min: 0, max: 1, step: 0.01 },
  delayAge: { min: 0, max: 1, step: 0.01 },
  delayMotion: { min: 0, max: 1, step: 0.01 },
  reverb: { min: 0, max: 1, step: 0.01 },
  reverbSize: { min: 0, max: 1, step: 0.01 },
  reverbDecay: { min: 0, max: 1, step: 0.01 },
  reverbTone: { min: 0, max: 1, step: 0.01 },
  reverbMix: { min: 0, max: 1, step: 0.01 },
  reverbPreDelay: { min: 0, max: 120, step: 1 },
  reverbWidth: { min: 0, max: 1, step: 0.01 },
  distortion: { min: 0, max: 1, step: 0.01 },
  pan: { min: 0, max: 1, step: 0.01 },
  attack: { min: MICRO_FADE_TIME, max: 5, step: 0.01 },
  decay: { min: 0, max: 5, step: 0.01 },
  sustain: { min: 0, max: 1, step: 0.01 },
  release: { min: MICRO_FADE_TIME, max: 5, step: 0.01 },
  fmRatio: { min: 0.5, max: 8, step: 0.1 },
  fmIndex: { min: 0, max: 30, step: 0.5 },
  phaseOffset: { min: 0, max: 360, step: 1 },
  filterCutoff: { min: 20, max: 20000, step: 1 },
  filterResonance: { min: 0.1, max: 10, step: 0.1 },
  filterMode: { min: 0, max: 3, step: 1 },
  lfoRate: { min: 0, max: 20, step: 0.1 },
  lfoDepth: { min: 0, max: 1, step: 0.01 },
  lfoTarget: { min: 0, max: 3, step: 1 },
  unisonVoices: { min: 1, max: 4, step: 1 },
  unisonDetune: { min: 0, max: 50, step: 1 }
};

const matchesProfileValue = (actual, expected) => {
  if (typeof expected === 'number') {
    return Math.abs((actual ?? 0) - expected) < 1e-6;
  }
  return actual === expected;
};

const matchesProfile = (params, profile) => Object.entries(profile).every(([key, expected]) => (
  matchesProfileValue(params?.[key], expected)
));

export const upgradeLegacyAudioParams = (params = {}) => {
  if (!params || typeof params !== 'object') return params;

  let next = { ...params };

  if (matchesProfile(next, LEGACY_CORE_TONE_SIGNATURE)) {
    next = {
      ...next,
      ...CLEAN_CORE_TONE_DEFAULTS
    };
  }

  if (matchesProfile(next, LEGACY_EFFECT_SIGNATURE)) {
    next = {
      ...next,
      ...CLEAN_EFFECT_DEFAULTS
    };
  }

  return next;
};

export const DEFAULT_WAVEFORM = 'Sine';
export const WAVEFORM_OPTIONS = ['Sine', 'Sawtooth', 'Square', 'Triangle'];

const coerceDelayMode = (value) => (
  typeof value === 'string' && DELAY_MODE_VALUES.has(value)
    ? value
    : AUDIO_PARAM_DEFAULTS.delayMode
);

const coerceReverbMode = (value) => (
  typeof value === 'string' && REVERB_MODE_VALUES.has(value)
    ? value
    : AUDIO_PARAM_DEFAULTS.reverbMode
);

const coerceDelayDivision = (value) => (
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(DELAY_DIVISION_BEATS, value)
    ? value
    : AUDIO_PARAM_DEFAULTS.delayDivision
);

export const getDelayDivisionBeats = (division) => DELAY_DIVISION_BEATS[coerceDelayDivision(division)];

export const getDelayPresetPatch = (preset) => {
  if (!DELAY_PRESET_VALUES.has(preset) || preset === 'custom') {
    return null;
  }
  return { ...DELAY_PRESET_PATCHES[preset] };
};

export const getDelayPresetValue = (params = {}) => {
  for (const option of DELAY_PRESET_OPTIONS) {
    if (option.value === 'custom') continue;
    const patch = DELAY_PRESET_PATCHES[option.value];
    const matches = Object.entries(patch).every(([key, expected]) => (
      isSameDelayPresetValue(params?.[key], expected)
    ));
    if (matches) {
      return option.value;
    }
  }
  return 'custom';
};

export const getDelaySeconds = (params = {}, transportBpm = DEFAULT_TRANSPORT_TEMPO) => {
  const delaySync = params?.delaySync === true;
  if (!delaySync) {
    const manualMs = Number.isFinite(params?.delayTime)
      ? params.delayTime
      : Number.isFinite(params?.delay)
        ? params.delay
        : AUDIO_PARAM_DEFAULTS.delayTime;
    return clamp(manualMs / 1000, 0.02, 4);
  }

  const bpm = clamp(
    Number.isFinite(transportBpm) ? transportBpm : DEFAULT_TRANSPORT_TEMPO,
    40,
    280
  );
  return clamp((60 / bpm) * getDelayDivisionBeats(params?.delayDivision), 0.02, 4);
};

export const sanitizeAudioParams = (params = {}) => {
  const merged = { ...AUDIO_PARAM_DEFAULTS, ...params };
  const ranges = AUDIO_PARAM_RANGES;
  const legacyReverbMix = clamp(
    Number.isFinite(merged.reverbMix)
      ? merged.reverbMix
      : (merged.reverb ?? AUDIO_PARAM_DEFAULTS.reverbMix),
    ranges.reverbMix.min,
    ranges.reverbMix.max
  );
  const legacyDelayTime = Number.isFinite(merged.delayTime)
    ? merged.delayTime
    : Number.isFinite(merged.delay)
      ? merged.delay
      : AUDIO_PARAM_DEFAULTS.delayTime;
  const delayLowCut = clamp(
    merged.delayLowCut ?? AUDIO_PARAM_DEFAULTS.delayLowCut,
    ranges.delayLowCut.min,
    ranges.delayLowCut.max
  );
  const delayHighCut = clamp(
    Math.max(
      merged.delayHighCut ?? AUDIO_PARAM_DEFAULTS.delayHighCut,
      delayLowCut + 400
    ),
    ranges.delayHighCut.min,
    ranges.delayHighCut.max
  );
  const reverbEnabled = typeof merged.reverbEnabled === 'boolean'
    ? merged.reverbEnabled
    : AUDIO_PARAM_DEFAULTS.reverbEnabled;
  const delayEnabled = typeof merged.delayEnabled === 'boolean'
    ? merged.delayEnabled
    : AUDIO_PARAM_DEFAULTS.delayEnabled;

  return {
    volume: clamp(merged.volume, ranges.volume.min, ranges.volume.max),
    reverb: legacyReverbMix,
    reverbEnabled,
    reverbMode: coerceReverbMode(merged.reverbMode),
    reverbSize: clamp(
      merged.reverbSize ?? AUDIO_PARAM_DEFAULTS.reverbSize,
      ranges.reverbSize.min,
      ranges.reverbSize.max
    ),
    reverbDecay: clamp(
      merged.reverbDecay ?? AUDIO_PARAM_DEFAULTS.reverbDecay,
      ranges.reverbDecay.min,
      ranges.reverbDecay.max
    ),
    reverbTone: clamp(
      merged.reverbTone ?? AUDIO_PARAM_DEFAULTS.reverbTone,
      ranges.reverbTone.min,
      ranges.reverbTone.max
    ),
    reverbMix: legacyReverbMix,
    reverbPreDelay: clamp(
      merged.reverbPreDelay ?? AUDIO_PARAM_DEFAULTS.reverbPreDelay,
      ranges.reverbPreDelay.min,
      ranges.reverbPreDelay.max
    ),
    reverbWidth: clamp(
      merged.reverbWidth ?? AUDIO_PARAM_DEFAULTS.reverbWidth,
      ranges.reverbWidth.min,
      ranges.reverbWidth.max
    ),
    delayEnabled,
    delayMode: coerceDelayMode(merged.delayMode),
    delaySync: !!merged.delaySync,
    delayTime: clamp(legacyDelayTime, ranges.delayTime.min, ranges.delayTime.max),
    delayDivision: coerceDelayDivision(merged.delayDivision),
    delayFeedback: clamp(
      merged.delayFeedback ?? AUDIO_PARAM_DEFAULTS.delayFeedback,
      ranges.delayFeedback.min,
      ranges.delayFeedback.max
    ),
    delayMix: clamp(
      merged.delayMix ?? AUDIO_PARAM_DEFAULTS.delayMix,
      ranges.delayMix.min,
      ranges.delayMix.max
    ),
    delayStereo: clamp(
      merged.delayStereo ?? AUDIO_PARAM_DEFAULTS.delayStereo,
      ranges.delayStereo.min,
      ranges.delayStereo.max
    ),
    delayLowCut,
    delayHighCut,
    delayDucking: clamp(
      merged.delayDucking ?? AUDIO_PARAM_DEFAULTS.delayDucking,
      ranges.delayDucking.min,
      ranges.delayDucking.max
    ),
    delayAge: clamp(
      merged.delayAge ?? AUDIO_PARAM_DEFAULTS.delayAge,
      ranges.delayAge.min,
      ranges.delayAge.max
    ),
    delayMotion: clamp(
      merged.delayMotion ?? AUDIO_PARAM_DEFAULTS.delayMotion,
      ranges.delayMotion.min,
      ranges.delayMotion.max
    ),
    distortion: clamp(merged.distortion, ranges.distortion.min, ranges.distortion.max),
    pan: clamp(merged.pan, ranges.pan.min, ranges.pan.max),
    attack: clamp(merged.attack, ranges.attack.min, ranges.attack.max),
    decay: clamp(merged.decay, ranges.decay.min, ranges.decay.max),
    sustain: clamp(merged.sustain, ranges.sustain.min, ranges.sustain.max),
    release: clamp(merged.release, ranges.release.min, ranges.release.max),
    useADSR: merged.useADSR !== false,
    useFM: !!merged.useFM,
    fmRatio: clamp(merged.fmRatio, ranges.fmRatio.min, ranges.fmRatio.max),
    fmIndex: clamp(merged.fmIndex, ranges.fmIndex.min, ranges.fmIndex.max),
    phaseOffset: clamp(merged.phaseOffset, ranges.phaseOffset.min, ranges.phaseOffset.max),
    useFilter: !!merged.useFilter,
    filterCutoff: clamp(merged.filterCutoff, ranges.filterCutoff.min, ranges.filterCutoff.max),
    filterResonance: clamp(merged.filterResonance, ranges.filterResonance.min, ranges.filterResonance.max),
    filterMode: clamp(Math.floor(merged.filterMode), ranges.filterMode.min, ranges.filterMode.max),
    lfoRate: clamp(merged.lfoRate, ranges.lfoRate.min, ranges.lfoRate.max),
    lfoDepth: clamp(merged.lfoDepth, ranges.lfoDepth.min, ranges.lfoDepth.max),
    lfoTarget: clamp(Math.floor(merged.lfoTarget), ranges.lfoTarget.min, ranges.lfoTarget.max),
    unisonVoices: clamp(Math.floor(merged.unisonVoices), ranges.unisonVoices.min, ranges.unisonVoices.max),
    unisonDetune: clamp(merged.unisonDetune, ranges.unisonDetune.min, ranges.unisonDetune.max)
  };
};

export const toWorkletParams = (params) => ({
  attack: params.attack,
  decay: params.decay,
  sustain: params.sustain,
  release: params.release,
  useADSR: params.useADSR,
  useFM: params.useFM,
  fmRatio: params.fmRatio,
  fmIndex: params.fmIndex,
  phaseOffsetDeg: params.phaseOffset,
  useFilter: params.useFilter,
  filterCutoff: params.filterCutoff,
  filterResonance: params.filterResonance,
  filterMode: params.filterMode,
  lfoRate: params.lfoRate,
  lfoDepth: params.lfoDepth,
  lfoTarget: params.lfoTarget,
  unisonVoices: params.unisonVoices,
  unisonDetune: params.unisonDetune
});

export const WORKLET_PARAM_DEFAULTS = toWorkletParams(AUDIO_PARAM_DEFAULTS);
