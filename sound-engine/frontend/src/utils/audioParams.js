import { clamp } from './math.js';

export const MICRO_FADE_TIME = 0.005;

export const AUDIO_PARAM_DEFAULTS = {
  reverb: 0.3,
  delay: 0,
  distortion: 0,
  volume: 0.7,
  useADSR: true,
  attack: 0.01,
  decay: 0.1,
  sustain: 0.8,
  release: 0.3,
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
  delay: { min: 0, max: 500, step: 10 },
  reverb: { min: 0, max: 1, step: 0.01 },
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

export const DEFAULT_WAVEFORM = 'Triangle';
export const WAVEFORM_OPTIONS = ['Sine', 'Sawtooth', 'Square', 'Triangle'];

export const sanitizeAudioParams = (params = {}) => {
  const merged = { ...AUDIO_PARAM_DEFAULTS, ...params };
  const ranges = AUDIO_PARAM_RANGES;

  return {
    volume: clamp(merged.volume, ranges.volume.min, ranges.volume.max),
    delay: clamp(merged.delay, ranges.delay.min, ranges.delay.max),
    reverb: clamp(merged.reverb, ranges.reverb.min, ranges.reverb.max),
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
