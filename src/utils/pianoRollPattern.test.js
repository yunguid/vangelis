import { describe, it, expect } from 'vitest';
import {
  BEATS_PER_BAR,
  DEFAULT_VELOCITY,
  MIN_NOTE_BEATS,
  PITCH_MAX,
  PITCH_MIN,
  addNote,
  applyNoteDelta,
  copyNotesPayload,
  createPattern,
  deleteNote,
  deleteNotes,
  duplicateNotes,
  nudgeNotes,
  pasteNotesPayload,
  resizeNotes,
  getSnapBeats,
  isInScale,
  patternBeats,
  patternToMidiData,
  quantizeBeats,
  quantizeBeatsFloor,
  setPatternBars,
  updateNote
} from './pianoRollPattern.js';

describe('createPattern', () => {
  it('creates an empty pattern with clamped bpm and legal bars', () => {
    const pattern = createPattern({ bpm: 999, bars: 3 });
    expect(pattern.notes).toEqual([]);
    expect(pattern.bpm).toBe(240);
    expect(pattern.bars).toBe(4);
    expect(patternBeats(pattern)).toBe(4 * BEATS_PER_BAR);
  });
});

describe('addNote', () => {
  it('adds a note with defaults and assigns sequential ids', () => {
    let { pattern, note } = addNote(createPattern(), { midi: 60, start: 0, duration: 1 });
    expect(note.id).toBe('note-1');
    expect(note.velocity).toBe(DEFAULT_VELOCITY);

    ({ pattern, note } = addNote(pattern, { midi: 64, start: 1, duration: 1 }));
    expect(note.id).toBe('note-2');
    expect(pattern.notes).toHaveLength(2);
  });

  it('replaces same-pitch overlapping notes but keeps other rows', () => {
    let { pattern } = addNote(createPattern(), { midi: 60, start: 0, duration: 2 });
    ({ pattern } = addNote(pattern, { midi: 62, start: 0, duration: 2 }));
    ({ pattern } = addNote(pattern, { midi: 60, start: 1, duration: 1 }));

    const c4Notes = pattern.notes.filter((note) => note.midi === 60);
    expect(c4Notes).toHaveLength(1);
    expect(c4Notes[0].start).toBe(1);
    expect(pattern.notes.filter((note) => note.midi === 62)).toHaveLength(1);
  });

  it('allows same-pitch notes that touch end-to-start without replacement', () => {
    let { pattern } = addNote(createPattern(), { midi: 60, start: 0, duration: 1 });
    ({ pattern } = addNote(pattern, { midi: 60, start: 1, duration: 1 }));
    expect(pattern.notes).toHaveLength(2);
  });

  it('clamps pitch and span to pattern bounds', () => {
    const base = createPattern({ bars: 1 });
    const { note: high } = addNote(base, { midi: 300, start: 0, duration: 1 }).pattern
      ? addNote(base, { midi: 300, start: 0, duration: 1 })
      : {};
    expect(high.midi).toBe(PITCH_MAX);

    const { note: low } = addNote(base, { midi: -5, start: 2, duration: 99 });
    expect(low.midi).toBe(PITCH_MIN);
    expect(low.start + low.duration).toBeLessThanOrEqual(BEATS_PER_BAR);
  });
});

describe('updateNote / deleteNote', () => {
  it('moves and resizes with clamping', () => {
    const { pattern, note } = addNote(createPattern({ bars: 1 }), { midi: 60, start: 0, duration: 1 });
    const moved = updateNote(pattern, note.id, { start: 3.75, duration: 5 });
    const result = moved.notes[0];
    expect(result.start).toBe(3.75);
    expect(result.start + result.duration).toBeLessThanOrEqual(BEATS_PER_BAR);

    const shrunk = updateNote(pattern, note.id, { duration: 0 });
    expect(shrunk.notes[0].duration).toBe(MIN_NOTE_BEATS);
  });

  it('deletes by id', () => {
    const { pattern, note } = addNote(createPattern(), { midi: 60, start: 0, duration: 1 });
    expect(deleteNote(pattern, note.id).notes).toHaveLength(0);
    expect(deleteNote(pattern, 'missing').notes).toHaveLength(1);
  });
});

