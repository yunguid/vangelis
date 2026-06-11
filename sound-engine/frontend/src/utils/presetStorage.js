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

// Mod-matrix enums, mirrored from audio/synth-worklet.js for readability.
const SRC = Object.freeze({
  LFO1: 0, LFO2: 1, AMP_ENV: 2, MOD_ENV: 3, VEL: 4, KEY: 5, WHEEL: 6
});
const DST = Object.freeze({
  PITCH: 0, CUTOFF: 1, AMP: 2, FM: 3, DETUNE: 4
});

/**
 * Every factory patch spreads over this fully-specified clean slate so that
 * switching presets is deterministic — nothing leaks in from the previous
 * sound. Field set mirrors AUDIO_PARAM_DEFAULTS minus volume/pan (those stay
 * under user control when a preset loads).
 */
const CLEAN_PATCH = Object.freeze({
  useADSR: true,
  attack: 0.01, decay: 0.18, sustain: 0.76, release: 0.42,
  useFM: false, fmRatio: 2, fmIndex: 2,
  phaseOffset: 0,
  useFilter: false, filterCutoff: 18000, filterResonance: 0.7, filterMode: 0,
  lfo1Shape: 0, lfoRate: 0, lfoDepth: 0, lfoTarget: 0,
  lfo2Shape: 0, lfo2Rate: 0,
  unisonVoices: 1, unisonDetune: 0,
  modAttack: 0.05, modDecay: 0.3, modSustain: 0.5, modRelease: 0.4,
  modRoutes: [],
  glideTime: 0, velocityCurve: 0,
  distortion: 0,
  delayEnabled: false, delayMode: 'digital', delaySync: true, delayTime: 280,
  delayDivision: '1/8', delayFeedback: 0.3, delayMix: 0.18, delayStereo: 0.7,
  delayLowCut: 120, delayHighCut: 6800, delayDucking: 0.18, delayAge: 0.2, delayMotion: 0.3,
  reverbEnabled: false, reverbMode: 'hall', reverbSize: 0.58, reverbDecay: 0.52,
  reverbTone: 0.56, reverbMix: 0.25, reverbPreDelay: 18, reverbWidth: 0.82
});

const patch = (overrides) => ({ ...CLEAN_PATCH, ...overrides });

export const PRESET_CATEGORIES = Object.freeze([
  'Leads', 'Pads & Strings', 'Bass', 'Keys & Bells', 'Motion & Texture'
]);

/**
 * Factory presets — a played-in bank inspired by the CS-80 / Blade Runner
 * palette and modern analog production. Depth scaling reference:
 * pitch ±12 st, cutoff ±4 oct, amp ±100%, FM ±10 rad, detune ±50 ¢ at |depth|=1.
 */
