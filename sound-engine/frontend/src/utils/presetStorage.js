/**
 * Named synth presets: factory patches + user presets in localStorage.
 * @module utils/presetStorage
 */

const STORAGE_KEY = 'vangelis.presets.v1';

const makeId = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

/**
 * Factory presets. Each patch is a partial audioParams object — it merges
 * over the current params through sanitizeAudioParams upstream.
 * These intentionally exercise the modulation matrix.
 */
export const FACTORY_PRESETS = [
  {
    id: 'factory-vapor-keys',
    name: 'Vapor Keys',
    factory: true,
    waveformType: 'Triangle',
    audioParams: {
      attack: 0.04, decay: 0.4, sustain: 0.6, release: 0.8, useADSR: true,
      useFM: false, useFilter: true, filterCutoff: 3800, filterResonance: 1.1, filterMode: 0,
      glideTime: 0.08, velocityCurve: -0.3,
      lfoRate: 0.0, lfoDepth: 0, lfoTarget: 0,
      lfo2Shape: 0, lfo2Rate: 0.35,
      unisonVoices: 2, unisonDetune: 6,
      modRoutes: [
        { src: 1, dst: 1, depth: 0.18 },  // LFO2 -> cutoff, slow breathe
        { src: 4, dst: 2, depth: 0.35 }   // velocity -> amplitude
      ],
      reverbEnabled: true, reverbMix: 0.3, reverbMode: 'hall',
      delayEnabled: false, distortion: 0
    }
  },
  {
    id: 'factory-acid-drift',
    name: 'Acid Drift',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: {
      attack: 0.005, decay: 0.18, sustain: 0.42, release: 0.2, useADSR: true,
      useFM: false, useFilter: true, filterCutoff: 900, filterResonance: 4.5, filterMode: 0,
      glideTime: 0.12, velocityCurve: 0.3,
      lfo1Shape: 5, lfoRate: 6, lfoDepth: 0, lfoTarget: 0,
      unisonVoices: 1, unisonDetune: 0,
      modRoutes: [
        { src: 0, dst: 1, depth: 0.22 },  // S&H LFO1 -> cutoff
        { src: 3, dst: 1, depth: 0.45 },  // mod env -> cutoff sweep
        { src: 4, dst: 1, depth: 0.25 }   // velocity -> cutoff
      ],
      modAttack: 0.005, modDecay: 0.35, modSustain: 0.1, modRelease: 0.25,
      delayEnabled: true, delayMix: 0.2, delaySync: true, delayDivision: '1/8',
      delayFeedback: 0.35, reverbEnabled: false, distortion: 0.22
    }
  },
  {
    id: 'factory-fm-bell',
    name: 'FM Bell',
    factory: true,
    waveformType: 'Sine',
    audioParams: {
      attack: 0.005, decay: 1.6, sustain: 0.0, release: 1.2, useADSR: true,
      useFM: true, fmRatio: 3.5, fmIndex: 6,
      useFilter: false, glideTime: 0, velocityCurve: 0.4,
      lfoRate: 0, lfoDepth: 0, lfoTarget: 0,
      unisonVoices: 1, unisonDetune: 0,
      modRoutes: [
        { src: 3, dst: 3, depth: 0.6 },   // mod env -> FM index (bright attack, mellow tail)
        { src: 4, dst: 3, depth: 0.4 },   // velocity -> FM index
        { src: 5, dst: 3, depth: -0.3 }   // key track -> less FM up high
      ],
      modAttack: 0.005, modDecay: 0.9, modSustain: 0.0, modRelease: 0.6,
      reverbEnabled: true, reverbMix: 0.26, reverbMode: 'plate',
      delayEnabled: false, distortion: 0
    }
  },
  {
    id: 'factory-wide-anthem',
    name: 'Wide Anthem',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: {
      attack: 0.06, decay: 0.3, sustain: 0.8, release: 0.5, useADSR: true,
      useFM: false, useFilter: true, filterCutoff: 6500, filterResonance: 0.9, filterMode: 0,
      glideTime: 0, velocityCurve: 0,
      lfo1Shape: 0, lfoRate: 5.5, lfoDepth: 0.12, lfoTarget: 1, // legacy vibrato
      unisonVoices: 4, unisonDetune: 14,
      modRoutes: [
        { src: 4, dst: 1, depth: 0.3 },   // velocity -> cutoff
        { src: 6, dst: 4, depth: 0.5 }    // mod wheel -> extra detune spread
      ],
      reverbEnabled: true, reverbMix: 0.22, reverbMode: 'hall',
      delayEnabled: true, delayMix: 0.14, delaySync: true, delayDivision: '1/4',
      delayFeedback: 0.28, distortion: 0.08
    }
  }
];

export const loadUserPresets = () => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((p) => p && p.id && p.name) : [];
  } catch {
    return [];
  }
};

const persist = (presets) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Storage full or unavailable; preset stays in memory only.
  }
};

export const saveUserPreset = ({ name, waveformType, audioParams }) => {
  const trimmed = (name || '').trim().slice(0, 48) || 'Untitled';
  const preset = {
    id: makeId(),
    name: trimmed,
    waveformType,
    audioParams,
    createdAt: Date.now()
  };
  const next = [preset, ...loadUserPresets()].slice(0, 50);
  persist(next);
  return preset;
};

export const deleteUserPreset = (id) => {
  const next = loadUserPresets().filter((preset) => preset.id !== id);
  persist(next);
  return next;
};
