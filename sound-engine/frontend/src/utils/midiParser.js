/**
 * MIDI file parser for Vangelis
 * Uses @tonejs/midi for parsing .mid files
 * @module utils/midiParser
 */

import { Midi } from '@tonejs/midi';
import russianMidiLibrary from '../data/russianMidiLibrary.json';

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
    : await fetch(source).then(r => r.arrayBuffer());

  const midi = new Midi(arrayBuffer);

  return {
    name: midi.name || 'Untitled',
    duration: midi.duration,
    bpm: midi.header.tempos[0]?.bpm || 120,
    timeSignature: midi.header.timeSignatures[0] || { numerator: 4, denominator: 4 },
    notes: flattenTracks(midi.tracks)
  };
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
 * @returns {MidiFileInfo[]} Array of MIDI file metadata
 * @example
 * const files = getBuiltInMidiFiles();
 * files.forEach(file => console.log(file.name, 'by', file.composer));
 */
export function getBuiltInMidiFiles() {
  const russianFiles = russianMidiLibrary.map((entry) => ({
    id: entry.id,
    name: entry.name,
    path: `/midi/russian/${entry.id}.mid`,
    composer: entry.composer,
    sourceUrl: entry.sourceUrl
  }));

  return [
    ...russianFiles,
    // Rachmaninoff Piano Concerto No. 2
    {
      id: 'rachmaninoff-concerto2-mov1',
      name: 'Piano Concerto No. 2 - I. Moderato',
      path: '/midi/rachmaninoff-concerto2-mov1.mid',
      composer: 'Sergei Rachmaninoff',
      soundSetId: 'rachmaninoff-orchestral-lite'
    },
    {
      id: 'rachmaninoff-concerto2-mov2',
      name: 'Piano Concerto No. 2 - II. Adagio',
      path: '/midi/rachmaninoff-concerto2-mov2.mid',
      composer: 'Sergei Rachmaninoff',
      soundSetId: 'rachmaninoff-orchestral-lite'
    },
    {
      id: 'rachmaninoff-concerto2-mov3',
      name: 'Piano Concerto No. 2 - III. Allegro',
      path: '/midi/rachmaninoff-concerto2-mov3.mid',
      composer: 'Sergei Rachmaninoff'
    },
    // Other pieces
    {
      id: 'bach-wtc-prelude',
      name: 'WTC Book I - Prelude in C',
      path: '/midi/bach-wtc-prelude-c.mid',
      composer: 'J.S. Bach'
    },
    {
      id: 'satie-gnossienne',
      name: 'Gnossienne No. 1',
      path: '/midi/satie-gnossienne-1.mid',
      composer: 'Erik Satie'
    },
    {
      id: 'satie-gymnopedie',
      name: 'Gymnopedie No. 1',
      path: '/midi/satie-gymnopedie-1.mid',
      composer: 'Erik Satie'
    },
    {
      id: 'bach-cello-prelude',
      name: 'Cello Suite No. 1 - Prelude',
      path: '/midi/bach-prelude-cello.mid',
      composer: 'J.S. Bach'
    },
    {
      id: 'rachmaninoff-vocalise',
      name: 'Vocalise Op. 34',
      path: '/midi/rachmaninoff-vocalise.mid',
      composer: 'Sergei Rachmaninoff'
    }
  ];
}
