/**
 * Patch Lab — an original bank exploring broad production techniques:
 * widescreen analog scoring, orchestral-pop arranging, modern beat-lab
 * sound design, and experimental synthesis. Every patch is authored from
 * scratch against this engine's real controls (no imported factory banks,
 * no recreated commercial presets) and spreads over the same fully-specified
 * CLEAN_PATCH slate as the factory bank, so switching is deterministic.
 *
 * Depth scaling reference (same as factory): pitch ±12 st, cutoff ±4 oct,
 * amp ±100%, FM ±10 rad, detune ±50 ¢ at |depth| = 1.
 * @module utils/patchLabPresets
 */

import { CLEAN_PATCH, SRC, DST } from './factoryPresets.js';

const patch = (overrides) => ({ ...CLEAN_PATCH, ...overrides });

export const PATCH_LAB_CATEGORIES = Object.freeze([
  'Cinema Analog', 'Orchestral Pop', 'Beat Lab', 'Experimental'
]);

export const PATCH_LAB_PRESETS = [
  // ── Cinema Analog — widescreen scoring textures ──────────────────────
  {
    id: 'lab-widescreen-swell',
    name: 'Widescreen Swell',
    category: 'Cinema Analog',
    description: 'Slow-blooming analog wall — unison saws swell into a huge hall.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.85, decay: 0.5, sustain: 0.85, release: 1.6,
      useFilter: true, filterCutoff: 900, filterResonance: 1.2, filterMode: 0,
      unisonVoices: 3, unisonDetune: 14,
      modAttack: 0.8, modDecay: 0.9, modSustain: 0.7, modRelease: 0.9,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.5 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.2 },
        { src: SRC.WHEEL, dst: DST.CUTOFF, depth: 0.3 }
      ],
      reverbEnabled: true, reverbMode: 'hall', reverbMix: 0.34,
      reverbSize: 0.78, reverbDecay: 0.66, reverbTone: 0.5,
      reverbPreDelay: 26, reverbWidth: 0.92
    })
  },
  {
    id: 'lab-ribbon-horizon',
    name: 'Ribbon Horizon',
    category: 'Cinema Analog',
    description: 'Gliding solo voice with gentle FM breath and dotted tape echo.',
    factory: true,
    waveformType: 'Sine',
    audioParams: patch({
      attack: 0.06, decay: 0.4, sustain: 0.78, release: 0.9,
      useFM: true, fmRatio: 2, fmIndex: 3,
      glideTime: 0.22, velocityCurve: -0.2,
      lfo1Shape: 0, lfoRate: 4.6,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.PITCH, depth: 0.025 },
        { src: SRC.WHEEL, dst: DST.FM, depth: 0.3 },
        { src: SRC.VEL, dst: DST.AMP, depth: 0.2 }
      ],
      delayEnabled: true, delayMode: 'tape', delaySync: true, delayDivision: '1/4.',
      delayFeedback: 0.4, delayMix: 0.24, delayStereo: 0.75,
      delayLowCut: 160, delayHighCut: 5200, delayDucking: 0.24, delayAge: 0.45, delayMotion: 0.4,
      reverbEnabled: true, reverbMode: 'plate', reverbMix: 0.22,
      reverbSize: 0.6, reverbDecay: 0.55, reverbTone: 0.48
    })
  },
  {
    id: 'lab-night-choir',
    name: 'Night Choir',
    category: 'Cinema Analog',
    description: 'Vocal-ish triangle stack drifting in an ambient chamber.',
    factory: true,
    waveformType: 'Triangle',
    audioParams: patch({
      attack: 0.45, decay: 0.6, sustain: 0.8, release: 1.4,
      useFilter: true, filterCutoff: 1500, filterResonance: 2.2, filterMode: 0,
      unisonVoices: 4, unisonDetune: 8,
      lfo1Shape: 1, lfoRate: 0.4,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.CUTOFF, depth: 0.18 },
        { src: SRC.LFO1, dst: DST.AMP, depth: 0.08 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.22 }
      ],
      reverbEnabled: true, reverbMode: 'ambient', reverbMix: 0.36,
      reverbSize: 0.7, reverbDecay: 0.6, reverbTone: 0.42,
      reverbPreDelay: 30, reverbWidth: 0.95
    })
  },

  // ── Orchestral Pop — string machines, counterpoint, gated-era air ────
  {
    id: 'lab-velvet-strings',
    name: 'Velvet Strings',
    category: 'Orchestral Pop',
    description: 'String-machine ensemble — detune shimmer over a soft room.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.35, decay: 0.5, sustain: 0.82, release: 1.1,
      useFilter: true, filterCutoff: 2600, filterResonance: 1.2, filterMode: 0,
      unisonVoices: 4, unisonDetune: 12,
      lfo1Shape: 0, lfoRate: 0.8,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.DETUNE, depth: 0.4 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.22 },
        { src: SRC.VEL, dst: DST.AMP, depth: 0.18 }
      ],
      reverbEnabled: true, reverbMode: 'room', reverbMix: 0.26,
      reverbSize: 0.5, reverbDecay: 0.48, reverbTone: 0.52
    })
  },
  {
    id: 'lab-counterpoint-bells',
    name: 'Counterpoint Bells',
    category: 'Orchestral Pop',
    description: 'Clear FM bell for inner voices — velocity opens the strike tone.',
    factory: true,
    waveformType: 'Square',
    audioParams: patch({
      attack: 0.005, decay: 0.5, sustain: 0.32, release: 0.7,
      useFM: true, fmRatio: 3.5, fmIndex: 6,
      useFilter: true, filterCutoff: 6200, filterResonance: 0.9, filterMode: 0,
      velocityCurve: 0.2,
      modRoutes: [
        { src: SRC.VEL, dst: DST.FM, depth: 0.3 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.2 }
      ],
      reverbEnabled: true, reverbMode: 'plate', reverbMix: 0.2,
      reverbSize: 0.42, reverbDecay: 0.4, reverbTone: 0.6
    })
  },
  {
    id: 'lab-gated-air',
    name: 'Gated Air',
    category: 'Orchestral Pop',
    description: 'Eighties gated-room chords — the tail ducks shut behind every hit.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.008, decay: 0.3, sustain: 0.55, release: 0.22,
      useFilter: true, filterCutoff: 3400, filterResonance: 1.6, filterMode: 0,
      unisonVoices: 2, unisonDetune: 10,
      modAttack: 0.01, modDecay: 0.18, modSustain: 0.2, modRelease: 0.2,
      modRoutes: [
        { src: SRC.MOD_ENV, dst: DST.AMP, depth: 0.35 },
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.4 }
      ],
      delayEnabled: true, delayMode: 'digital', delaySync: true, delayDivision: '1/16',
      delayFeedback: 0.18, delayMix: 0.14, delayStereo: 0.6,
      delayLowCut: 200, delayHighCut: 6800, delayDucking: 0.5, delayAge: 0.1, delayMotion: 0.15,
      reverbEnabled: true, reverbMode: 'room', reverbMix: 0.3,
      reverbSize: 0.36, reverbDecay: 0.22, reverbTone: 0.62, reverbPreDelay: 8
    })
  },

  // ── Beat Lab — modern hip-hop production techniques ──────────────────
  {
    id: 'lab-concrete-sub',
    name: 'Concrete Sub',
    category: 'Beat Lab',
    description: 'Sliding sub foundation — sine weight with a distorted edge.',
    factory: true,
    waveformType: 'Sine',
    audioParams: patch({
      attack: 0.005, decay: 0.35, sustain: 0.85, release: 0.3,
      glideTime: 0.09, distortion: 0.22, velocityCurve: 0.15,
      modRoutes: [
        { src: SRC.VEL, dst: DST.AMP, depth: 0.2 }
      ]
    })
  },
  {
    id: 'lab-halftime-pluck',
    name: 'Halftime Pluck',
    category: 'Beat Lab',
    description: 'Dark FM pluck spaced by dotted echoes for half-time grids.',
    factory: true,
    waveformType: 'Triangle',
    audioParams: patch({
      attack: 0.005, decay: 0.24, sustain: 0.12, release: 0.4,
      useFM: true, fmRatio: 2, fmIndex: 4,
      useFilter: true, filterCutoff: 3800, filterResonance: 1.8, filterMode: 0,
      velocityCurve: 0.25,
      modRoutes: [
        { src: SRC.VEL, dst: DST.FM, depth: 0.25 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.25 }
      ],
      delayEnabled: true, delayMode: 'tape', delaySync: true, delayDivision: '1/4.',
      delayFeedback: 0.42, delayMix: 0.26, delayStereo: 0.8,
      delayLowCut: 140, delayHighCut: 4800, delayDucking: 0.4, delayAge: 0.35, delayMotion: 0.3
    })
  },
  {
    id: 'lab-drop-siren',
    name: 'Drop Siren',
    category: 'Beat Lab',
    description: 'Slow pitch-bent siren texture for build-ups and drops.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 0.02, decay: 0.4, sustain: 0.9, release: 0.6,
      useFilter: true, filterCutoff: 2200, filterResonance: 2.6, filterMode: 0,
      distortion: 0.35,
      lfo2Shape: 1, lfo2Rate: 0.3,
      modRoutes: [
        { src: SRC.LFO2, dst: DST.PITCH, depth: 0.18 },
        { src: SRC.LFO2, dst: DST.CUTOFF, depth: 0.35 },
        { src: SRC.WHEEL, dst: DST.CUTOFF, depth: 0.3 }
      ],
      delayEnabled: true, delayMode: 'ping-pong', delaySync: true, delayDivision: '1/8',
      delayFeedback: 0.36, delayMix: 0.2, delayStereo: 0.9,
      delayLowCut: 180, delayHighCut: 6400, delayDucking: 0.3, delayAge: 0.2, delayMotion: 0.35
    })
  },

  // ── Experimental — moving systems, inharmonic color ──────────────────
  {
    id: 'lab-sample-hold-weather',
    name: 'Sample Hold Weather',
    category: 'Experimental',
    description: 'Random-step filter weather over a resonant square.',
    factory: true,
    waveformType: 'Square',
    audioParams: patch({
      attack: 0.02, decay: 0.3, sustain: 0.7, release: 0.5,
      useFilter: true, filterCutoff: 1400, filterResonance: 3.4, filterMode: 0,
      lfo1Shape: 5, lfoRate: 6.5,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.CUTOFF, depth: 0.5 },
        { src: SRC.KEY, dst: DST.CUTOFF, depth: 0.15 }
      ],
      delayEnabled: true, delayMode: 'ping-pong', delaySync: true, delayDivision: '1/8',
      delayFeedback: 0.32, delayMix: 0.18, delayStereo: 0.85,
      delayLowCut: 220, delayHighCut: 5600, delayDucking: 0.2, delayAge: 0.15, delayMotion: 0.4
    })
  },
  {
    id: 'lab-clangor',
    name: 'Clangor',
    category: 'Experimental',
    description: 'Inharmonic FM metal — struck-plate partials with a long plate tail.',
    factory: true,
    waveformType: 'Sine',
    audioParams: patch({
      attack: 0.005, decay: 0.9, sustain: 0.18, release: 1.2,
      useFM: true, fmRatio: 7.5, fmIndex: 14,
      velocityCurve: 0.3,
      modRoutes: [
        { src: SRC.VEL, dst: DST.FM, depth: 0.4 },
        { src: SRC.MOD_ENV, dst: DST.PITCH, depth: -0.02 }
      ],
      modAttack: 0.01, modDecay: 0.5, modSustain: 0.1, modRelease: 0.5,
      reverbEnabled: true, reverbMode: 'plate', reverbMix: 0.3,
      reverbSize: 0.66, reverbDecay: 0.72, reverbTone: 0.5, reverbWidth: 0.9
    })
  },
  {
    id: 'lab-glass-drone',
    name: 'Glass Drone',
    category: 'Experimental',
    description: 'Slow-breathing detuned drone that never quite sits still.',
    factory: true,
    waveformType: 'Sawtooth',
    audioParams: patch({
      attack: 1.2, decay: 0.8, sustain: 0.9, release: 2.4,
      useFilter: true, filterCutoff: 1100, filterResonance: 2.0, filterMode: 0,
      unisonVoices: 4, unisonDetune: 22, glideTime: 0.6,
      lfo1Shape: 1, lfoRate: 0.16,
      lfo2Shape: 0, lfo2Rate: 0.07,
      modAttack: 1.5, modDecay: 1.2, modSustain: 0.6, modRelease: 1.5,
      modRoutes: [
        { src: SRC.LFO1, dst: DST.DETUNE, depth: 0.3 },
        { src: SRC.LFO2, dst: DST.CUTOFF, depth: 0.2 },
        { src: SRC.MOD_ENV, dst: DST.CUTOFF, depth: 0.3 }
      ],
      reverbEnabled: true, reverbMode: 'ambient', reverbMix: 0.4,
      reverbSize: 0.8, reverbDecay: 0.7, reverbTone: 0.4,
      reverbPreDelay: 32, reverbWidth: 0.95
    })
  }
];
