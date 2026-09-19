/**
 * Instruments played from recordings instead of the synth: the piano of the
 * landing lullaby and the guitar of "Saudade de Triana", playable from the keys.
 * Each is a sound like any preset (its envelope and room are its audioParams;
 * level and pan stay the listener's) plus `instrument`, the recordings App
 * loads and hands to the audio engine (`audioEngine.setInstrument`).
 */
import { AUDIO_PARAM_DEFAULTS, sanitizeAudioParams } from '../utils/audioParams.js';
import { midiNoteToFrequency } from '../utils/math.js';
import { OPENING_PARAMS, loadOpeningSamples, nearestOpeningSample } from './openingPerformance.js';
import {
  GUITAR_OPEN_STRINGS,
  GUITAR_PARAMS,
  GUITAR_REPEAT_SECONDS,
  loadGuitarTakes
} from './nylonGuitar.js';

const withoutLevel = ({ volume, pan, ...sound }) => sound;

export const SAMPLED_INSTRUMENTS = Object.freeze([
  {
    id: 'instrument-grand-piano',
    name: 'Grand Piano',
    category: 'Acoustic',
    description: 'A recorded concert grand, close and dry, in a long quiet room.',
    instrument: 'opening-piano',
    audioParams: withoutLevel(OPENING_PARAMS)
  },
  {
    id: 'instrument-nylon-guitar',
    name: 'Nylon Guitar',
    category: 'Acoustic',
    description: 'A recorded nylon-string guitar, plucked string by string, in a small room.',
    instrument: 'nylon-guitar',
    // The piece damps each string by hand; under a key the note rings on a little.
    audioParams: withoutLevel(sanitizeAudioParams({ ...AUDIO_PARAM_DEFAULTS, ...GUITAR_PARAMS, release: 0.35 }))
  }
]);

export const findSampledInstrument = (instrument) => (
  SAMPLED_INSTRUMENTS.find((entry) => entry.instrument === instrument) || null
);

const frequencyToMidi = (frequency) => (
  Math.min(127, Math.max(0, Math.round(69 + 12 * Math.log2(frequency / 440))))
);

// The playable guitar has its own recordings (scripts/build_nylon_guitar.mjs
// --keys): one position per whole tone from E2 to A#5, so every key in that
// range is within a semitone of a recording, each at two dynamics and left to
// ring out. The piece's takes are cut to its note lengths and would stop short
// under a held key, and its pianissimo takes are too far down in the chamber's
// noise to hold for seconds. Fretted positions throughout (an open string
// rings differently from its neighbours); the low E has no other.
const GUITAR_KEY_FRETS = '6-0 6-2 6-4 5-1 5-3 5-5 4-2 4-4 3-1 3-3 2-1 2-3 2-5 1-2 1-4 1-6 1-8 1-10 1-12 1-14 1-16 1-18';
export const GUITAR_KEY_TAKES = ['mf', 'ff'];

export const GUITAR_KEY_POSITIONS = GUITAR_KEY_FRETS.split(' ').map((position) => {
  const [string, fret] = position.split('-').map(Number);
  return { name: `s${string}f${fret}`, string, fret, midi: GUITAR_OPEN_STRINGS[string - 1] + fret };
});

/** File name (under samples/nylon-guitar/) of one take of a playable position. */
export const guitarKeyFile = (position, take) => `keys/${position.name}${take}`;

/**
 * The recording a pitch is played from: the nearest one, a fretted note
 * before the open string, then the lower of two equally near.
 */
export const guitarPositionFor = (midi) => GUITAR_KEY_POSITIONS.reduce((best, candidate) => {
  const nearer = Math.abs(candidate.midi - midi) - Math.abs(best.midi - midi)
    || (candidate.fret === 0) - (best.fret === 0)
    || candidate.midi - best.midi;
  return nearer < 0 ? candidate : best;
});

// A key struck hard plays the forte take. The takes are levelled alike (velocity
// sets loudness), so the other one is only a different stroke of the same note.
const GUITAR_LIVE_FORTE = 0.9;

/**
 * The take for one pluck. A position plucked again within moments gets its
 * other take, so the same recording never sounds twice in a row. `lastPluck`
 * is the instrument's memory (position name -> { time, take }).
 */
export function chooseGuitarTake(lastPluck, position, velocity, time) {
  const [preferred, alternate] = velocity >= GUITAR_LIVE_FORTE ? ['ff', 'mf'] : ['mf', 'ff'];
  const last = lastPluck.get(position.name);
  const repeated = last && time - last.time < GUITAR_REPEAT_SECONDS && last.take === preferred;
  const take = repeated ? alternate : preferred;
  lastPluck.set(position.name, { time, take });
  return take;
}

async function loadGrandPiano(context) {
  const samples = await loadOpeningSamples(context);
  return {
    pick(frequency, velocity) {
      const { buffer, baseFrequency } = nearestOpeningSample(samples, frequencyToMidi(frequency));
      return { buffer, baseFrequency, velocity };
    }
  };
}

async function loadNylonGuitar(context) {
  const buffers = await loadGuitarTakes(
    context,
    GUITAR_KEY_POSITIONS.flatMap((position) => GUITAR_KEY_TAKES.map((take) => guitarKeyFile(position, take)))
  );
  const lastPluck = new Map();
  let plucks = 0;
  return {
    pick(frequency, velocity, time) {
      const position = guitarPositionFor(frequencyToMidi(frequency));
      const take = chooseGuitarTake(lastPluck, position, velocity, time);
      // No two plucks land alike: a few cents of drift between them, as in the piece.
      const cents = ((plucks++ * 7919) % 7) - 3;
      return {
        buffer: buffers.get(guitarKeyFile(position, take)),
        baseFrequency: midiNoteToFrequency(position.midi) * 2 ** (cents / 1200),
        velocity: velocity ** 1.25
      };
    }
  };
}

const LOADERS = { 'opening-piano': loadGrandPiano, 'nylon-guitar': loadNylonGuitar };

/**
 * Fetch and decode an instrument's recordings. Resolves to what the audio
 * engine plays notes through: `pick(frequency, velocity, time)` returns the
 * recording for a note ({ buffer, baseFrequency, velocity }).
 */
export function loadSampledInstrument(context, instrument) {
  const load = LOADERS[instrument];
  if (!load) return Promise.reject(new Error(`Unknown sampled instrument: ${instrument}`));
  return load(context);
}
