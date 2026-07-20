/**
 * MIDI file parser for Vangelis
 * Uses @tonejs/midi for parsing .mid files
 * @module utils/midiParser
 */

import classicalCatalog from '../data/classicalCatalog.json';
import { ORIGINAL_CUE_IDS, getOriginalCueName } from '../data/originalCueNames.js';
import { withBase } from './baseUrl.js';

let midiLibraryPromise;
const loadMidiLibrary = () => {
  midiLibraryPromise ||= import('@tonejs/midi');
  return midiLibraryPromise;
};

export const MIDI_SOURCE_CACHE_LIMIT = 4;
const midiSourceCache = new Map();

const fetchMidiSource = (source) => {
  const cached = midiSourceCache.get(source);
  if (cached) return cached;

  const request = fetch(source).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch MIDI: ${response.status} ${response.statusText}`);
    }
    return response.arrayBuffer();
  });
  midiSourceCache.set(source, request);
  if (midiSourceCache.size > MIDI_SOURCE_CACHE_LIMIT) {
    midiSourceCache.delete(midiSourceCache.keys().next().value);
  }
  request.catch(() => {
    if (midiSourceCache.get(source) === request) midiSourceCache.delete(source);
  });
  return request;
};

export const preloadMidiParser = () => loadMidiLibrary();

export const preloadMidiFile = (source) => {
  if (typeof source !== 'string') return Promise.resolve();
  return fetchMidiSource(source).catch(() => undefined);
};

const MIDI_HEADER_BYTES = 14;
const matchesAscii = (bytes, offset, text) => (
  offset + text.length <= bytes.length
  && [...text].every((character, index) => bytes[offset + index] === character.charCodeAt(0))
);

/**
 * Some legacy sequencers place a proprietary SEM1 metadata chunk between the
 * standard MThd header and the first MTrk. The header's track count excludes
 * that chunk, so remove it only when a valid MTrk follows at its declared end.
 */
export function normalizeMidiContainer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (
    bytes.length < MIDI_HEADER_BYTES + 8
    || !matchesAscii(bytes, 0, 'MThd')
    || !matchesAscii(bytes, MIDI_HEADER_BYTES, 'SEM1')
  ) {
    return arrayBuffer;
  }

  const metadataLength = new DataView(arrayBuffer).getUint32(MIDI_HEADER_BYTES + 4, false);
  const firstTrackOffset = MIDI_HEADER_BYTES + 8 + metadataLength;
  if (!matchesAscii(bytes, firstTrackOffset, 'MTrk')) {
    return arrayBuffer;
  }

  const normalized = new Uint8Array(MIDI_HEADER_BYTES + bytes.length - firstTrackOffset);
  normalized.set(bytes.subarray(0, MIDI_HEADER_BYTES));
  normalized.set(bytes.subarray(firstTrackOffset), MIDI_HEADER_BYTES);
  return normalized.buffer;
}

/**
 * @typedef {Object} MidiNote
 * @property {number} midi - MIDI note number (0-127)
 * @property {number} time - Start time in seconds
 * @property {number} duration - Duration in seconds
 * @property {number} velocity - Velocity (0-1)
 * @property {string} [instrumentFamily] - GM instrument family (e.g., 'piano', 'strings')
 * @property {string} [instrumentName] - Instrument name (e.g., 'acoustic grand piano')
 * @property {number} [channel] - MIDI channel number (0-15)
 */

/**
 * @typedef {Object} ParsedMidi
 * @property {string} name - MIDI file name
 * @property {number} duration - Total duration in seconds
 * @property {number} bpm - Tempo in beats per minute
 * @property {{numerator: number, denominator: number}} timeSignature - Time signature
 * @property {MidiNote[]} notes - All notes sorted by start time
 */

/**
 * @typedef {Object} MidiFileInfo
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} path - Path to MIDI file
 * @property {string} [composer] - Composer name, if known
 * @property {string} [sourceUrl] - Optional source URL for MIDI file metadata
 */

/**
 * Parse a MIDI file from a File object or URL
 * @param {File|string} source - File object or URL to MIDI file
 * @returns {Promise<ParsedMidi>} Parsed MIDI data with notes, tempo, and duration
 * @throws {Error} If file cannot be parsed
 * @example
 * // Parse from URL
 * const midi = await parseMidiFile('/midi/bach-prelude.mid');
 * console.log(midi.notes.length, 'notes');
 *
 * // Parse from File object
 * const file = document.querySelector('input[type="file"]').files[0];
 * const midi = await parseMidiFile(file);
 */
export async function parseMidiFile(source) {
  const performanceProbe = typeof window !== 'undefined'
    ? window.__vangelisPerf
    : null;
  const bufferStart = performanceProbe && typeof performance !== 'undefined'
    ? performance.now()
    : null;
  const libraryStart = bufferStart === null ? null : performance.now();
  const bufferPromise = source instanceof File
    ? source.arrayBuffer()
    : fetchMidiSource(source);
  const libraryPromise = loadMidiLibrary();

  if (bufferStart !== null) {
    bufferPromise.then(() => {
      performanceProbe?.recordInteraction?.(
        'midi.file.read',
        performance.now() - bufferStart,
        { source: source instanceof File ? 'upload' : 'built-in' }
      );
    }).catch(() => {});
    libraryPromise.then(() => {
      performanceProbe?.recordInteraction?.(
        'midi.parser.module-ready',
        performance.now() - libraryStart
      );
    }).catch(() => {});
  }

  const [arrayBuffer, { Midi }] = await Promise.all([bufferPromise, libraryPromise]);
  const decodeStart = bufferStart === null ? null : performance.now();
  const midi = new Midi(normalizeMidiContainer(arrayBuffer));
  if (decodeStart !== null) {
    performanceProbe?.recordInteraction?.(
      'midi.parser.decode',
      performance.now() - decodeStart,
      { tracks: midi.tracks.length }
    );
  }

  const flattenStart = bufferStart === null ? null : performance.now();
  const notes = flattenTracks(midi.tracks);
  if (flattenStart !== null) {
    performanceProbe?.recordInteraction?.(
      'midi.parser.flatten',
      performance.now() - flattenStart,
      { tracks: midi.tracks.length, notes: notes.length }
    );
  }

  return {
    name: midi.name || 'Untitled',
    duration: midi.duration,
    bpm: midi.header.tempos[0]?.bpm || 120,
    timeSignature: normalizeTimeSignature(midi.header.timeSignatures[0]),
    notes
  };
}

function normalizeTimeSignature(timeSignatureEvent) {
  if (timeSignatureEvent?.numerator && timeSignatureEvent?.denominator) {
    return {
      numerator: timeSignatureEvent.numerator,
      denominator: timeSignatureEvent.denominator
    };
  }

  const signature = Array.isArray(timeSignatureEvent?.timeSignature)
    ? timeSignatureEvent.timeSignature
    : null;

  if (signature?.length >= 2) {
    return {
      numerator: signature[0],
      denominator: signature[1]
    };
  }

  return { numerator: 4, denominator: 4 };
}

/**
 * Flatten all MIDI tracks into a single sorted note array
 * Merges notes from all tracks and sorts by start time
 * Preserves instrument information from each track for waveform mapping
 * @param {Array} tracks - Array of MIDI tracks from @tonejs/midi
 * @returns {MidiNote[]} Flattened and sorted notes with instrument info
 * @private
 */
function flattenTracks(tracks) {
  return tracks
    .flatMap(track => {
      const instrumentFamily = track.instrument?.family || null;
      const instrumentName = track.instrument?.name || null;
      const channel = track.channel;

      return track.notes.map(note => ({
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity,
        instrumentFamily,
        instrumentName,
        channel
      }));
    })
    .sort((a, b) => a.time - b.time);
}

/**
 * Get list of built-in MIDI files available in the app
 * These files are bundled in /public/midi/
 * @param {string} [base] - Optional base URL override for deployment subpaths
 * @returns {MidiFileInfo[]} Array of MIDI file metadata
 * @example
 * const files = getBuiltInMidiFiles();
 * files.forEach(file => console.log(file.name, 'by', file.composer));
 */
export function getBuiltInMidiFiles(base = import.meta.env.BASE_URL) {
  const toBuiltInPath = (relativePath) => withBase(`midi/${relativePath}`, base);

  // Curated classical catalog (src/data/classicalCatalog.json): entries carry
  // real musicological metadata + provenance, so they display by true title
  // (unlike the code-named originals) and sort featured-first.
  const classicalFiles = classicalCatalog.entries.map((entry) => ({
    id: entry.id,
    name: entry.title,
    path: withBase(entry.file, base),
    composer: entry.composer,
    sourceUrl: entry.provenance?.sourceUrl,
    displayTitle: entry.title,
    catalogLabel: [entry.catalog?.op, entry.catalog?.d].filter(Boolean).join(' · ')
      + (entry.catalog?.no ? ` No. ${entry.catalog.no}` : ''),
    featuredRank: entry.featuredRank ?? null
  }));

  // Original in-house cues, composed for the synth presets — see
  // scripts/generate_original_midis.mjs. They play through whatever preset
  // is currently loaded. Display names come from the shared
  // ../data/originalCueNames.js map (single source of truth, also consumed
  // by the generator script) so the two can't drift.
  const originalFiles = ORIGINAL_CUE_IDS.map((id) => ({
    id,
    name: getOriginalCueName(id),
    path: toBuiltInPath(`originals/${id}.mid`)
  }));

  return [
    ...originalFiles,
    ...classicalFiles,
    {
      id: 'vangelis-to-the-unknown-man',
      name: 'To the Unknown Man',
      path: toBuiltInPath('to-the-unknown-man.mid'),
      composer: 'Vangelis'
    },
    // Rachmaninoff Piano Concerto No. 2
    {
      id: 'rachmaninoff-concerto2-mov1',
      name: 'Piano Concerto No. 2 - I. Moderato',
      path: toBuiltInPath('rachmaninoff-concerto2-mov1.mid'),
      composer: 'Sergei Rachmaninoff'
    },
    {
      id: 'rachmaninoff-concerto2-mov2',
      name: 'Piano Concerto No. 2 - II. Adagio',
      path: toBuiltInPath('rachmaninoff-concerto2-mov2.mid'),
      composer: 'Sergei Rachmaninoff'
    },
    {
      id: 'rachmaninoff-concerto2-mov3',
      name: 'Piano Concerto No. 2 - III. Allegro',
      path: toBuiltInPath('rachmaninoff-concerto2-mov3.mid'),
      composer: 'Sergei Rachmaninoff'
    },
    // Other pieces
    {
      id: 'bach-wtc-prelude',
      name: 'WTC Book I - Prelude in C',
      path: toBuiltInPath('bach-wtc-prelude-c.mid'),
      composer: 'J.S. Bach'
    },
    {
      id: 'satie-gnossienne',
      name: 'Gnossienne No. 1',
      path: toBuiltInPath('satie-gnossienne-1.mid'),
      composer: 'Erik Satie'
    },
    {
      id: 'satie-gymnopedie',
      name: 'Gymnopedie No. 1',
      path: toBuiltInPath('satie-gymnopedie-1.mid'),
      composer: 'Erik Satie'
    },
    {
      id: 'bach-cello-prelude',
      name: 'Cello Suite No. 1 - Prelude',
      path: toBuiltInPath('bach-prelude-cello.mid'),
      composer: 'J.S. Bach'
    },
    {
      id: 'rachmaninoff-vocalise',
      name: 'Vocalise Op. 34',
      path: toBuiltInPath('rachmaninoff-vocalise.mid'),
      composer: 'Sergei Rachmaninoff'
    }
  ];
}
