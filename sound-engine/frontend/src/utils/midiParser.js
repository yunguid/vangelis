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
 * @property {string} [composer] - Composer name, if known
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
  const ORIGINAL_CUES = [
    ['original-neon-rain', 'Neon Rain (Synth Blues)'],
    ['original-elegy-for-replicants', 'Elegy for Replicants (Ambient)'],
    ['original-sea-of-dunes', 'Sea of Dunes (Drone)'],
    ['original-escape-velocity', 'Escape Velocity (Chase)'],
    ['original-green-memories', 'Green Memories (Ballad)'],
    ['original-rain-on-chrome', 'Rain on Chrome (Sequence)'],
    ['original-offworld-anthem', 'Offworld Anthem (Fanfare)'],
    ['original-vapor-lights', 'Vapor Lights (Blues II)'],
    ['original-scream-at-the-sky', 'Scream at the Sky (Lead Ballad)'],
    ['original-chrome-canyon-run', 'Chrome Canyon Run (Synth Rock)'],
    ['original-sugar-crash-angel', 'Sugar Crash Angel (Hyperpop)'],
    ['original-red-mist', 'Red Mist (Rage)'],
    ['original-analog-sunrise', 'Analog Sunrise (Anthem)'],
    ['original-velvet-horizon', 'Velvet Horizon (Chorale)'],
    ['original-strings-of-io', 'Strings of Io (Elegy)'],
    ['original-west-coast-wall', 'West Coast Wall (80s)'],
    ['original-ghost-frequency', 'Ghost Frequency (Spectral)'],
    ['original-airborne-cathedral', 'Airborne Cathedral (Air)'],
    ['original-night-drive-basement', 'Night Drive Basement (Synthwave)'],
    ['original-trap-door', 'Trap Door (Trap)'],
    ['original-concrete-teeth', 'Concrete Teeth (Rage Bass)'],
    ['original-acid-perimeter', 'Acid Perimeter (Acid)'],
    ['original-low-tide-fog', 'Low Tide Fog (Deep Drone)'],
    ['original-glass-elevator', 'Glass Elevator (Comping)'],
    ['original-bells-for-rachael', 'Bells for Rachael (Bell Ballad)'],
    ['original-pixel-heartbreak', 'Pixel Heartbreak (Hyperpop)'],
    ['original-2am-lullaby', '2AM Lullaby (EP Ballad)'],
    ['original-chime-orbit', 'Chime Orbit (Arpeggio)'],
    ['original-alarm-district', 'Alarm District (Trap)'],
    ['original-shimmer-bloom', 'Shimmer Bloom (Texture)'],
    ['original-ribbon-in-the-rain', 'Ribbon in the Rain (Gesture)'],
    ['original-gulls-over-voltage-bay', 'Gulls Over Voltage Bay (Ambient)'],
    ['original-cathedral-of-wires', 'Cathedral of Wires (Drone Mass)'],
    ['original-neon-cathedral', 'Neon Cathedral (Anthem)'],
    ['original-static-bloom', 'Static Bloom (Hyperpop)'],
    ['original-glitter-riot', 'Glitter Riot (Hyperpop Rage)'],
    ['original-halogen-heart', 'Halogen Heart (Hyperpop Pluck)'],
    ['original-midnight-slide', 'Midnight Slide (Trap)'],
    ['original-black-ice', 'Black Ice (Trap)'],
    ['original-adrenaline-red', 'Adrenaline Red (Rage)'],
    ['original-teeth-grinder', 'Teeth Grinder (Rage)'],
    ['original-first-light-over-la', 'First Light Over LA (Pad Ballad)'],
    ['original-solar-sail', 'Solar Sail (Dream Pad)'],
    ['original-rust-and-chrome', 'Rust and Chrome (Slow Blues)'],
    ['original-violet-skyline', 'Violet Skyline (80s Ballad)'],
    ['original-magnetic-north', 'Magnetic North (Anthem)'],
    ['original-deep-signal', 'Deep Signal (Drone)'],
    ['original-afterimage', 'Afterimage (Ambient)'],
    ['original-late-checkout', 'Late Checkout (Lo-fi Keys)'],
    ['original-thunder-veil', 'Thunder Veil (Dark Pad)'],
    ['original-warm-static', 'Warm Static (EP Ballad)'],
    ['original-zero-gravity-waltz', 'Zero Gravity Waltz'],
    ['original-tokyo-monorail', 'Tokyo Monorail (Synthwave)'],
    ['original-perimeter-run', 'Perimeter Run (Chase Arps)'],
    ['original-glass-garden', 'Glass Garden (Pluck Arps)'],
    ['original-copper-wires', 'Copper Wires (Acid)'],
    ['original-dust-devils', 'Dust Devils (Sequence)'],
    ['original-crystal-run', 'Crystal Run (Bright Arps)']
  ];
  const originalFiles = ORIGINAL_CUES.map(([id, name]) => ({
    id,
    name,
    path: toBuiltInPath(`originals/${id}.mid`)
  }));

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
