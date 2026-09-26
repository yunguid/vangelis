/**
 * The sounds of "Blade Runner Blues" (data/bladeRunnerBlues.js), to play from the keys: the
 * replica's own patches, with what the keys need that each note of the piece gets from the
 * record's curves (a swell, a scoop, a vibrato). They have their own band on the sound dial.
 *
 * The CS-80 and the pad are two synth layers per key (`layers`: a sine and a sawtooth started
 * on the same sample, so the saw's fundamental adds to the sine's), which the engine plays as
 * key layers; `audioParams` is the sound as the Sound tab shows it and sets the room, and an
 * edit there reaches every layer. The drone and the boom are single patches.
 */
import { CLEAN_PATCH, DST, SRC } from '../utils/factoryPresets.js';
import { BRB_FX, BRB_PARTS } from './bladeRunnerBlues.js';

const patch = (overrides) => ({ ...CLEAN_PATCH, ...overrides, ...BRB_FX });

// A played note of the record's CS-80 (its 191 first-found notes, per-note medians): within
// 3 dB of its peak in ~45 ms, falling 8 dB by 0.5 s and 11 dB by 1 s; a scoop up from ~25
// cents flat that settles in ~50 ms; a slow 2.4 Hz vibrato a few cents deep.
const CS80_NOTE = {
  attack: 0.08, decay: 0.8, sustain: 0.28, release: 0.9,
  lfo1Shape: 0, lfoRate: 2.4,
  modAttack: 0.005, modDecay: 0.292, modSustain: 0, modRelease: 0.3
};
const SCOOP = { src: SRC.MOD_ENV, dst: DST.PITCH, depth: -20 / 1200 };
const VIBRATO = { src: SRC.LFO1, dst: DST.PITCH, depth: 5 / 1200 };
// The pad has no swell of its own from the keys, so it rises over 0.4 s (the record's pad
// notes reach their first peak in ~0.5 s) and lets go over 1.2 s.
const PAD_NOTE = { attack: 0.4, decay: 0.3, sustain: 1, release: 1.2 };

const [cs80Sine, cs80Saw] = BRB_PARTS.cs80.layers;
const [padSine, padSaw] = BRB_PARTS.pad.layers;
const withRoutes = (params, routes) => ({ ...params, modRoutes: [...(params.modRoutes || []), ...routes] });

export const BLADE_RUNNER_SOUNDS = [
  {
    id: 'brb-cs80-blues',
    name: 'CS-80 Blues',
    category: 'Blade Runner',
    description: 'The lead of Blade Runner Blues, as the CS-80 made it: a sine and a sawtooth per key, a scoop into every note, a slow vibrato.',
    waveformType: 'Sawtooth',
    audioParams: patch({ ...CS80_NOTE, modRoutes: [SCOOP, VIBRATO] }),
    layers: [
      { waveformType: 'sine', gain: 0.4235, audioParams: patch(withRoutes({ ...cs80Sine.params, ...CS80_NOTE }, [SCOOP, VIBRATO])) },
      { waveformType: 'sawtooth', gain: 0.77, audioParams: patch(withRoutes({ ...cs80Saw.params, ...CS80_NOTE }, [SCOOP, VIBRATO])) }
    ]
  },
  {
    id: 'brb-blues-pad',
    name: 'Blues Pad',
    category: 'Blade Runner',
    description: 'The pad under Blade Runner Blues: a sine beside a sawtooth low-passed at 5 kHz, two voices 3 cents apart.',
    waveformType: 'Sine',
    audioParams: patch({ ...PAD_NOTE, unisonVoices: 2, unisonDetune: 3 }),
    layers: [
      { waveformType: 'sine', gain: 0.58, audioParams: patch({ ...padSine.params, ...PAD_NOTE }) },
      { waveformType: 'sawtooth', gain: 0.735, audioParams: patch({ ...padSaw.params, ...PAD_NOTE }) }
    ]
  },
  {
    id: 'brb-offworld-drone',
    name: 'Offworld Drone',
    category: 'Blade Runner',
    description: 'The low bed under Blade Runner Blues: four sines a quarter-tone apart, beating like the record\'s. Hold F#1.',
    waveformType: 'Sine',
    audioParams: patch({ attack: 2, decay: 0.3, sustain: 1, release: 3, unisonVoices: 4, unisonDetune: 46 })
  },
  {
    id: 'brb-boom',
    name: 'Blade Runner Boom',
    category: 'Blade Runner',
    description: 'The booms of Blade Runner Blues: a low note struck with no swell, a fundamental and its octave, dying away.',
    waveformType: 'Sine',
    audioParams: patch({ attack: 0.004, decay: 5, sustain: 0, release: 0.15, useFM: true, fmRatio: 1, fmIndex: 0.75 })
  }
];