describe('applyNoteDelta / deleteNotes', () => {
  it('translates only the notes with origins, clamped independently', () => {
    let { pattern } = addNote(createPattern({ bars: 1 }), { midi: 60, start: 0, duration: 1 });
    ({ pattern } = addNote(pattern, { midi: 64, start: 3, duration: 1 }));
    const [first, second] = pattern.notes;
    const origins = new Map([
      [first.id, { start: first.start, midi: first.midi }],
      [second.id, { start: second.start, midi: second.midi }]
    ]);

    const moved = applyNoteDelta(pattern, origins, 1, 2);
    expect(moved.notes[0].start).toBe(1);
    expect(moved.notes[0].midi).toBe(62);
    expect(moved.notes[1].midi).toBe(66);
    // second note started at beat 3 of a 4-beat pattern: clamped inside.
    expect(moved.notes[1].start + moved.notes[1].duration).toBeLessThanOrEqual(BEATS_PER_BAR);

    const untouched = applyNoteDelta(pattern, new Map(), 2, 2);
    expect(untouched.notes).toEqual(pattern.notes);
  });

  it('deletes a set of ids at once', () => {
    let { pattern } = addNote(createPattern(), { midi: 60, start: 0, duration: 1 });
    ({ pattern } = addNote(pattern, { midi: 62, start: 1, duration: 1 }));
    ({ pattern } = addNote(pattern, { midi: 64, start: 2, duration: 1 }));
    const [a, , c] = pattern.notes;

    const next = deleteNotes(pattern, new Set([a.id, c.id]));
    expect(next.notes).toHaveLength(1);
    expect(next.notes[0].midi).toBe(62);
  });
});

describe('clipboard: copy / paste / duplicate / nudge', () => {
  const buildSelection = () => {
    let { pattern } = addNote(createPattern({ bars: 2 }), { midi: 60, start: 0, duration: 1 });
    ({ pattern } = addNote(pattern, { midi: 64, start: 1, duration: 0.5 }));
    return { pattern, ids: new Set(pattern.notes.map((note) => note.id)) };
  };

  it('copies an id-free payload sorted by start', () => {
    const { pattern, ids } = buildSelection();
    const payload = copyNotesPayload(pattern, ids);
    expect(payload).toEqual([
      { midi: 60, start: 0, duration: 1, velocity: DEFAULT_VELOCITY },
      { midi: 64, start: 1, duration: 0.5, velocity: DEFAULT_VELOCITY }
    ]);
  });

  it('pastes at original positions with fresh ids, selecting the copies', () => {
    const { pattern, ids } = buildSelection();
    const payload = copyNotesPayload(pattern, ids);
    const { pattern: next, noteIds } = pasteNotesPayload(pattern, payload);
    // In-place paste replaces the overlapping originals note-for-note.
    expect(next.notes).toHaveLength(2);
    expect(noteIds).toHaveLength(2);
    noteIds.forEach((id) => expect(ids.has(id)).toBe(false));
  });

  it('pastes with an offset and drops entries past the pattern end', () => {
    const { pattern, ids } = buildSelection();
    const payload = copyNotesPayload(pattern, ids);
    const { pattern: next, noteIds } = pasteNotesPayload(pattern, payload, 7.5);
    expect(noteIds).toHaveLength(1); // second entry would start at 8.5 > 8 beats
    expect(next.notes).toHaveLength(3);
  });

  it('duplicates a selection one snap-rounded span to the right', () => {
    const { pattern, ids } = buildSelection(); // span 0..1.5
    const { pattern: next, noteIds } = duplicateNotes(pattern, ids, 0.25);
    expect(noteIds).toHaveLength(2);
    const copies = next.notes.filter((note) => noteIds.includes(note.id));
    expect(copies.map((note) => note.start).sort((a, b) => a - b)).toEqual([1.5, 2.5]);
    expect(next.notes).toHaveLength(4);
  });

  it('resizes from the right edge with clamps at both extremes', () => {
    const { pattern, ids } = buildSelection(); // notes: (60, 0..1), (64, 1..1.5)
    const grown = resizeNotes(pattern, ids, 0.5, 'right');
    expect(grown.notes[0].duration).toBe(1.5);
    expect(grown.notes[1].duration).toBe(1);

    const shrunk = resizeNotes(pattern, ids, -0.75, 'right');
    expect(shrunk.notes[0].duration).toBe(0.25);
    expect(shrunk.notes[1].duration).toBe(MIN_NOTE_BEATS); // 0.5 - 0.75 clamps

    const [first] = pattern.notes;
    const maxed = resizeNotes(pattern, new Set([first.id]), 99, 'right');
    expect(maxed.notes[0].start + maxed.notes[0].duration).toBe(2 * BEATS_PER_BAR);
  });

  it('trims from the left edge keeping the end fixed', () => {
    const { pattern, ids } = buildSelection();
    const trimmed = resizeNotes(pattern, ids, 0.5, 'left');
    expect(trimmed.notes[0].start).toBe(0.5);
    expect(trimmed.notes[0].start + trimmed.notes[0].duration).toBe(1);
    // second note (1..1.5): +0.5 would erase it; clamps to min length.
    expect(trimmed.notes[1].duration).toBe(MIN_NOTE_BEATS);
    expect(trimmed.notes[1].start + trimmed.notes[1].duration).toBe(1.5);

    const extended = resizeNotes(pattern, ids, -0.5, 'left');
    expect(extended.notes[0].start).toBe(0); // clamped at pattern start
    expect(extended.notes[1].start).toBe(0.5);
    expect(extended.notes[1].start + extended.notes[1].duration).toBe(1.5);
  });

  it('nudges a selection and clamps at pattern edges', () => {
    const { pattern, ids } = buildSelection();
    const nudged = nudgeNotes(pattern, ids, -0.25, 1);
    expect(nudged.notes[0].start).toBe(0); // clamped at left edge
    expect(nudged.notes[0].midi).toBe(61);
    expect(nudged.notes[1].start).toBe(0.75);
  });
});

