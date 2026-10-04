/**
 * The landing pieces as piano lessons (pages/LearnPage.jsx): which of each file's notes the
 * hands play, how it is cut into phrases and a word on how to go about it.
 *
 * `hands(track, note)` returns 'left', 'right', 'harmony' (not played, but heard when naming the
 * chords) or null (left out);
 * `barsPerPhrase` cuts a metered piece by its bars (the file's own tempo map and meter), and
 * a piece in free time (a transcription keeps the record's timing) is cut at its breaths.
 * `rebalance` hands a note far under the right hand's reach to the left (a piano piece split
 * at middle C; utils/learn/lesson.js rebalanceHands).
 */
import { withBase } from '../utils/baseUrl.js';
import { buildLesson, rebalanceHands } from '../utils/learn/lesson.js';

const MIDDLE_C = 60;
const splitAt = (split) => (track, note) => (note.midi < split ? 'left' : 'right');

export const LEARN_PIECES = Object.freeze([
  {
    slug: 'memories-of-green',
    pieceId: 'performance-memories-of-green',
    title: 'Memories of Green',
    composer: 'Vangelis',
    file: 'midi/performances/memories-of-green.mid',
    // The glides are the synth's; the piano is the lesson.
    hands: (track, note) => (track.name === 'Piano' ? splitAt(MIDDLE_C)(track, note) : null),
    rebalance: true,
    barsPerPhrase: null,
    intro: 'A slow piano piece played freely — there is no strict beat to count, so let each phrase breathe. The left hand holds open chords low on the keyboard while the right hand sings the melody high above. Learn each hand alone first, then put them together slowly with the sustain pedal down.'
  },
  {
    slug: 'subwoofer-lullaby',
    pieceId: 'performance-opening-piano',
    title: 'Subwoofer Lullaby',
    composer: 'C418',
    file: 'midi/subwoofer-lullaby.mid',
    hands: splitAt(MIDDLE_C),
    rebalance: true,
    barsPerPhrase: 2,
    intro: 'Gentle and repetitive — a perfect first piece. The left hand rocks between a few low notes while the right hand plays a simple, music-box melody. Once a two-bar phrase is in your fingers, you will meet it again and again.'
  },
  {
    slug: 'blade-runner-blues',
    pieceId: 'performance-blade-runner-blues',
    title: 'Blade Runner Blues',
    composer: 'Vangelis',
    file: 'midi/performances/blade-runner-blues.mid',
    // A piano reduction of the synths: the CS-80's lead in the right hand, the bass and the
    // low half of the pads in the left. The pads' upper voices still name the chords; the
    // rumble is left out.
    hands: (track, note) => {
      if (track.name.startsWith('cs80')) return 'right';
      if (track.name.startsWith('bass')) return 'left';
      if (track.name.startsWith('pad')) return note.midi < MIDDLE_C ? 'left' : 'harmony';
      return null;
    },
    barsPerPhrase: null,
    intro: 'Slow, smoky and spacious. This is a piano reduction of the synthesizers: the right hand takes the CS-80\'s bluesy lead line, the left hand holds the bass and the low pad chords. Hold each left-hand chord for its full length and let the melody bend and lean over it.'
  },
  {
    slug: 'pernambuco',
    pieceId: 'performance-pernambuco',
    title: 'Pernambuco',
    composer: 'Luiz Bonfá',
    file: 'midi/performances/pernambuco.mid',
    // A guitar piece: the three bass strings to the left hand, the three treble strings to the right.
    hands: (track) => (/String [456]/.test(track.name) ? 'left' : /String [123]/.test(track.name) ? 'right' : null),
    barsPerPhrase: 4,
    intro: 'A lively Brazilian guitar piece in two. The guitar\'s bass strings become your left hand and its treble strings your right. Feel the swing of the two-beat bar: the left hand keeps the pulse while the right plays the syncopated chords and melody on top.'
  },
  {
    slug: 'shade-of-the-mango-tree',
    pieceId: 'performance-shade-of-the-mango-tree',
    title: 'The Shade of the Mango Tree',
    composer: 'Luiz Bonfá',
    file: 'midi/performances/shade-of-the-mango-tree.mid',
    hands: (track) => (/String [456]/.test(track.name) ? 'left' : /String [123]/.test(track.name) ? 'right' : null),
    barsPerPhrase: 4,
    intro: 'A warm bossa nova written for guitar. The bass strings become your left hand, the treble strings your right. The chords are rich — sevenths and ninths — so the chord cards below are the best place to start before you try a phrase.'
  }
]);

const BY_SLUG = new Map(LEARN_PIECES.map((piece) => [piece.slug, piece]));
const BY_PIECE_ID = new Map(LEARN_PIECES.map((piece) => [piece.pieceId, piece]));

export const getLearnPiece = (slug) => BY_SLUG.get(slug) || null;
export const getLearnPieceForPieceId = (pieceId) => BY_PIECE_ID.get(pieceId) || null;

/** A parsed @tonejs/midi file's notes as the piano plays them: hand and, when metered, bar position. */
export const learnNotesFromMidi = (midi, piece) => {
  const notes = [];
  for (const track of midi.tracks) {
    for (const note of track.notes) {
      const hand = piece.hands(track, note);
      if (!hand) continue;
      notes.push({
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity,
        hand,
        measure: piece.barsPerPhrase ? midi.header.ticksToMeasures(note.ticks) + 1 : undefined
      });
    }
  }
  return piece.rebalance ? rebalanceHands(notes) : notes;
};

export const lessonFromMidi = (midi, piece) => buildLesson(learnNotesFromMidi(midi, piece), { barsPerPhrase: piece.barsPerPhrase });

/** Fetch, parse and analyse a piece's MIDI file. */
export async function loadLesson(piece, base = import.meta.env.BASE_URL) {
  const [{ Midi }, response] = await Promise.all([
    import('@tonejs/midi'),
    fetch(withBase(piece.file, base))
  ]);
  if (!response.ok) throw new Error(`${piece.title}: ${response.status}`);
  const midi = new Midi(await response.arrayBuffer());
  return lessonFromMidi(midi, piece);
}
