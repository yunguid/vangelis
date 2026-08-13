/**
 * Named factory synth presets.
 * @module utils/factoryPresets
 */

import { MOD_SRC, MOD_DST } from '../audio/dsp/constants.js';

// Short aliases over the engine's mod-matrix enums, for compact patch tables.
// Exported (with CLEAN_PATCH) so sibling banks — the Patch Lab — author
// against the identical clean-slate contract.
export const SRC = Object.freeze({
  LFO1: MOD_SRC.LFO1,
  LFO2: MOD_SRC.LFO2,
  AMP_ENV: MOD_SRC.AMP_ENV,
  MOD_ENV: MOD_SRC.MOD_ENV,
  VEL: MOD_SRC.VELOCITY,
  KEY: MOD_SRC.KEY_TRACK,
  WHEEL: MOD_SRC.MOD_WHEEL
});
export const DST = Object.freeze({
  PITCH: MOD_DST.PITCH,
  CUTOFF: MOD_DST.CUTOFF,
  AMP: MOD_DST.AMP,
  FM: MOD_DST.FM_INDEX,
  DETUNE: MOD_DST.DETUNE
});

/**
 * Every factory patch spreads over this fully-specified clean slate so that
 * switching presets is deterministic — nothing leaks in from the previous
 * sound. Field set mirrors AUDIO_PARAM_DEFAULTS minus volume/pan (those stay
 * under user control when a preset loads).
 */
