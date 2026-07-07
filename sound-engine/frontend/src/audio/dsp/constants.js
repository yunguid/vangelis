// Shared DSP constants and enums for the synth engine. Pure data — safe to
// import from the AudioWorklet realm, the main thread, and Node test runners.

export const TWO_PI = Math.PI * 2;
export const MAX_VOICES = 24;
export const MIN_GAIN = 0.0001;
export const MAX_MOD_ROUTES = 8;
export const FILTER_MAX_CUTOFF_RATIO = 0.35;
export const VOICE_SAMPLE_LIMIT = 8.0;
export const CLIP_KNEE = 0.5;

export const WAVEFORMS = Object.freeze({
  SINE: 0,
  SAW: 1,
  SQUARE: 2,
  TRIANGLE: 3
});

export const ENV_STAGE = Object.freeze({
  IDLE: 0,
  ATTACK: 1,
  DECAY: 2,
  SUSTAIN: 3,
  RELEASE: 4
});

// Modulation matrix enums (mirrored in utils/audioParams.js)
export const MOD_SRC = Object.freeze({
  LFO1: 0,
  LFO2: 1,
  AMP_ENV: 2,
  MOD_ENV: 3,
  VELOCITY: 4,
  KEY_TRACK: 5,
  MOD_WHEEL: 6
});

export const MOD_DST = Object.freeze({
  PITCH: 0, // +/-12 semitones at depth 1
  CUTOFF: 1, // +/-4 octaves at depth 1
  AMP: 2, // +/-1 (gain offset) at depth 1
  FM_INDEX: 3, // +/-10 radians at depth 1
  DETUNE: 4 // +/-50 cents at depth 1
});

export const LFO_SHAPES = Object.freeze({
  SINE: 0,
  TRIANGLE: 1,
  SQUARE: 2,
  SAW_UP: 3,
  SAW_DOWN: 4,
  SAMPLE_HOLD: 5
});

// Single source of truth for engine parameter defaults. The UI layer's
// AUDIO_PARAM_DEFAULTS (utils/audioParams.js) derives its synth subset from
// this object — never restate these values elsewhere.
export const DEFAULT_PARAMS = {
  attack: 0.012,
  decay: 0.18,
  sustain: 0.76,
  release: 0.42,
  useADSR: true,
  useFM: false,
  fmRatio: 2.0,
  fmIndex: 2.0,
  phaseOffsetDeg: 0,
  useFilter: false,
  filterCutoff: 18000,
  filterResonance: 0.7,
  filterMode: 0,
  lfoRate: 0.0,
  lfoDepth: 0.0,
  lfoTarget: 0,
  unisonVoices: 1,
  unisonDetune: 0.0,
  // Modulation matrix
  lfo1Shape: 0,
  lfo2Shape: 0,
  lfo2Rate: 0.0,
  modAttack: 0.05,
  modDecay: 0.3,
  modSustain: 0.5,
  modRelease: 0.4,
  modRoutes: [],
  // Playability
  glideTime: 0.0,
  velocityCurve: 0.0
};

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
