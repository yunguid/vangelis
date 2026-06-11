/**
 * MIDI file parser for Vangelis
 * Uses @tonejs/midi for parsing .mid files
 * @module utils/midiParser
 */

import { Midi } from '@tonejs/midi';
import russianMidiLibrary from '../data/russianMidiLibrary.json';
import { withBase } from './baseUrl.js';

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
 * @property {string} composer - Composer name
 * @property {string|null} [soundSetId] - Optional built-in sound set id for samples
 * @property {string[]} [layerFamilies] - Optional forced layer families (e.g. ['piano', 'strings'])
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
  const arrayBuffer = source instanceof File
    ? await source.arrayBuffer()
    : await fetch(source).then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch MIDI: ${response.status} ${response.statusText}`);
      }
      return response.arrayBuffer();
    });

  const midi = new Midi(arrayBuffer);

  return {
    name: midi.name || 'Untitled',
    duration: midi.duration,
    bpm: midi.header.tempos[0]?.bpm || 120,
    timeSignature: normalizeTimeSignature(midi.header.timeSignatures[0]),
    notes: flattenTracks(midi.tracks)
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
  const libraryPlaybackProfiles = {
    'tchaikovsky-op39-01-morning-prayer': {
      soundSetId: 'rachmaninoff-orchestral-lite',
      layerFamilies: ['piano', 'strings']
    },
    'tchaikovsky-op39-05-march-wooden-soldiers': {
      soundSetId: 'orchestral-extended-starter',
      layerFamilies: ['strings', 'brass', 'piano']
    },
    'tchaikovsky-op39-16-old-french-song': {
      soundSetId: 'cinematic-starter-pack',
      layerFamilies: ['piano', 'strings']
    },
    'rachmaninoff-op23-04-prelude': {
      soundSetId: 'rachmaninoff-orchestral-lite',
      layerFamilies: ['piano', 'strings']
    },
    'rachmaninoff-op23-05-prelude': {
      soundSetId: 'cinematic-starter-pack',
      layerFamilies: ['piano', 'strings']
    },
    'mussorgsky-night-on-bald-mountain': {
      soundSetId: 'orchestral-extended-starter',
      layerFamilies: ['strings', 'brass', 'reed']
    },
    'rimsky-korsakov-op11-07-etude': {
      soundSetId: 'orchestral-extended-starter',
      layerFamilies: ['strings', 'reed', 'brass']
    },
    'scriabin-op11-13-prelude': {
      soundSetId: 'cinematic-starter-pack',
      layerFamilies: ['piano', 'strings']
    },
    'bortniansky-the-angel-cried': {
      soundSetId: 'orchestral-extended-starter',
      layerFamilies: ['strings', 'reed', 'piano']
    },
    'alyabyev-the-nightingale': {
      soundSetId: 'orchestral-extended-starter',
      layerFamilies: ['strings', 'reed', 'piano']
    },
    'stanchinsky-prelude-c-minor': {
      soundSetId: 'cinematic-starter-pack',
      layerFamilies: ['piano', 'strings']
    }
  };

  const russianFiles = russianMidiLibrary.map((entry) => ({
    id: entry.id,
    name: entry.name,
    path: toBuiltInPath(`russian/${entry.id}.mid`),
    composer: entry.composer,
    sourceUrl: entry.sourceUrl,
    ...(libraryPlaybackProfiles[entry.id] || {})
  }));

  // Original in-house cues, composed for the synth presets — see
  // scripts/generate_original_midis.mjs. No soundSetId so they play
  // through whatever preset is currently loaded.
  const originalFiles = [
    {
      id: 'original-neon-rain',
      name: 'Neon Rain (Synth Blues)',
      path: toBuiltInPath('originals/original-neon-rain.mid'),
      composer: 'Vangelis Studio Original'
    },
    {
      id: 'original-elegy-for-replicants',
      name: 'Elegy for Replicants (Ambient)',
      path: toBuiltInPath('originals/original-elegy-for-replicants.mid'),
      composer: 'Vangelis Studio Original'
    },
    {
      id: 'original-sea-of-dunes',
      name: 'Sea of Dunes (Drone)',
      path: toBuiltInPath('originals/original-sea-of-dunes.mid'),
      composer: 'Vangelis Studio Original'
    },
    {
      id: 'original-escape-velocity',
      name: 'Escape Velocity (Chase)',
      path: toBuiltInPath('originals/original-escape-velocity.mid'),
      composer: 'Vangelis Studio Original'
    },
    {
      id: 'original-green-memories',
      name: 'Green Memories (Ballad)',
      path: toBuiltInPath('originals/original-green-memories.mid'),
      composer: 'Vangelis Studio Original'
    },
    {
      id: 'original-rain-on-chrome',
      name: 'Rain on Chrome (Sequence)',
      path: toBuiltInPath('originals/original-rain-on-chrome.mid'),
      composer: 'Vangelis Studio Original'
    },
    {
      id: 'original-offworld-anthem',
      name: 'Offworld Anthem (Fanfare)',
      path: toBuiltInPath('originals/original-offworld-anthem.mid'),
      composer: 'Vangelis Studio Original'
    },
    {
      id: 'original-vapor-lights',
      name: 'Vapor Lights (Blues II)',
      path: toBuiltInPath('originals/original-vapor-lights.mid'),
      composer: 'Vangelis Studio Original'
    }
  ];

  return [
    ...originalFiles,
    {
      id: 'vangelis-to-the-unknown-man',
      name: 'To the Unknown Man',
      path: toBuiltInPath('to-the-unknown-man.mid'),
      composer: 'Vangelis'
    },
    ...russianFiles,
    // Rachmaninoff Piano Concerto No. 2
    {
      id: 'rachmaninoff-concerto2-mov1',
      name: 'Piano Concerto No. 2 - I. Moderato',
      path: toBuiltInPath('rachmaninoff-concerto2-mov1.mid'),
      composer: 'Sergei Rachmaninoff',
      soundSetId: 'rachmaninoff-orchestral-lite',
      layerFamilies: ['piano', 'strings']
    },
    {
      id: 'rachmaninoff-concerto2-mov2',
      name: 'Piano Concerto No. 2 - II. Adagio',
      path: toBuiltInPath('rachmaninoff-concerto2-mov2.mid'),
      composer: 'Sergei Rachmaninoff',
      soundSetId: 'rachmaninoff-orchestral-lite',
      layerFamilies: ['piano', 'strings']
    },
    {
      id: 'rachmaninoff-concerto2-mov3',
      name: 'Piano Concerto No. 2 - III. Allegro',
      path: toBuiltInPath('rachmaninoff-concerto2-mov3.mid'),
      composer: 'Sergei Rachmaninoff',
      soundSetId: 'rachmaninoff-orchestral-lite',
      layerFamilies: ['piano', 'strings']
    },
    // Other pieces
    {
      id: 'bach-wtc-prelude',
      name: 'WTC Book I - Prelude in C',
      path: toBuiltInPath('bach-wtc-prelude-c.mid'),
      composer: 'J.S. Bach',
      soundSetId: 'rachmaninoff-orchestral-lite',
      layerFamilies: ['piano']
    },
    {
      id: 'satie-gnossienne',
      name: 'Gnossienne No. 1',
      path: toBuiltInPath('satie-gnossienne-1.mid'),
      composer: 'Erik Satie',
      soundSetId: 'rachmaninoff-orchestral-lite',
      layerFamilies: ['piano', 'strings']
    },
    {
      id: 'satie-gymnopedie',
      name: 'Gymnopedie No. 1',
      path: toBuiltInPath('satie-gymnopedie-1.mid'),
      composer: 'Erik Satie',
      soundSetId: 'rachmaninoff-orchestral-lite',
      layerFamilies: ['piano', 'strings']
    },
    {
      id: 'bach-cello-prelude',
      name: 'Cello Suite No. 1 - Prelude',
      path: toBuiltInPath('bach-prelude-cello.mid'),
      composer: 'J.S. Bach',
      soundSetId: 'cinematic-starter-pack',
      layerFamilies: ['strings']
    },
    {
      id: 'rachmaninoff-vocalise',
      name: 'Vocalise Op. 34',
      path: toBuiltInPath('rachmaninoff-vocalise.mid'),
      composer: 'Sergei Rachmaninoff',
      soundSetId: 'orchestral-extended-starter',
      layerFamilies: ['strings', 'reed', 'piano']
    }
  ];
}
