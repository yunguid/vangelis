import { describe, expect, it } from 'vitest';
import {
  buildLesson, collectSteps, detectChord, detectKey, keySignatureAccidental, keySignatureLetters,
  rebalanceHands, romanNumeral, spellMidi, spellPitchClass
} from './lesson.js';

const name = (pc, fifths) => {
  const { letter, accidental } = spellPitchClass(pc, fifths);
  return 'CDEFGAB'[letter] + ({ '-1': 'b', 0: '', 1: '#' }[accidental]);
};

const weightsOf = (pcs) => {
  const weights = new Array(12).fill(0);
  pcs.forEach((pc) => { weights[pc] += 1; });
  return weights;
};

describe('spelling', () => {
  it('writes a pitch in its key', () => {
    expect(name(6, 2)).toBe('F#'); // D major
    expect(name(1, 2)).toBe('C#');
    expect(name(10, -1)).toBe('Bb'); // F major
    expect(name(3, -3)).toBe('Eb');
    expect(name(1, 0)).toBe('C#'); // chromatic in C leans sharp
    expect(name(10, 0)).toBe('Bb');
  });

  it('places notes on the staff from middle C', () => {
    expect(spellMidi(60).step).toBe(28);
    expect(spellMidi(60).label).toBe('C4');
    expect(spellMidi(66, 2).label).toBe('F♯4');
    expect(spellMidi(70, -1).label).toBe('B♭4');
    expect(spellMidi(77).step).toBe(38); // F5, the treble staff's top line
  });

  it('knows which letters a key signature alters', () => {
    expect(keySignatureLetters(2)).toEqual([3, 0]); // F♯ C♯
    expect(keySignatureLetters(-2)).toEqual([6, 2]); // B♭ E♭
    expect(keySignatureAccidental(3, 2)).toBe(1);
    expect(keySignatureAccidental(4, 2)).toBe(0);
    expect(keySignatureAccidental(6, -1)).toBe(-1);
  });
});

describe('harmony', () => {
  it('hears a key from its scale', () => {
    const dMajor = [2, 4, 6, 7, 9, 11, 1];
    const weights = weightsOf(dMajor);
    weights[2] += 3;
    weights[9] += 2;
    expect(detectKey(weights)).toMatchObject({ tonic: 2, mode: 'major', fifths: 2, name: 'D major' });
  });

  it('names chords, sevenths and inversions', () => {
    expect(detectChord(weightsOf([2, 6, 9]), 2, 2).label).toBe('D');
    expect(detectChord(weightsOf([2, 6, 9, 1]), 2, 2).label).toBe('Dmaj7');
    expect(detectChord(weightsOf([11, 2, 6]), 11, 2).label).toBe('Bm');
    expect(detectChord(weightsOf([2, 6, 9]), 9, 2).label).toBe('D/A');
    expect(detectChord(weightsOf([5]), 5, -1)).toBeNull();
  });

  it('numbers a chord in its key', () => {
    const key = { tonic: 2, mode: 'major' };
    expect(romanNumeral({ root: 7, quality: 'major seventh', suffix: 'maj7' }, key)).toBe('IV7');
    expect(romanNumeral({ root: 11, quality: 'minor', suffix: 'm' }, key)).toBe('vi');
    expect(romanNumeral({ root: 5, quality: 'major', suffix: '' }, key)).toBeNull();
  });
});

describe('steps, hands and phrases', () => {
  it('groups notes struck together into one step', () => {
    const steps = collectSteps([
      { midi: 62, time: 0, duration: 1 },
      { midi: 50, time: 0.03, duration: 1 },
      { midi: 66, time: 0.5, duration: 1 }
    ]);
    expect(steps.map((step) => step.notes.map((note) => note.midi))).toEqual([[50, 62], [66]]);
  });

  it('gives a note far under the right hand to the left', () => {
    const notes = [
      { midi: 90, time: 0, duration: 0.5, hand: 'right' },
      { midi: 85, time: 0.5, duration: 0.5, hand: 'right' },
      { midi: 93, time: 1, duration: 0.5, hand: 'right' },
      { midi: 67, time: 1.1, duration: 2, hand: 'right' },
      { midi: 88, time: 1.5, duration: 0.5, hand: 'right' }
    ];
    const hands = rebalanceHands(notes).map((note) => [note.midi, note.hand]);
    expect(hands).toContainEqual([67, 'left']);
    expect(hands).toContainEqual([85, 'right']);
  });

  it('cuts free time at its breaths and names each phrase\'s chords', () => {
    // Two phrases of D major arpeggios, with a long breath between.
    const phrase = (start) => Array.from({ length: 10 }, (_, i) => [
      { midi: 50, time: start + i * 0.5, duration: 0.5, velocity: 0.7, hand: 'left' },
      { midi: [66, 69, 74, 69][i % 4], time: start + i * 0.5, duration: 0.5, velocity: 0.7, hand: 'right' }
    ]).flat();
    const lesson = buildLesson([...phrase(0), ...phrase(8)]);
    expect(lesson.phrases).toHaveLength(2);
    expect(lesson.phrases[1].start).toBe(8);
    expect(lesson.key.name).toBe('D major');
    expect(lesson.phrases[0].chords[0].label).toBe('D');
    expect(lesson.vocabulary.map((chord) => chord.label)).toEqual(['D']);
  });

  it('cuts a metered piece by its bars', () => {
    const notes = Array.from({ length: 16 }, (_, i) => ({
      midi: 60 + (i % 3) * 4, time: i * 0.5, duration: 0.4, velocity: 0.7, hand: 'right', measure: 1 + i / 2
    }));
    const lesson = buildLesson(notes, { barsPerPhrase: 2 });
    expect(lesson.phrases.map((p) => p.bars)).toEqual([[1, 2], [3, 4], [5, 6], [7, 8]]);
  });

  it('leaves voices marked harmony out of what is played', () => {
    const lesson = buildLesson([
      { midi: 62, time: 0, duration: 2, velocity: 0.7, hand: 'left' },
      { midi: 66, time: 0, duration: 2, velocity: 0.7, hand: 'harmony' },
      { midi: 69, time: 0, duration: 2, velocity: 0.7, hand: 'harmony' }
    ]);
    expect(lesson.phrases[0].steps[0].notes.map((note) => note.midi)).toEqual([62]);
    expect(lesson.phrases[0].chords[0].label).toBe('D');
  });
});