describe('setPatternBars', () => {
  it('drops notes past the new length and clamps stragglers', () => {
    let { pattern } = addNote(createPattern({ bars: 4 }), { midi: 60, start: 0, duration: 1 });
    ({ pattern } = addNote(pattern, { midi: 62, start: 3.5, duration: 2 }));
    ({ pattern } = addNote(pattern, { midi: 64, start: 12, duration: 1 }));

    const shortened = setPatternBars(pattern, 1);
    expect(shortened.bars).toBe(1);
    expect(shortened.notes).toHaveLength(2);
    const straddler = shortened.notes.find((note) => note.midi === 62);
    expect(straddler.start + straddler.duration).toBeLessThanOrEqual(BEATS_PER_BAR);
  });
});

describe('quantize', () => {
  it('rounds and floors to the snap grid, passing through when snap is off', () => {
    expect(quantizeBeats(1.13, 0.25)).toBe(1.25);
    expect(quantizeBeatsFloor(1.13, 0.25)).toBe(1);
    expect(quantizeBeats(1.13, null)).toBe(1.13);
    expect(getSnapBeats('1/16')).toBe(0.25);
    expect(getSnapBeats('off')).toBeNull();
  });
});

describe('isInScale', () => {
  it('matches C major and A natural minor', () => {
    expect(isInScale(60, 0, 'major')).toBe(true);   // C in C major
    expect(isInScale(61, 0, 'major')).toBe(false);  // C# in C major
    expect(isInScale(69, 9, 'natural-minor')).toBe(true); // A in A minor
    expect(isInScale(68, 9, 'natural-minor')).toBe(false); // G# in A minor
  });

  it('maps every D# natural minor pitch class correctly', () => {
    const inScale = [3, 5, 6, 8, 10, 11, 1]; // D#, F, F#, G#, A#, B, C#
    for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
      expect(isInScale(60 + pitchClass, 3, 'natural-minor')).toBe(
        inScale.includes(pitchClass)
      );
    }
  });
});

describe('patternToMidiData', () => {
  it('converts beats to seconds at the pattern bpm, sorted by time', () => {
    let { pattern } = addNote(createPattern({ bpm: 120, bars: 1 }), { midi: 64, start: 2, duration: 1 });
    ({ pattern } = addNote(pattern, { midi: 60, start: 0, duration: 2, velocity: 0.5 }));

    const midiData = patternToMidiData(pattern);
    expect(midiData.duration).toBe(2); // 4 beats at 120bpm
    expect(midiData.notes[0]).toEqual({ midi: 60, time: 0, duration: 1, velocity: 0.5 });
    expect(midiData.notes[1]).toEqual({ midi: 64, time: 1, duration: 0.5, velocity: DEFAULT_VELOCITY });
  });
});
