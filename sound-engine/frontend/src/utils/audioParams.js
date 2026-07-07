import { clamp } from './math.js';
import {
  DEFAULT_PARAMS as ENGINE_DEFAULTS,
  LFO_SHAPES,
  MAX_MOD_ROUTES,
  MOD_DST,
  MOD_SRC
} from '../audio/dsp/constants.js';

// Re-exported so UI code keeps importing engine constants from the param layer.
export { MAX_MOD_ROUTES };

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
  pan: 0.5,
  // Synth-engine defaults come from the engine itself (dsp/constants.js) —
  // one source of truth; only the phaseOffsetDeg -> phaseOffset name differs.
  useADSR: ENGINE_DEFAULTS.useADSR,
  attack: ENGINE_DEFAULTS.attack,
  decay: ENGINE_DEFAULTS.decay,
  sustain: ENGINE_DEFAULTS.sustain,
  release: ENGINE_DEFAULTS.release,
  useFM: ENGINE_DEFAULTS.useFM,
  fmRatio: ENGINE_DEFAULTS.fmRatio,
  fmIndex: ENGINE_DEFAULTS.fmIndex,
  phaseOffset: ENGINE_DEFAULTS.phaseOffsetDeg,
  useFilter: ENGINE_DEFAULTS.useFilter,
  filterCutoff: ENGINE_DEFAULTS.filterCutoff,
  filterResonance: ENGINE_DEFAULTS.filterResonance,
  filterMode: ENGINE_DEFAULTS.filterMode,
  lfoRate: ENGINE_DEFAULTS.lfoRate,
  lfoDepth: ENGINE_DEFAULTS.lfoDepth,
  lfoTarget: ENGINE_DEFAULTS.lfoTarget,
  unisonVoices: ENGINE_DEFAULTS.unisonVoices,
  unisonDetune: ENGINE_DEFAULTS.unisonDetune,
  // Modulation matrix
  lfo1Shape: ENGINE_DEFAULTS.lfo1Shape,
  lfo2Shape: ENGINE_DEFAULTS.lfo2Shape,
  lfo2Rate: ENGINE_DEFAULTS.lfo2Rate,
  modAttack: ENGINE_DEFAULTS.modAttack,
  modDecay: ENGINE_DEFAULTS.modDecay,
  modSustain: ENGINE_DEFAULTS.modSustain,
  modRelease: ENGINE_DEFAULTS.modRelease,
  modRoutes: [], // fresh array — never share the engine default's reference
  // Playability
  glideTime: ENGINE_DEFAULTS.glideTime,
  glideMode: ENGINE_DEFAULTS.glideMode,
  velocityCurve: ENGINE_DEFAULTS.velocityCurve
};

export const MOD_SOURCE_OPTIONS = [
  { value: MOD_SRC.LFO1, label: 'LFO 1' },
  { value: MOD_SRC.LFO2, label: 'LFO 2' },
  { value: MOD_SRC.AMP_ENV, label: 'Amp Env' },
  { value: MOD_SRC.MOD_ENV, label: 'Mod Env' },
  { value: MOD_SRC.VELOCITY, label: 'Velocity' },
  { value: MOD_SRC.KEY_TRACK, label: 'Key Track' },
  { value: MOD_SRC.MOD_WHEEL, label: 'Mod Wheel' }
];

export const MOD_DEST_OPTIONS = [
  { value: MOD_DST.PITCH, label: 'Pitch', unit: '±12 st' },
  { value: MOD_DST.CUTOFF, label: 'Filter Cutoff', unit: '±4 oct' },
  { value: MOD_DST.AMP, label: 'Amplitude', unit: '±100%' },
  { value: MOD_DST.FM_INDEX, label: 'FM Index', unit: '±10 rad' },
  { value: MOD_DST.DETUNE, label: 'Unison Detune', unit: '±50 ¢' }
];

export const LFO_SHAPE_OPTIONS = [
  { value: LFO_SHAPES.SINE, label: 'Sine' },
  { value: LFO_SHAPES.TRIANGLE, label: 'Triangle' },
  { value: LFO_SHAPES.SQUARE, label: 'Square' },
  { value: LFO_SHAPES.SAW_UP, label: 'Saw Up' },
  { value: LFO_SHAPES.SAW_DOWN, label: 'Saw Down' },
  { value: LFO_SHAPES.SAMPLE_HOLD, label: 'S&H' }
];