export const FACTORY_PRESETS = [
  // ── Leads ────────────────────────────────────────────────────────────
  {
    id: 'factory-main-titles-brass',
    name: 'Main Titles Brass',
    category: 'Leads',
    description: 'CS-80 style brass lead — slow filter bloom, gentle vibrato, big hall.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.07, decay: 0.35, sustain: 0.82, release: 0.55,
      useFilter: true, filterCutoff: 1100, filterResonance: 1.6, filterMode: 0,
      glideTime: 0.05, velocityCurve: -0.15,
      lfo1Shape: 0, lfoRate: 5.2,
      unisonVoices: 2, unisonDetune: 9,
      modAttack: 0.04, modDecay: 0.5, modSustain: 0.55, modRelease: 0.5,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.42 }, // brass bloom
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.22 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.18 },
        { src: SRC.LFO1, dst: DST.PITCH, depth: 0.022 },    // ~26¢ vibrato
        { src: SRC.WHEEL, dst: DST.CUTOFF, depth: 0.25 }    // wheel opens it up
      ],
      distortion: 0.14,
      reverbEnabled: true, reverbMode: 'hall', reverbMix: 0.3,
      reverbSize: 0.7, reverbDecay: 0.6, reverbTone: 0.55,
      reverbPreDelay: 24, reverbWidth: 0.9
    })
  },
  {
    id: 'factory-blade-runner-blues',
    name: 'Blade Runner Blues',
    category: 'Leads',
    description: 'Smoky late-night solo lead — long glide, breathing filter, tape echo into fog.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.18, decay: 0.6, sustain: 0.7, release: 1.3,
      useFilter: true, filterCutoff: 950, filterResonance: 2.1, filterMode: 0,
      glideTime: 0.22, velocityCurve: -0.3,
      lfo1Shape: 0, lfoRate: 4.6,
      lfo2Shape: 0, lfo2Rate: 0.22,
      unisonVoices: 2, unisonDetune: 7,
      modAttack: 0.35, modDecay: 1.2, modSustain: 0.4, modRelease: 0.8,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.5 },
        { src: SRC.LFO1, dst: DST.PITCH, depth: 0.028 },
        { src: SRC.LFO2, dst: DST.CUTOFF, depth: 0.1 },     // slow breath
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.3 },
        { src: SRC.WHEEL, dst: DST.CUTOFF, depth: 0.3 }
      ],
      distortion: 0.18,
      delayEnabled: true, delayMode: 'tape', delaySync: true, delayDivision: '1/4.',
      delayFeedback: 0.42, delayMix: 0.18, delayStereo: 0.6,
      delayLowCut: 200, delayHighCut: 4800, delayDucking: 0.3,
      delayAge: 0.55, delayMotion: 0.5,
      reverbEnabled: true, reverbMode: 'ambient', reverbMix: 0.42,
      reverbSize: 0.85, reverbDecay: 0.8, reverbTone: 0.45,
      reverbPreDelay: 36, reverbWidth: 1
    })
  },
  {
    id: 'factory-spinner-chase',
    name: 'Spinner Chase',
    category: 'Leads',
    description: 'Aggressive square lead — pitch chirp attack, S&H sparkle, ping-pong echoes.',
    factory: true,
    waveformType: 'Square',
    audioParams: patch({
      attack: 0.005, decay: 0.25, sustain: 0.6, release: 0.18,
      useFilter: true, filterCutoff: 2400, filterResonance: 2.6, filterMode: 0,
      glideTime: 0.03, velocityCurve: 0.25,
      lfo2Shape: 5, lfo2Rate: 7.5,
      unisonVoices: 2, unisonDetune: 12,
      modAttack: 0.005, modDecay: 0.12, modSustain: 0, modRelease: 0.2,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.PITCH, depth: 0.07 },  // ~0.8 st chirp
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.45 },
        { src: SRC.LFO2, dst: DST.CUTOFF, depth: 0.12 },
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.35 }
      ],
      distortion: 0.32,
      delayEnabled: true, delayMode: 'ping-pong', delaySync: true, delayDivision: '1/8',
      delayFeedback: 0.38, delayMix: 0.2, delayStereo: 1,
      delayLowCut: 240, delayHighCut: 6000, delayDucking: 0.35,
      delayAge: 0.15, delayMotion: 0.3,
      reverbEnabled: true, reverbMode: 'room', reverbMix: 0.16,
      reverbSize: 0.4, reverbDecay: 0.35, reverbTone: 0.6,
      reverbPreDelay: 12, reverbWidth: 0.8
    })
  },
  {
    id: 'factory-chariots-glide',
    name: 'Chariots Glide',
    category: 'Leads',
    description: 'Warm FM horn-flute — soft attack, singing vibrato, glide between notes.',
    factory: true,
    waveformType: 'Triangle',
    audioParams: patch({
      attack: 0.06, decay: 0.4, sustain: 0.78, release: 0.9,
      useFM: true, fmRatio: 2, fmIndex: 2.6,
      useFilter: true, filterCutoff: 3600, filterResonance: 0.9, filterMode: 0,
      glideTime: 0.12, velocityCurve: -0.2,
      lfo1Shape: 0, lfoRate: 5,
      modAttack: 0.03, modDecay: 0.6, modSustain: 0.35, modRelease: 0.5,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.FM, depth: 0.22 },     // bright start
        { src: SRC.VEL, dst: DST.FM, depth: 0.25 },
        { src: SRC.LFO1, dst: DST.PITCH, depth: 0.02 }
      ],
      delayEnabled: true, delayMode: 'digital', delaySync: true, delayDivision: '1/4',
      delayFeedback: 0.3, delayMix: 0.12, delayStereo: 0.5, delayDucking: 0.25,
      reverbEnabled: true, reverbMode: 'hall', reverbMix: 0.34,
      reverbSize: 0.75, reverbDecay: 0.68, reverbTone: 0.55,
      reverbPreDelay: 28, reverbWidth: 0.95
    })
  },

  {
    id: 'factory-love-theme',
    name: 'Love Theme',
    category: 'Leads',
    description: 'Breathy romantic lead — saxophone warmth, slow vibrato, plate sheen.',
    factory: true,
    waveformType: 'Triangle',
    audioParams: patch({
      attack: 0.12, decay: 0.5, sustain: 0.75, release: 1.1,
      useFM: true, fmRatio: 1.5, fmIndex: 1.6,
      useFilter: true, filterCutoff: 2400, filterResonance: 1.1, filterMode: 0,
      glideTime: 0.1, velocityCurve: -0.35,
      lfo1Shape: 0, lfoRate: 4.4,
      modAttack: 0.25, modDecay: 0.8, modSustain: 0.4, modRelease: 0.6,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.PITCH, depth: 0.024 },
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.3 },  // breath swell
        { src: SRC.VEL, dst: DST.FM, depth: 0.2 },
        { src: SRC.WHEEL, dst: DST.CUTOFF, depth: 0.25 }
      ],
      distortion: 0.08,
      delayEnabled: true, delayMode: 'digital', delaySync: true, delayDivision: '1/4',
      delayFeedback: 0.28, delayMix: 0.1, delayStereo: 0.55, delayDucking: 0.3,
      reverbEnabled: true, reverbMode: 'plate', reverbMix: 0.36,
      reverbSize: 0.72, reverbDecay: 0.66, reverbTone: 0.58,
      reverbPreDelay: 26, reverbWidth: 0.95
    })
  },

  // ── Pads & Strings ───────────────────────────────────────────────────
  {
    id: 'factory-tears-in-rain',
    name: 'Tears in Rain',
    category: 'Pads & Strings',
    description: 'Vast ambient saw pad — four detuned voices breathing under endless reverb.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 1.4, decay: 1, sustain: 0.85, release: 3.2,
      useFilter: true, filterCutoff: 1500, filterResonance: 0.8, filterMode: 0,
      lfo1Shape: 1, lfoRate: 0.5,
      lfo2Shape: 0, lfo2Rate: 0.16,
      unisonVoices: 4, unisonDetune: 16,
      modRoutes: [
        { src: SRC.LFO2, dst: DST.CUTOFF, depth: 0.22 },    // slow breathing
        { src: SRC.LFO1, dst: DST.DETUNE, depth: 0.3 },     // drifting ensemble
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.15 }
      ],
      distortion: 0.06,
      reverbEnabled: true, reverbMode: 'ambient', reverbMix: 0.5,
      reverbSize: 0.92, reverbDecay: 0.86, reverbTone: 0.5,
      reverbPreDelay: 40, reverbWidth: 1
    })
  },
  {
    id: 'factory-rachels-strings',
    name: "Rachel's Strings",
    category: 'Pads & Strings',
    description: 'Vintage string ensemble — chorused saws with a soft bowed swell.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.5, decay: 0.6, sustain: 0.8, release: 1.5,
      useFilter: true, filterCutoff: 5800, filterResonance: 0.6, filterMode: 0,
      velocityCurve: -0.25,
      lfo1Shape: 0, lfoRate: 5.4,
      lfo2Shape: 0, lfo2Rate: 0.3,
      unisonVoices: 4, unisonDetune: 11,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.DETUNE, depth: 0.22 },    // ensemble shimmer
        { src: SRC.LFO2, dst: DST.CUTOFF, depth: 0.08 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.12 }
      ],
      reverbEnabled: true, reverbMode: 'hall', reverbMix: 0.3,
      reverbSize: 0.72, reverbDecay: 0.62, reverbTone: 0.58,
      reverbPreDelay: 22, reverbWidth: 0.95
    })
  },
  {
    id: 'factory-polar-glass',
    name: 'Polar Glass',
    category: 'Pads & Strings',
    description: 'Glassy FM pad — crystalline overtones fading in over a slow tremolo.',
    factory: true,
    waveformType: 'Triangle',
    audioParams: patch({
      attack: 0.9, decay: 1.2, sustain: 0.7, release: 2.4,
      useFM: true, fmRatio: 3, fmIndex: 1.8,
      useFilter: true, filterCutoff: 6800, filterResonance: 0.8, filterMode: 0,
      lfo1Shape: 0, lfoRate: 0.13,
      lfo2Shape: 0, lfo2Rate: 0.2,
      unisonVoices: 3, unisonDetune: 13,
      modAttack: 0.8, modDecay: 1.5, modSustain: 0.3, modRelease: 1.2,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.FM, depth: 0.3 },      // overtones bloom late
        { src: SRC.LFO2, dst: DST.AMP, depth: 0.07 },
        { src: SRC.LFO1, dst: DST.DETUNE, depth: 0.25 }
      ],
      reverbEnabled: true, reverbMode: 'plate', reverbMix: 0.38,
      reverbSize: 0.7, reverbDecay: 0.7, reverbTone: 0.62,
      reverbPreDelay: 26, reverbWidth: 1
    })
  },
  {
    id: 'factory-dean-drift',
    name: 'Dean Drift',
    category: 'Pads & Strings',
    description: 'Dark saturated analog pad — heavy detune, slow filter swell, tape haze.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.3, decay: 0.7, sustain: 0.85, release: 1.8,
      useFilter: true, filterCutoff: 1050, filterResonance: 1.9, filterMode: 0,
      lfo1Shape: 1, lfoRate: 0.6,
      lfo2Shape: 0, lfo2Rate: 0.25,
      unisonVoices: 4, unisonDetune: 24,
      modAttack: 0.6, modDecay: 1.4, modSustain: 0.5, modRelease: 1,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.35 },
        { src: SRC.LFO1, dst: DST.CUTOFF, depth: 0.1 },
        { src: SRC.LFO2, dst: DST.DETUNE, depth: 0.35 }
      ],
      distortion: 0.34,
      delayEnabled: true, delayMode: 'tape', delaySync: true, delayDivision: '1/2',
      delayFeedback: 0.35, delayMix: 0.14, delayStereo: 0.7,
      delayLowCut: 160, delayHighCut: 4200, delayDucking: 0.2,
      delayAge: 0.6, delayMotion: 0.55,
      reverbEnabled: true, reverbMode: 'hall', reverbMix: 0.34,
      reverbSize: 0.8, reverbDecay: 0.72, reverbTone: 0.4,
      reverbPreDelay: 30, reverbWidth: 1
    })
  },

  // ── Bass ─────────────────────────────────────────────────────────────
  {
    id: 'factory-808-heart',
    name: '808 Heart',
    category: 'Bass',
    description: 'Pure sine sub — fast pitch drop on the attack, saturated to bloom on small speakers.',
    factory: true,
    waveformType: 'Sine',
    audioParams: patch({
      attack: 0.005, decay: 0.5, sustain: 0.55, release: 0.25,
      useFilter: true, filterCutoff: 2200, filterResonance: 0.7, filterMode: 0,
      glideTime: 0.06, velocityCurve: -0.4,
      modAttack: 0.005, modDecay: 0.09, modSustain: 0, modRelease: 0.1,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.PITCH, depth: 0.22 }, // ~2.6 st drop
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.2 }
      ],
      distortion: 0.28
    })
  },
  {
    id: 'factory-growl-unit',
    name: 'Growl Unit',
    category: 'Bass',
    description: 'Resonant square bass — snappy filter bite that tracks how hard you play.',
    factory: true,
    waveformType: 'Square',
    audioParams: patch({
      attack: 0.005, decay: 0.22, sustain: 0.35, release: 0.16,
      useFilter: true, filterCutoff: 620, filterResonance: 3.4, filterMode: 0,
      glideTime: 0.05, velocityCurve: 0.2,
      modAttack: 0.005, modDecay: 0.18, modSustain: 0.05, modRelease: 0.15,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.5 },
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.4 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.15 }
      ],
      distortion: 0.3
    })
  },
  {
    id: 'factory-reese-patrol',
    name: 'Reese Patrol',
    category: 'Bass',
    description: 'Wide cinematic reese — detuned saws phasing slowly under a dark lowpass.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.01, decay: 0.3, sustain: 0.9, release: 0.3,
      useFilter: true, filterCutoff: 850, filterResonance: 1.2, filterMode: 0,
      lfo2Shape: 0, lfo2Rate: 0.35,
      unisonVoices: 3, unisonDetune: 26,
      modAttack: 0.01, modDecay: 0.5, modSustain: 0.3, modRelease: 0.3,
      modRoutes: [
        { src: SRC.LFO2, dst: DST.DETUNE, depth: 0.4 },     // slow swirl
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.2 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.15 }
      ],
      distortion: 0.22
    })
  },

  // ── Keys & Bells ─────────────────────────────────────────────────────
  {
    id: 'factory-memories-of-green',
    name: 'Memories of Green',
    category: 'Keys & Bells',
    description: 'Nostalgic FM electric piano — velocity opens the tine brightness, echoes trail off.',
    factory: true,
    waveformType: 'Sine',
    audioParams: patch({
      attack: 0.005, decay: 2.6, sustain: 0.18, release: 0.7,
      useFM: true, fmRatio: 1, fmIndex: 2.4,
      velocityCurve: -0.1,
      unisonVoices: 2, unisonDetune: 5,
      modAttack: 0.005, modDecay: 1.1, modSustain: 0, modRelease: 0.6,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.FM, depth: 0.32 },     // bright strike, mellow tail
        { src: SRC.VEL, dst: DST.FM, depth: 0.35 }
      ],
      delayEnabled: true, delayMode: 'digital', delaySync: true, delayDivision: '1/4',
      delayFeedback: 0.26, delayMix: 0.14, delayStereo: 0.6, delayDucking: 0.3,
      reverbEnabled: true, reverbMode: 'plate', reverbMix: 0.26,
      reverbSize: 0.6, reverbDecay: 0.55, reverbTone: 0.6,
      reverbPreDelay: 20, reverbWidth: 0.9
    })
  },
  {
    id: 'factory-glass-bells',
    name: 'Glass Bells',
    category: 'Keys & Bells',
    description: 'Inharmonic FM bells — bright strike that mellows up the keyboard.',
    factory: true,
    waveformType: 'Sine',
    audioParams: patch({
      attack: 0.005, decay: 2.2, sustain: 0, release: 1.6,
      useFM: true, fmRatio: 3.5, fmIndex: 6,
      velocityCurve: 0.2,
      unisonVoices: 2, unisonDetune: 4,
      modAttack: 0.005, modDecay: 1, modSustain: 0, modRelease: 0.8,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.FM, depth: 0.55 },
        { src: SRC.VEL, dst: DST.FM, depth: 0.3 },
        { src: SRC.KEY, dst: DST.FM, depth: -0.3 }          // tamer up high
      ],
      reverbEnabled: true, reverbMode: 'plate', reverbMix: 0.3,
      reverbSize: 0.68, reverbDecay: 0.66, reverbTone: 0.62,
      reverbPreDelay: 24, reverbWidth: 1
    })
  },
  {
    id: 'factory-ice-pluck',
    name: 'Ice Pluck',
    category: 'Keys & Bells',
    description: 'Crisp triangle pluck — resonant snap with ping-pong delays.',
    factory: true,
    waveformType: 'Triangle',
    audioParams: patch({
      attack: 0.005, decay: 0.38, sustain: 0, release: 0.45,
      useFilter: true, filterCutoff: 3000, filterResonance: 2.4, filterMode: 0,
      velocityCurve: 0.1,
      modAttack: 0.005, modDecay: 0.16, modSustain: 0, modRelease: 0.2,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.55 },
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.35 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.2 }
      ],
      delayEnabled: true, delayMode: 'ping-pong', delaySync: true, delayDivision: '1/8',
      delayFeedback: 0.42, delayMix: 0.24, delayStereo: 1,
      delayLowCut: 300, delayHighCut: 7000, delayDucking: 0.3,
      reverbEnabled: true, reverbMode: 'room', reverbMix: 0.18,
      reverbSize: 0.45, reverbDecay: 0.4, reverbTone: 0.6,
      reverbPreDelay: 14, reverbWidth: 0.85
    })
  },

  {
    id: 'factory-concrete-stab',
    name: 'Concrete Stab',
    category: 'Keys & Bells',
    description: 'Saturated brass stab — punchy filter knock for chords, drier the softer you play.',
    factory: true,
    waveformType: 'Square',
    audioParams: patch({
      attack: 0.005, decay: 0.45, sustain: 0.4, release: 0.3,
      useFilter: true, filterCutoff: 1700, filterResonance: 1.3, filterMode: 0,
      velocityCurve: 0.15,
      unisonVoices: 2, unisonDetune: 10,
      modAttack: 0.005, modDecay: 0.2, modSustain: 0.1, modRelease: 0.2,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.45 }, // the knock
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.35 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.15 }
      ],
      distortion: 0.3,
      delayEnabled: true, delayMode: 'digital', delaySync: true, delayDivision: '1/8',
      delayFeedback: 0.22, delayMix: 0.1, delayStereo: 0.7, delayDucking: 0.4,
      reverbEnabled: true, reverbMode: 'room', reverbMix: 0.14,
      reverbSize: 0.38, reverbDecay: 0.32, reverbTone: 0.5,
      reverbPreDelay: 10, reverbWidth: 0.8
    })
  },

  // ── Motion & Texture ─────────────────────────────────────────────────
  {
    id: 'factory-acid-memory',
    name: 'Acid Memory',
    category: 'Motion & Texture',
    description: 'Squelchy acid line — sample-and-hold stabs over a tight 1/16 delay.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.005, decay: 0.16, sustain: 0.3, release: 0.18,
      useFilter: true, filterCutoff: 780, filterResonance: 4.6, filterMode: 0,
      glideTime: 0.09, velocityCurve: 0.2,
      lfo1Shape: 5, lfoRate: 5.5,
      modAttack: 0.005, modDecay: 0.3, modSustain: 0.08, modRelease: 0.2,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.CUTOFF, depth: 0.18 },
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.5 },
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.3 }
      ],
      distortion: 0.24,
      delayEnabled: true, delayMode: 'digital', delaySync: true, delayDivision: '1/16',
      delayFeedback: 0.3, delayMix: 0.16, delayStereo: 0.8, delayDucking: 0.35
    })
  },
  {
    id: 'factory-sea-of-dunes',
    name: 'Sea of Dunes',
    category: 'Motion & Texture',
    description: 'Slow dark drone — detuned mass with a tide-like filter, almost a score in itself.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 2.4, decay: 2, sustain: 0.9, release: 4.5,
      useFilter: true, filterCutoff: 520, filterResonance: 1.4, filterMode: 0,
      lfo1Shape: 0, lfoRate: 0.07,
      lfo2Shape: 1, lfo2Rate: 0.11,
      unisonVoices: 4, unisonDetune: 34,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.CUTOFF, depth: 0.45 },    // tide
        { src: SRC.LFO2, dst: DST.DETUNE, depth: 0.5 }
      ],
      distortion: 0.4,
      reverbEnabled: true, reverbMode: 'ambient', reverbMix: 0.55,
      reverbSize: 0.95, reverbDecay: 0.9, reverbTone: 0.38,
      reverbPreDelay: 48, reverbWidth: 1
    })
  },
  {
    id: 'factory-voight-kampff',
    name: 'Voight-Kampff',
    category: 'Motion & Texture',
    description: 'Eerie bandpass formant pad — a vowel that never resolves.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.7, decay: 1, sustain: 0.8, release: 2,
      useFilter: true, filterCutoff: 1000, filterResonance: 2.8, filterMode: 2,
      lfo1Shape: 0, lfoRate: 0.18,
      lfo2Shape: 0, lfo2Rate: 4.8,
      unisonVoices: 3, unisonDetune: 15,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.CUTOFF, depth: 0.35 },    // sweeping formant
        { src: SRC.LFO2, dst: DST.PITCH, depth: 0.012 }
      ],
      delayEnabled: true, delayMode: 'tape', delaySync: true, delayDivision: '1/2',
      delayFeedback: 0.3, delayMix: 0.1, delayAge: 0.5, delayStereo: 0.7,
      reverbEnabled: true, reverbMode: 'ambient', reverbMix: 0.45,
      reverbSize: 0.85, reverbDecay: 0.8, reverbTone: 0.5,
      reverbPreDelay: 32, reverbWidth: 1
    })
  },
  {
    id: 'factory-tape-solitude',
    name: 'Tape Solitude',
    category: 'Motion & Texture',
    description: 'Lo-fi tape keys — wow, flutter and a worn dotted echo.',
    factory: true,
    waveformType: 'Triangle',
    audioParams: patch({
      attack: 0.006, decay: 1.4, sustain: 0.3, release: 0.6,
      useFM: true, fmRatio: 1, fmIndex: 1.2,
      useFilter: true, filterCutoff: 4800, filterResonance: 0.8, filterMode: 0,
      velocityCurve: -0.2,
      lfo1Shape: 0, lfoRate: 0.9,
      lfo2Shape: 0, lfo2Rate: 6.3,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.PITCH, depth: 0.005 },    // ~6¢ tape wow
        { src: SRC.LFO2, dst: DST.AMP, depth: 0.05 },       // flutter tremolo
        { src: SRC.VEL, dst: DST.FM, depth: 0.2 }
      ],
      distortion: 0.12,
      delayEnabled: true, delayMode: 'tape', delaySync: true, delayDivision: '1/4.',
      delayFeedback: 0.45, delayMix: 0.22, delayStereo: 0.55,
      delayLowCut: 220, delayHighCut: 3800, delayDucking: 0.25,
      delayAge: 0.85, delayMotion: 0.7,
      reverbEnabled: true, reverbMode: 'room', reverbMix: 0.22,
      reverbSize: 0.5, reverbDecay: 0.45, reverbTone: 0.4,
      reverbPreDelay: 16, reverbWidth: 0.8
    })
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