export const CLEAN_PATCH = Object.freeze({
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

  {
    id: 'factory-jexus-scream',
    name: 'Jexus Scream',
    category: 'Leads',
    description: 'CS-80 wail in the Jexus style — pitch scoop into a crying resonant sweep, wheel opens the throat.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.03, decay: 0.4, sustain: 0.85, release: 0.6,
      useFilter: true, filterCutoff: 1400, filterResonance: 2.8, filterMode: 0,
      glideTime: 0.07, velocityCurve: 0.1,
      lfo1Shape: 0, lfoRate: 5.8,
      modAttack: 0.02, modDecay: 0.35, modSustain: 0.3, modRelease: 0.4,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.PITCH, depth: 0.04 },  // ~0.5 st scoop
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.4 },
        { src: SRC.LFO1, dst: DST.PITCH, depth: 0.025 },
        { src: SRC.WHEEL, dst: DST.CUTOFF, depth: 0.35 },
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.25 }
      ],
      distortion: 0.22,
      delayEnabled: true, delayMode: 'tape', delaySync: true, delayDivision: '1/4',
      delayFeedback: 0.35, delayMix: 0.14, delayStereo: 0.6,
      delayLowCut: 200, delayHighCut: 5200, delayDucking: 0.3,
      delayAge: 0.5, delayMotion: 0.45,
      reverbEnabled: true, reverbMode: 'hall', reverbMix: 0.32,
      reverbSize: 0.74, reverbDecay: 0.64, reverbTone: 0.52,
      reverbPreDelay: 26, reverbWidth: 0.95
    })
  },
  {
    id: 'factory-prophet-sync-sting',
    name: 'Prophet Sync Sting',
    category: 'Leads',
    description: 'Prophet-5 hard-sync bite — chirped attack, snappy filter, plays harder the harder you hit.',
    factory: true,
    waveformType: 'Square',
    audioParams: patch({
      attack: 0.005, decay: 0.3, sustain: 0.65, release: 0.22,
      useFilter: true, filterCutoff: 2000, filterResonance: 2.2, filterMode: 0,
      velocityCurve: 0.3,
      unisonVoices: 2, unisonDetune: 11,
      modAttack: 0.005, modDecay: 0.09, modSustain: 0, modRelease: 0.15,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.PITCH, depth: 0.09 }, // ~1 st sync chirp
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.5 },
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.3 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.15 }
      ],
      distortion: 0.28,
      delayEnabled: true, delayMode: 'digital', delaySync: true, delayDivision: '1/8',
      delayFeedback: 0.28, delayMix: 0.12, delayStereo: 0.7, delayDucking: 0.35,
      reverbEnabled: true, reverbMode: 'room', reverbMix: 0.15,
      reverbSize: 0.4, reverbDecay: 0.35, reverbTone: 0.58,
      reverbPreDelay: 12, reverbWidth: 0.8
    })
  },
  {
    id: 'factory-hyperpop-supersaw',
    name: 'Hyperpop Supersaw',
    category: 'Leads',
    description: 'Glittering four-voice supersaw — huge stereo ping-pong, made for pitched-up hooks.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.005, decay: 0.25, sustain: 0.8, release: 0.3,
      useFilter: true, filterCutoff: 9000, filterResonance: 0.8, filterMode: 0,
      glideTime: 0.03, velocityCurve: 0.1,
      lfo2Shape: 0, lfo2Rate: 0.3,
      unisonVoices: 4, unisonDetune: 30,
      modRoutes: [
        { src: SRC.LFO2, dst: DST.DETUNE, depth: 0.3 },
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.2 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.1 }
      ],
      distortion: 0.18,
      delayEnabled: true, delayMode: 'ping-pong', delaySync: true, delayDivision: '1/8',
      delayFeedback: 0.4, delayMix: 0.22, delayStereo: 1,
      delayLowCut: 260, delayHighCut: 9000, delayDucking: 0.3,
      reverbEnabled: true, reverbMode: 'plate', reverbMix: 0.2,
      reverbSize: 0.6, reverbDecay: 0.5, reverbTone: 0.65,
      reverbPreDelay: 16, reverbWidth: 1
    })
  },
  {
    id: 'factory-rage-lead',
    name: 'Rage Siren',
    category: 'Leads',
    description: 'Distorted rage lead — three detuned saws chewed by sample-and-hold filter stabs.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.15,
      useFilter: true, filterCutoff: 1100, filterResonance: 2.0, filterMode: 0,
      velocityCurve: 0.2,
      lfo1Shape: 5, lfoRate: 6.5,
      unisonVoices: 3, unisonDetune: 26,
      modAttack: 0.005, modDecay: 0.15, modSustain: 0.1, modRelease: 0.15,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.CUTOFF, depth: 0.15 },
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.35 },
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.3 }
      ],
      distortion: 0.55,
      delayEnabled: true, delayMode: 'digital', delaySync: true, delayDivision: '1/16',
      delayFeedback: 0.25, delayMix: 0.1, delayStereo: 0.8, delayDucking: 0.4,
      reverbEnabled: true, reverbMode: 'room', reverbMix: 0.12,
      reverbSize: 0.35, reverbDecay: 0.3, reverbTone: 0.45,
      reverbPreDelay: 8, reverbWidth: 0.8
    })
  },
  {
    id: 'factory-memorymoog-fifths',
    name: 'Memorymoog Fifths',
    category: 'Leads',
    description: 'Thick Memorymoog-style solo voice — creamy three-saw stack with singing vibrato.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.02, decay: 0.5, sustain: 0.8, release: 0.45,
      useFilter: true, filterCutoff: 1600, filterResonance: 1.3, filterMode: 0,
      glideTime: 0.09, velocityCurve: -0.1,
      lfo1Shape: 0, lfoRate: 4.9,
      modAttack: 0.05, modDecay: 0.6, modSustain: 0.5, modRelease: 0.5,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.PITCH, depth: 0.02 },
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.3 },
        { src: SRC.WHEEL, dst: DST.CUTOFF, depth: 0.3 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.2 }
      ],
      distortion: 0.2,
      reverbEnabled: true, reverbMode: 'hall', reverbMix: 0.24,
      reverbSize: 0.66, reverbDecay: 0.55, reverbTone: 0.55,
      reverbPreDelay: 20, reverbWidth: 0.9
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

  {
    id: 'factory-cs80-velvet',
    name: 'CS-80 Velvet',
    category: 'Pads & Strings',
    description: 'The classic CS-80 pad — slow warm bloom, gentle vibrato, wheel breathes light into it.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.7, decay: 0.8, sustain: 0.85, release: 2.2,
      useFilter: true, filterCutoff: 1250, filterResonance: 1.5, filterMode: 0,
      velocityCurve: -0.25,
      lfo1Shape: 0, lfoRate: 4.7,
      lfo2Shape: 0, lfo2Rate: 0.2,
      unisonVoices: 2, unisonDetune: 8,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.PITCH, depth: 0.018 },
        { src: SRC.LFO2, dst: DST.CUTOFF, depth: 0.15 },
        { src: SRC.WHEEL, dst: DST.CUTOFF, depth: 0.3 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.15 }
      ],
      distortion: 0.1,
      reverbEnabled: true, reverbMode: 'hall', reverbMix: 0.36,
      reverbSize: 0.78, reverbDecay: 0.7, reverbTone: 0.52,
      reverbPreDelay: 28, reverbWidth: 0.95
    })
  },
  {
    id: 'factory-jupiter-strings',
    name: 'Jupiter Strings',
    category: 'Pads & Strings',
    description: 'Jupiter-8 ensemble strings — four shimmering saws drifting against each other.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.6, decay: 0.7, sustain: 0.82, release: 1.9,
      useFilter: true, filterCutoff: 5200, filterResonance: 0.7, filterMode: 0,
      velocityCurve: -0.3,
      lfo1Shape: 0, lfoRate: 5.6,
      lfo2Shape: 0, lfo2Rate: 0.24,
      unisonVoices: 4, unisonDetune: 13,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.DETUNE, depth: 0.25 },
        { src: SRC.LFO2, dst: DST.CUTOFF, depth: 0.1 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.12 }
      ],
      reverbEnabled: true, reverbMode: 'plate', reverbMix: 0.3,
      reverbSize: 0.7, reverbDecay: 0.6, reverbTone: 0.56,
      reverbPreDelay: 22, reverbWidth: 1
    })
  },
  {
    id: 'factory-oberheim-wall',
    name: 'Oberheim Wall',
    category: 'Pads & Strings',
    description: 'OB-X brass wall — wide detuned swell with a slow saturated filter push.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.25, decay: 0.6, sustain: 0.9, release: 1.4,
      useFilter: true, filterCutoff: 950, filterResonance: 1.1, filterMode: 0,
      velocityCurve: -0.15,
      lfo2Shape: 0, lfo2Rate: 0.3,
      unisonVoices: 3, unisonDetune: 18,
      modAttack: 0.3, modDecay: 1.0, modSustain: 0.45, modRelease: 0.8,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.35 },
        { src: SRC.LFO2, dst: DST.DETUNE, depth: 0.25 },
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.2 }
      ],
      distortion: 0.2,
      reverbEnabled: true, reverbMode: 'hall', reverbMix: 0.3,
      reverbSize: 0.72, reverbDecay: 0.6, reverbTone: 0.5,
      reverbPreDelay: 24, reverbWidth: 0.95
    })
  },
  {
    id: 'factory-ppg-ghost-choir',
    name: 'PPG Ghost Choir',
    category: 'Pads & Strings',
    description: 'PPG-style spectral pad — FM overtones slowly morph like a scanned wavetable.',
    factory: true,
    waveformType: 'Triangle',
    audioParams: patch({
      attack: 1.1, decay: 1.2, sustain: 0.75, release: 2.6,
      useFM: true, fmRatio: 2, fmIndex: 2.2,
      useFilter: true, filterCutoff: 3800, filterResonance: 1.0, filterMode: 0,
      lfo1Shape: 0, lfoRate: 0.15,
      lfo2Shape: 0, lfo2Rate: 0.21,
      unisonVoices: 3, unisonDetune: 12,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.FM, depth: 0.25 },        // wavetable-like sweep
        { src: SRC.LFO2, dst: DST.AMP, depth: 0.06 },
        { src: SRC.KEY, dst: DST.FM, depth: -0.2 }
      ],
      reverbEnabled: true, reverbMode: 'ambient', reverbMix: 0.44,
      reverbSize: 0.86, reverbDecay: 0.78, reverbTone: 0.48,
      reverbPreDelay: 34, reverbWidth: 1
    })
  },
  {
    id: 'factory-fairlight-air',
    name: 'Fairlight Air',
    category: 'Pads & Strings',
    description: 'Breathy Fairlight-style vox pad — a bandpassed sigh that never quite lands.',
    factory: true,
    waveformType: 'Triangle',
    audioParams: patch({
      attack: 0.9, decay: 1, sustain: 0.7, release: 2.2,
      useFilter: true, filterCutoff: 1900, filterResonance: 1.7, filterMode: 2,
      velocityCurve: -0.4,
      lfo1Shape: 0, lfoRate: 0.17,
      lfo2Shape: 0, lfo2Rate: 5.4,
      unisonVoices: 2, unisonDetune: 10,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.CUTOFF, depth: 0.3 },
        { src: SRC.LFO2, dst: DST.PITCH, depth: 0.01 }
      ],
      reverbEnabled: true, reverbMode: 'ambient', reverbMix: 0.48,
      reverbSize: 0.88, reverbDecay: 0.8, reverbTone: 0.5,
      reverbPreDelay: 36, reverbWidth: 1
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

  {
    id: 'factory-juno-punch',
    name: 'Juno Punch',
    category: 'Bass',
    description: 'Juno-106 square bass — tight filter knock, sits right in the pocket.',
    factory: true,
    waveformType: 'Square',
    audioParams: patch({
      attack: 0.005, decay: 0.28, sustain: 0.5, release: 0.18,
      useFilter: true, filterCutoff: 800, filterResonance: 1.6, filterMode: 0,
      velocityCurve: 0.15,
      modAttack: 0.005, modDecay: 0.12, modSustain: 0.05, modRelease: 0.12,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.45 },
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.35 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.15 }
      ],
      distortion: 0.18
    })
  },
  {
    id: 'factory-trap-door-808',
    name: 'Trap Door 808',
    category: 'Bass',
    description: 'Modern trap 808 — long glide between notes, saturated bloom, pitch knock on the attack.',
    factory: true,
    waveformType: 'Sine',
    audioParams: patch({
      attack: 0.005, decay: 0.8, sustain: 0.4, release: 0.35,
      useFilter: true, filterCutoff: 1800, filterResonance: 0.7, filterMode: 0,
      glideTime: 0.14, velocityCurve: -0.3,
      modAttack: 0.005, modDecay: 0.07, modSustain: 0, modRelease: 0.08,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.PITCH, depth: 0.3 },  // ~3.6 st drop
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.2 }
      ],
      distortion: 0.4
    })
  },
  {
    id: 'factory-rage-growl',
    name: 'Rage Growl',
    category: 'Bass',
    description: 'Rage-style growl bass — wide saw cluster ground through a dark wobbling lowpass.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.005, decay: 0.3, sustain: 0.85, release: 0.2,
      useFilter: true, filterCutoff: 420, filterResonance: 2.6, filterMode: 0,
      velocityCurve: 0.1,
      lfo1Shape: 5, lfoRate: 7,
      lfo2Shape: 0, lfo2Rate: 0.4,
      unisonVoices: 3, unisonDetune: 38,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.CUTOFF, depth: 0.2 },
        { src: SRC.LFO2, dst: DST.DETUNE, depth: 0.4 },
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.25 }
      ],
      distortion: 0.6,
      reverbEnabled: true, reverbMode: 'room', reverbMix: 0.1,
      reverbSize: 0.3, reverbDecay: 0.25, reverbTone: 0.4,
      reverbPreDelay: 6, reverbWidth: 0.7
    })
  },
  {
    id: 'factory-2600-acid-wire',
    name: '2600 Acid Wire',
    category: 'Bass',
    description: 'ARP 2600 acid wire — squelching resonance, short glide, 1/16 echoes trailing the line.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.005, decay: 0.18, sustain: 0.25, release: 0.15,
      useFilter: true, filterCutoff: 700, filterResonance: 4.2, filterMode: 0,
      glideTime: 0.08, velocityCurve: 0.2,
      modAttack: 0.005, modDecay: 0.22, modSustain: 0.05, modRelease: 0.15,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.55 },
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.35 }
      ],
      distortion: 0.26,
      delayEnabled: true, delayMode: 'digital', delaySync: true, delayDivision: '1/16',
      delayFeedback: 0.32, delayMix: 0.15, delayStereo: 0.8, delayDucking: 0.35
    })
  },
  {
    id: 'factory-taurus-fog',
    name: 'Taurus Fog',
    category: 'Bass',
    description: 'Moog Taurus-style pedal bass — subterranean drone weight with a slow saturated push.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.04, decay: 0.5, sustain: 0.9, release: 0.6,
      useFilter: true, filterCutoff: 380, filterResonance: 1.0, filterMode: 0,
      velocityCurve: -0.2,
      unisonVoices: 2, unisonDetune: 6,
      modAttack: 0.08, modDecay: 0.7, modSustain: 0.4, modRelease: 0.5,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.2 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.15 }
      ],
      distortion: 0.3,
      reverbEnabled: true, reverbMode: 'room', reverbMix: 0.12,
      reverbSize: 0.4, reverbDecay: 0.35, reverbTone: 0.4,
      reverbPreDelay: 10, reverbWidth: 0.7
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

  {
    id: 'factory-prophet-glass',
    name: 'Prophet Glass',
    category: 'Keys & Bells',
    description: 'Prophet-5 glass keys — chorused triangle comping tone that brightens under the fingers.',
    factory: true,
    waveformType: 'Triangle',
    audioParams: patch({
      attack: 0.005, decay: 1.6, sustain: 0.3, release: 0.8,
      useFilter: true, filterCutoff: 4600, filterResonance: 1.0, filterMode: 0,
      velocityCurve: 0.05,
      unisonVoices: 2, unisonDetune: 7,
      modAttack: 0.005, modDecay: 0.5, modSustain: 0, modRelease: 0.4,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.3 },
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.4 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.2 }
      ],
      reverbEnabled: true, reverbMode: 'plate', reverbMix: 0.26,
      reverbSize: 0.6, reverbDecay: 0.5, reverbTone: 0.6,
      reverbPreDelay: 18, reverbWidth: 0.9
    })
  },
  {
    id: 'factory-fairlight-bell-choir',
    name: 'Fairlight Bell Choir',
    category: 'Keys & Bells',
    description: 'Fairlight-style bell choir — inharmonic strike blooming into a huge hall.',
    factory: true,
    waveformType: 'Sine',
    audioParams: patch({
      attack: 0.005, decay: 2.8, sustain: 0, release: 2.0,
      useFM: true, fmRatio: 5, fmIndex: 5,
      velocityCurve: 0.15,
      unisonVoices: 2, unisonDetune: 5,
      modAttack: 0.005, modDecay: 1.2, modSustain: 0, modRelease: 0.9,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.FM, depth: 0.5 },
        { src: SRC.VEL, dst: DST.FM, depth: 0.3 },
        { src: SRC.KEY, dst: DST.FM, depth: -0.35 }
      ],
      reverbEnabled: true, reverbMode: 'hall', reverbMix: 0.34,
      reverbSize: 0.8, reverbDecay: 0.74, reverbTone: 0.58,
      reverbPreDelay: 30, reverbWidth: 1
    })
  },
  {
    id: 'factory-hyperpop-pluck',
    name: 'Hyperpop Pluck',
    category: 'Keys & Bells',
    description: 'Hyperpop square pluck — glassy snap bouncing across a wide ping-pong.',
    factory: true,
    waveformType: 'Square',
    audioParams: patch({
      attack: 0.005, decay: 0.22, sustain: 0, release: 0.3,
      useFilter: true, filterCutoff: 5200, filterResonance: 2.0, filterMode: 0,
      velocityCurve: 0.2,
      unisonVoices: 2, unisonDetune: 16,
      modAttack: 0.005, modDecay: 0.1, modSustain: 0, modRelease: 0.12,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.5 },
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.35 }
      ],
      delayEnabled: true, delayMode: 'ping-pong', delaySync: true, delayDivision: '1/8',
      delayFeedback: 0.45, delayMix: 0.26, delayStereo: 1,
      delayLowCut: 320, delayHighCut: 9500, delayDucking: 0.3,
      reverbEnabled: true, reverbMode: 'plate', reverbMix: 0.16,
      reverbSize: 0.5, reverbDecay: 0.4, reverbTone: 0.65,
      reverbPreDelay: 12, reverbWidth: 1
    })
  },
  {
    id: 'factory-lullaby-ep',
    name: 'Lullaby EP',
    category: 'Keys & Bells',
    description: 'Soft FM electric piano — slow tremolo, warm tine, made for 2am chords.',
    factory: true,
    waveformType: 'Sine',
    audioParams: patch({
      attack: 0.008, decay: 2.2, sustain: 0.25, release: 0.9,
      useFM: true, fmRatio: 1, fmIndex: 1.6,
      velocityCurve: -0.15,
      lfo1Shape: 0, lfoRate: 4.2,
      unisonVoices: 2, unisonDetune: 5,
      modAttack: 0.005, modDecay: 1.0, modSustain: 0, modRelease: 0.6,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.FM, depth: 0.25 },
        { src: SRC.VEL, dst: DST.FM, depth: 0.3 },
        { src: SRC.LFO1, dst: DST.AMP, depth: 0.05 }
      ],
      delayEnabled: true, delayMode: 'digital', delaySync: true, delayDivision: '1/4',
      delayFeedback: 0.24, delayMix: 0.1, delayStereo: 0.55, delayDucking: 0.3,
      reverbEnabled: true, reverbMode: 'room', reverbMix: 0.2,
      reverbSize: 0.5, reverbDecay: 0.45, reverbTone: 0.55,
      reverbPreDelay: 14, reverbWidth: 0.85
    })
  },
  {
    id: 'factory-jupiter-chime',
    name: 'Jupiter Chime',
    category: 'Keys & Bells',
    description: 'Jupiter-8 chime keys — bright metallic strike that mellows as it rings out.',
    factory: true,
    waveformType: 'Triangle',
    audioParams: patch({
      attack: 0.005, decay: 1.8, sustain: 0.1, release: 1.2,
      useFM: true, fmRatio: 4, fmIndex: 2.8,
      velocityCurve: 0.1,
      modAttack: 0.005, modDecay: 0.7, modSustain: 0, modRelease: 0.5,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.FM, depth: 0.4 },
        { src: SRC.VEL, dst: DST.FM, depth: 0.25 },
        { src: SRC.KEY, dst: DST.FM, depth: -0.25 }
      ],
      delayEnabled: true, delayMode: 'digital', delaySync: true, delayDivision: '1/4',
      delayFeedback: 0.3, delayMix: 0.16, delayStereo: 0.7, delayDucking: 0.3,
      reverbEnabled: true, reverbMode: 'plate', reverbMix: 0.28,
      reverbSize: 0.64, reverbDecay: 0.6, reverbTone: 0.6,
      reverbPreDelay: 20, reverbWidth: 1
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
  },
  {
    id: 'factory-trap-alarm',
    name: 'Trap Alarm',
    category: 'Motion & Texture',
    description: 'Trap alarm stab — squealing square hits with a strobing filter, tight 1/16 slap.',
    factory: true,
    waveformType: 'Square',
    audioParams: patch({
      attack: 0.005, decay: 0.15, sustain: 0.6, release: 0.12,
      useFilter: true, filterCutoff: 2600, filterResonance: 3.2, filterMode: 0,
      velocityCurve: 0.25,
      lfo1Shape: 2, lfoRate: 8.2,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.CUTOFF, depth: 0.3 },
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.3 }
      ],
      distortion: 0.3,
      delayEnabled: true, delayMode: 'digital', delaySync: true, delayDivision: '1/16',
      delayFeedback: 0.22, delayMix: 0.12, delayStereo: 0.8, delayDucking: 0.4
    })
  },
  {
    id: 'factory-hyperpop-shimmer',
    name: 'Hyperpop Shimmer',
    category: 'Motion & Texture',
    description: 'Hyperpop shimmer bed — fluttering tremolo over four bright detuned voices.',
    factory: true,
    waveformType: 'Triangle',
    audioParams: patch({
      attack: 0.06, decay: 0.4, sustain: 0.75, release: 0.8,
      useFilter: true, filterCutoff: 8500, filterResonance: 0.8, filterMode: 0,
      lfo1Shape: 0, lfoRate: 6.2,
      lfo2Shape: 0, lfo2Rate: 0.3,
      unisonVoices: 4, unisonDetune: 22,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.AMP, depth: 0.14 },
        { src: SRC.LFO2, dst: DST.DETUNE, depth: 0.3 },
        { src: SRC.VEL, dst: DST.CUTOFF, depth: 0.15 }
      ],
      delayEnabled: true, delayMode: 'ping-pong', delaySync: true, delayDivision: '1/8',
      delayFeedback: 0.5, delayMix: 0.3, delayStereo: 1,
      delayLowCut: 300, delayHighCut: 10000, delayDucking: 0.25,
      reverbEnabled: true, reverbMode: 'plate', reverbMix: 0.24,
      reverbSize: 0.62, reverbDecay: 0.55, reverbTone: 0.62,
      reverbPreDelay: 16, reverbWidth: 1
    })
  },
  {
    id: 'factory-ribbon-fall',
    name: 'Ribbon Fall',
    category: 'Motion & Texture',
    description: 'CS-80 ribbon gesture — long glide swoops with a slow falling drift, tape echoes into fog.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.15, decay: 0.5, sustain: 0.8, release: 1.6,
      useFilter: true, filterCutoff: 1500, filterResonance: 1.8, filterMode: 0,
      glideTime: 0.6, velocityCurve: -0.2,
      lfo1Shape: 4, lfoRate: 0.12,
      lfo2Shape: 0, lfo2Rate: 0.2,
      unisonVoices: 2, unisonDetune: 9,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.PITCH, depth: 0.04 },     // slow half-step fall
        { src: SRC.LFO2, dst: DST.CUTOFF, depth: 0.2 },
        { src: SRC.WHEEL, dst: DST.CUTOFF, depth: 0.25 }
      ],
      delayEnabled: true, delayMode: 'tape', delaySync: true, delayDivision: '1/4.',
      delayFeedback: 0.45, delayMix: 0.2, delayStereo: 0.65,
      delayLowCut: 200, delayHighCut: 4600, delayDucking: 0.25,
      delayAge: 0.6, delayMotion: 0.55,
      reverbEnabled: true, reverbMode: 'ambient', reverbMix: 0.4,
      reverbSize: 0.84, reverbDecay: 0.78, reverbTone: 0.46,
      reverbPreDelay: 32, reverbWidth: 1
    })
  },
  {
    id: 'factory-voltage-gulls',
    name: 'Voltage Gulls',
    category: 'Motion & Texture',
    description: '2600-style seagulls — falling bandpass cries circling in a huge space.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.3, decay: 0.5, sustain: 0.7, release: 1.2,
      useFilter: true, filterCutoff: 2400, filterResonance: 3.4, filterMode: 2,
      lfo1Shape: 4, lfoRate: 3.4,
      lfo2Shape: 0, lfo2Rate: 0.5,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.PITCH, depth: 0.08 },     // ~1 st falling cries
        { src: SRC.LFO2, dst: DST.CUTOFF, depth: 0.3 }
      ],
      reverbEnabled: true, reverbMode: 'ambient', reverbMix: 0.42,
      reverbSize: 0.88, reverbDecay: 0.8, reverbTone: 0.5,
      reverbPreDelay: 30, reverbWidth: 1
    })
  },
  {
    id: 'factory-cathedral-of-wires',
    name: 'Cathedral of Wires',
    category: 'Motion & Texture',
    description: 'Vast dark drone — four wide saws under a tidal filter, saturated into an endless ambient wash.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 1.8, decay: 1.5, sustain: 0.9, release: 3.8,
      useFilter: true, filterCutoff: 640, filterResonance: 1.6, filterMode: 0,
      lfo1Shape: 0, lfoRate: 0.09,
      lfo2Shape: 1, lfo2Rate: 0.14,
      unisonVoices: 4, unisonDetune: 30,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.CUTOFF, depth: 0.35 },
        { src: SRC.LFO2, dst: DST.DETUNE, depth: 0.4 }
      ],
      distortion: 0.34,
      reverbEnabled: true, reverbMode: 'ambient', reverbMix: 0.5,
      reverbSize: 0.9, reverbDecay: 0.85, reverbTone: 0.42,
      reverbPreDelay: 40, reverbWidth: 1
    })
  }
];