export const sanitizeModRoutes = (routes) => {
  if (!Array.isArray(routes)) return [];
  const result = [];
  for (const route of routes) {
    if (result.length >= MAX_MOD_ROUTES) break;
    if (!route || typeof route !== 'object') continue;
    const src = Math.floor(route.src ?? -1);
    const dst = Math.floor(route.dst ?? -1);
    const depth = Number(route.depth);
    if (src < 0 || src > MOD_SRC.MOD_WHEEL || dst < 0 || dst > MOD_DST.DETUNE) continue;
    if (!Number.isFinite(depth)) continue;
    result.push({ src, dst, depth: clamp(depth, -1, 1) });
  }
  return result;
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
  unisonDetune: { min: 0, max: 50, step: 1 },
  lfo1Shape: { min: 0, max: 5, step: 1 },
  lfo2Shape: { min: 0, max: 5, step: 1 },
  lfo2Rate: { min: 0, max: 20, step: 0.1 },
  modAttack: { min: MICRO_FADE_TIME, max: 5, step: 0.01 },
  modDecay: { min: 0, max: 5, step: 0.01 },
  modSustain: { min: 0, max: 1, step: 0.01 },
  modRelease: { min: MICRO_FADE_TIME, max: 5, step: 0.01 },
  glideTime: { min: 0, max: 2, step: 0.01 },
  glideMode: { min: 0, max: 1, step: 1 },
  velocityCurve: { min: -1, max: 1, step: 0.05 }
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

// Params that are integer-valued in the engine (floored before clamping).
const INTEGER_PARAMS = new Set(['filterMode', 'lfoTarget', 'unisonVoices', 'lfo1Shape', 'lfo2Shape', 'glideMode']);

export const sanitizeAudioParams = (params = {}) => {
  const merged = { ...AUDIO_PARAM_DEFAULTS, ...params };

  // Legacy field fallbacks feed the table pass below.
  if (!Number.isFinite(merged.reverbMix)) {
    merged.reverbMix = merged.reverb ?? AUDIO_PARAM_DEFAULTS.reverbMix;
  }
  if (!Number.isFinite(merged.delayTime)) {
    merged.delayTime = Number.isFinite(merged.delay)
      ? merged.delay
      : AUDIO_PARAM_DEFAULTS.delayTime;
  }

  // Table pass: every ranged numeric param gets default-fill, optional floor,
  // and clamp — AUDIO_PARAM_RANGES is the single authority on legal values.
  const out = {};
  for (const [key, { min, max }] of Object.entries(AUDIO_PARAM_RANGES)) {
    const raw = merged[key] ?? AUDIO_PARAM_DEFAULTS[key];
    out[key] = clamp(INTEGER_PARAMS.has(key) ? Math.floor(raw) : raw, min, max);
  }

  // Couplings, aliases, and non-numeric fields — everything a range can't say.
  out.delayHighCut = clamp(
    Math.max(merged.delayHighCut ?? AUDIO_PARAM_DEFAULTS.delayHighCut, out.delayLowCut + 400),
    AUDIO_PARAM_RANGES.delayHighCut.min,
    AUDIO_PARAM_RANGES.delayHighCut.max
  );
  out.reverb = out.reverbMix; // legacy alias: both fields carry the wet level
  out.pan = AUDIO_PARAM_DEFAULTS.pan; // deliberately pinned to center (see audioParams.test.js)
  out.useADSR = merged.useADSR !== false;
  out.useFM = !!merged.useFM;
  out.useFilter = !!merged.useFilter;
  out.reverbEnabled = typeof merged.reverbEnabled === 'boolean'
    ? merged.reverbEnabled
    : AUDIO_PARAM_DEFAULTS.reverbEnabled;
  out.delayEnabled = typeof merged.delayEnabled === 'boolean'
    ? merged.delayEnabled
    : AUDIO_PARAM_DEFAULTS.delayEnabled;
  out.delaySync = !!merged.delaySync;
  out.reverbMode = coerceReverbMode(merged.reverbMode);
  out.delayMode = coerceDelayMode(merged.delayMode);
  out.delayDivision = coerceDelayDivision(merged.delayDivision);
  out.modRoutes = sanitizeModRoutes(merged.modRoutes);
  return out;
};

export const applyEffectToggleState = (params = {}) => {
  const next = { ...params };

  if (next.delayEnabled === false) {
    next.delayMix = 0;
    next.delayFeedback = 0;
    next.delayAge = 0;
    next.delayMotion = 0;
  }

  if (next.reverbEnabled === false) {
    next.reverb = 0;
    next.reverbMix = 0;
  }

  return next;
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
  unisonDetune: params.unisonDetune,
  lfo1Shape: params.lfo1Shape,
  lfo2Shape: params.lfo2Shape,
  lfo2Rate: params.lfo2Rate,
  modAttack: params.modAttack,
  modDecay: params.modDecay,
  modSustain: params.modSustain,
  modRelease: params.modRelease,
  modRoutes: params.modRoutes,
  glideTime: params.glideTime,
  glideMode: params.glideMode,
  velocityCurve: params.velocityCurve
});

export const WORKLET_PARAM_DEFAULTS = toWorkletParams(AUDIO_PARAM_DEFAULTS);
