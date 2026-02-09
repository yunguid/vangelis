/**
 * Built-in instrument sample sets for selected MIDI pieces.
 * Loads audio buffers and maps MIDI instrument families to samples.
 */

import { audioEngine } from './audioEngine.js';

const NOTE_OFFSETS = {
  C: -9,
  'C#': -8,
  D: -7,
  'D#': -6,
  E: -5,
  F: -4,
  'F#': -3,
  G: -2,
  'G#': -1,
  A: 0,
  'A#': 1,
  B: 2
};

const BUILT_IN_SOUNDSETS = {
  'rachmaninoff-orchestral-lite': {
    id: 'rachmaninoff-orchestral-lite',
    name: 'Rachmaninoff Concerto No. 2 (Chamber Samples)',
    instruments: [
      {
        id: 'piano',
        label: 'Piano',
        families: ['piano'],
        sampleUrl: '/samples/rachmaninoff/piano-c4.wav',
        baseNote: 'C4'
      },
      {
        id: 'flute',
        label: 'Flute',
        families: ['pipe'],
        sampleUrl: '/samples/rachmaninoff/flute-c5.wav',
        baseNote: 'C5'
      },
      {
        id: 'violin',
        label: 'Violin',
        families: ['strings', 'ensemble'],
        sampleUrl: '/samples/rachmaninoff/violin-g3.wav',
        baseNote: 'G3',
        minMidi: 60
      },
      {
        id: 'cello',
        label: 'Cello',
        families: ['strings', 'ensemble'],
        sampleUrl: '/samples/rachmaninoff/cello-c2.wav',
        baseNote: 'C2',
        maxMidi: 59
      }
    ]
  }
};

const soundSetCache = new Map();

function noteIdToFrequency(noteId) {
  const match = /^([A-G]#?)(-?\d+)$/.exec(noteId);
  if (!match) return null;
  const [, name, octaveRaw] = match;
  const octave = Number.parseInt(octaveRaw, 10);
  const offset = NOTE_OFFSETS[name];
  if (Number.isNaN(octave) || offset === undefined) return null;

  const semitoneOffset = (octave - 4) * 12 + offset;
  return 440 * Math.pow(2, semitoneOffset / 12);
}

function buildInstrumentLookup(instruments) {
  const byFamily = new Map();
  const byName = new Map();

  instruments.forEach((instrument) => {
    (instrument.families || []).forEach((family) => {
      if (!byFamily.has(family)) {
        byFamily.set(family, []);
      }
      byFamily.get(family).push(instrument);
    });

    (instrument.names || []).forEach((name) => {
      byName.set(name, instrument);
    });
  });

  return { byFamily, byName };
}

function pickInstrumentForNote(lookup, note) {
  if (!lookup) return null;

  if (note.instrumentName && lookup.byName.has(note.instrumentName)) {
    return lookup.byName.get(note.instrumentName);
  }

  if (note.instrumentFamily && lookup.byFamily.has(note.instrumentFamily)) {
    const candidates = lookup.byFamily.get(note.instrumentFamily);
    if (!candidates?.length) return null;

    if (typeof note.midi === 'number') {
      const ranged = candidates.find((instrument) => {
        const aboveMin = instrument.minMidi == null || note.midi >= instrument.minMidi;
        const belowMax = instrument.maxMidi == null || note.midi <= instrument.maxMidi;
        return aboveMin && belowMax;
      });
      if (ranged) return ranged;
    }

    return candidates[0];
  }

  return null;
}

async function loadInstrumentBuffer(ctx, instrument) {
  const response = await fetch(instrument.sampleUrl);
  if (!response.ok) {
    throw new Error(`Failed to load sample ${instrument.sampleUrl}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  const baseFrequency = instrument.baseFrequency || noteIdToFrequency(instrument.baseNote || 'C4');

  return {
    ...instrument,
    buffer,
    baseFrequency
  };
}

/**
 * Get the sound set definition for display purposes.
 * @param {string} id
 */
export function getBuiltInSoundSet(id) {
  return BUILT_IN_SOUNDSETS[id] || null;
}

/**
 * Load and cache a built-in sound set.
 * @param {string} id
 * @returns {Promise<{id: string, name: string, instruments: Array, pickInstrument: function}>}
 */
export async function ensureSoundSetLoaded(id) {
  if (!id) return null;
  if (soundSetCache.has(id)) return soundSetCache.get(id);

  const soundSet = BUILT_IN_SOUNDSETS[id];
  if (!soundSet) return null;

  const ctx = await audioEngine.ensureAudioContext();
  const loadedInstruments = await Promise.all(
    soundSet.instruments.map((instrument) => loadInstrumentBuffer(ctx, instrument))
  );

  const lookup = buildInstrumentLookup(loadedInstruments);

  const loaded = {
    id: soundSet.id,
    name: soundSet.name,
    instruments: loadedInstruments,
    pickInstrument: (note) => pickInstrumentForNote(lookup, note)
  };

  soundSetCache.set(id, loaded);
  return loaded;
}
