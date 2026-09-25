import { describe, it, expect } from 'vitest';
import {
  BAR_CHUNK,
  BEATS_PER_BAR,
  MAX_PATTERN_BARS,
  DEFAULT_VELOCITY,
  MIN_NOTE_BEATS,
  PITCH_MAX,
  PITCH_MIN,
  addMetronomeClicks,
  addNote,
  addTrack,
  applyNoteDelta,
  buildChords,
  cloneNotesInPlace,
  copyNotesPayload,
  createPattern,
  deleteNote,
  deleteNotes,
  deleteTrack,
  duplicateNotes,
  legatoNotes,
  MIN_VELOCITY,
  operationTargetIds,
  quantizeNotes,
  reverseNotes,
  setNoteVelocities,
  sliceNotes,
  stretchNotes,
  toggleNotesMuted,
  TRACK_COLORS,
  nudgeNotes,
  normalizePattern,
  pasteNotesPayload,
  resizeNotes,
  snapNotesToScale,
  getSnapBeats,
  invertNotes,
  isInScale,
  isInChord,
  patternBeats,
  patternToMidiData,
  quantizeBeats,
  quantizeBeatsFloor,
  setPatternBars,
  toggleLoopForSelection,
  updateTrack,
  updateNote
} from './pianoRollPattern.js';

describe('createPattern', () => {
  it('creates an empty pattern with clamped bpm and legal bars', () => {
    const pattern = createPattern({ bpm: 999, bars: 3 });
    expect(pattern.notes).toEqual([]);
    expect(pattern.bpm).toBe(240);
    expect(pattern.bars).toBe(4);
    expect(patternBeats(pattern)).toBe(4 * BEATS_PER_BAR);
    expect(pattern.tracks).toHaveLength(1);
    expect(pattern.tracks[0].name).toBe('Lead');
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
      { midi: 60, start: 0, duration: 1, velocity: DEFAULT_VELOCITY, trackId: 'track-1' },
      { midi: 64, start: 1, duration: 0.5, velocity: DEFAULT_VELOCITY, trackId: 'track-1' }
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

  it('supports a chunked long timeline and clamps at the 256-bar cap', () => {
    const expanded = setPatternBars(createPattern(), 200);
    expect(expanded.bars % BAR_CHUNK).toBe(0);
    expect(expanded.bars).toBe(200);
    expect(setPatternBars(expanded, 999).bars).toBe(MAX_PATTERN_BARS);
  });
});

describe('instrument layers', () => {
  it('adds, updates, and deletes tracks with their notes', () => {
    let pattern = createPattern();
    const added = addTrack(pattern, { name: 'Bass', instrument: 'Square' });
    pattern = added.pattern;
    expect(added.track.id).toBe('track-2');
    expect(pattern.tracks).toHaveLength(2);

    pattern = updateTrack(pattern, added.track.id, { muted: true });
    expect(pattern.tracks[1].muted).toBe(true);
    ({ pattern } = addNote(pattern, {
      midi: 36,
      start: 0,
      duration: 1,
      trackId: added.track.id
    }));
    expect(deleteTrack(pattern, added.track.id).notes).toHaveLength(0);
  });

  it('upgrades legacy patterns and keeps same-pitch notes on separate tracks', () => {
    let pattern = normalizePattern({
      name: 'Old loop',
      bpm: 120,
      bars: 4,
      nextNoteId: 2,
      notes: [{ id: 'note-1', midi: 60, start: 0, duration: 1, velocity: 0.8 }]
    });
    expect(pattern.notes[0].trackId).toBe('track-1');
    const added = addTrack(pattern);
    pattern = added.pattern;
    ({ pattern } = addNote(pattern, {
      midi: 60,
      start: 0,
      duration: 1,
      trackId: added.track.id
    }));
    expect(pattern.notes).toHaveLength(2);
  });

  it('filters muted tracks and carries each layer sound into playback data', () => {
    let pattern = createPattern({ bars: 1 });
    const added = addTrack(pattern, { instrument: 'Square', muted: true });
    pattern = updateTrack(added.pattern, 'track-1', {
      soundName: 'Soft lead',
      audioParams: { attack: 0.42, release: 1.2 }
    });
    ({ pattern } = addNote(pattern, { midi: 60, start: 0, duration: 1, trackId: 'track-1' }));
    ({ pattern } = addNote(pattern, { midi: 48, start: 0, duration: 1, trackId: added.track.id }));
    const midiData = patternToMidiData(pattern);
    expect(midiData.notes).toHaveLength(1);
    expect(midiData.notes[0].waveformType).toBe('Sine');
    expect(midiData.notes[0].audioParams).toEqual({ attack: 0.42, release: 1.2 });
  });
});

describe('scale, chord, and loop tools', () => {
  it('snaps selected notes to the nearest scale tone and builds triads', () => {
    let result = addNote(createPattern(), { midi: 61, start: 0, duration: 1 });
    let pattern = result.pattern;
    const selected = new Set([result.note.id]);
    pattern = snapNotesToScale(pattern, selected, 0, 'major');
    expect(pattern.notes[0].midi).toBe(60);
    const chord = buildChords(pattern, selected, 'major');
    expect(chord.pattern.notes.map((note) => note.midi).sort((a, b) => a - b)).toEqual([60, 64, 67]);
  });

  it('does not stack duplicate notes when a chord is built twice', () => {
    const root = addNote(createPattern(), { midi: 60, start: 0, duration: 1 });
    const first = buildChords(root.pattern, new Set([root.note.id]), 'major');
    // The editor selects the whole chord after building it, so a second press
    // runs with all three notes as roots.
    const everyNote = new Set(first.pattern.notes.map((note) => note.id));
    const second = buildChords(first.pattern, everyNote, 'major');

    const voices = second.pattern.notes.map((note) => `${note.midi}@${note.start}`);
    expect(new Set(voices).size).toBe(voices.length);
    expect(voices).toContain('60@0');
    expect(voices).toContain('64@0');
    expect(voices).toContain('67@0');
  });

  it('gives a new layer a colour no other layer is using', () => {
    let pattern = createPattern();
    pattern = addTrack(pattern).pattern;
    pattern = addTrack(pattern).pattern;
    pattern = deleteTrack(pattern, pattern.tracks[0].id);
    const added = addTrack(pattern);
    const colors = added.pattern.tracks.map((track) => track.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('clones selected notes in place so the copies can be nudged away', () => {
    const added = addNote(createPattern(), { midi: 60, start: 1, duration: 1 });
    const selected = new Set([added.note.id]);
    const cloned = cloneNotesInPlace(added.pattern, selected);

    expect(cloned.pattern.notes).toHaveLength(2);
    expect(cloned.pattern.notes[1]).toMatchObject({ midi: 60, start: 1, duration: 1 });
    expect(cloned.noteIds).toEqual(['note-2']);

    const nudged = nudgeNotes(cloned.pattern, new Set(cloned.noteIds), 0.25, 1);
    expect(nudged.notes.map(({ midi, start }) => ({ midi, start }))).toEqual([
      { midi: 60, start: 1 },
      { midi: 61, start: 1.25 }
    ]);
  });

  it('toggles a bar-rounded selection loop and crops playback to it', () => {
    let result = addNote(createPattern({ bars: 4 }), { midi: 60, start: 5, duration: 1 });
    const selected = new Set([result.note.id]);
    let pattern = toggleLoopForSelection(result.pattern, selected);
    expect(pattern.loopRange).toEqual({ start: 4, end: 8, enabled: true });
    const midiData = patternToMidiData(pattern, { useLoopRange: true });
    expect(midiData.duration).toBe(2);
    expect(midiData.notes[0].time).toBe(0.5);
    pattern = toggleLoopForSelection(pattern, selected);
    expect(pattern.loopRange.enabled).toBe(false);
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

describe('isInChord', () => {
  it('matches chord tones across octaves while excluding scale-only tones', () => {
    expect(isInChord(60, 0, 'major')).toBe(true);
    expect(isInChord(64, 0, 'major')).toBe(true);
    expect(isInChord(67, 0, 'major')).toBe(true);
    expect(isInChord(72, 0, 'major')).toBe(true);
    expect(isInChord(62, 0, 'major')).toBe(false);
  });
});

describe('patternToMidiData', () => {
  it('converts beats to seconds at the pattern bpm, sorted by time', () => {
    let { pattern } = addNote(createPattern({ bpm: 120, bars: 1 }), { midi: 64, start: 2, duration: 1 });
    ({ pattern } = addNote(pattern, { midi: 60, start: 0, duration: 2, velocity: 0.5 }));

    const midiData = patternToMidiData(pattern);
    expect(midiData.duration).toBe(2); // 4 beats at 120bpm
    expect(midiData.notes[0]).toMatchObject({ midi: 60, time: 0, duration: 1, velocity: 0.5, trackId: 'track-1', waveformType: 'Sine' });
    expect(midiData.notes[1]).toMatchObject({ midi: 64, time: 1, duration: 0.5, velocity: DEFAULT_VELOCITY, trackId: 'track-1', waveformType: 'Sine' });
  });
});

describe('metronome', () => {
  it('clicks once per beat, accents downbeats, and leaves the notes alone', () => {
    const { pattern } = addNote(createPattern({ bpm: 120, bars: 4 }), { midi: 60, start: 1, duration: 1 });
    const midiData = patternToMidiData(pattern);
    const withClicks = addMetronomeClicks(midiData);
    const clicks = withClicks.notes.filter((note) => note.metronome);

    expect(clicks).toHaveLength(16);
    expect(clicks.map((note) => note.time).slice(0, 5)).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(clicks.filter((note) => note.velocity === 0.9).map((note) => note.time)).toEqual([0, 2, 4, 6]);
    expect(withClicks.notes.filter((note) => !note.metronome)).toEqual(midiData.notes);
    expect(withClicks.duration).toBe(midiData.duration);
    expect(midiData.notes).toHaveLength(1);
  });

  it('keeps the accent on real downbeats when the loop starts mid-bar', () => {
    const clicks = addMetronomeClicks({
      bpm: 60, duration: 6, timelineOffsetBeats: 2.5, notes: []
    }).notes;
    // Loop covers beats 2.5 to 8.5: clicks on beats 3..8, downbeats at 4 and 8.
    expect(clicks.map((note) => note.time)).toEqual([0.5, 1.5, 2.5, 3.5, 4.5, 5.5]);
    expect(clicks.filter((note) => note.velocity === 0.9).map((note) => note.time)).toEqual([1.5, 5.5]);
  });
});

describe('note transforms', () => {
  // Three notes on the first track and one on a second, so every transform can
  // be checked for leaving other notes alone.
  const build = () => {
    let pattern = createPattern({ bars: 4 });
    pattern = addTrack(pattern).pattern;
    const ids = [];
    [
      { midi: 60, start: 0.1, duration: 0.5 },
      { midi: 64, start: 1.05, duration: 0.25 },
      { midi: 67, start: 2, duration: 1 }
    ].forEach((spec) => {
      const result = addNote(pattern, spec);
      pattern = result.pattern;
      ids.push(result.note.id);
    });
    const other = addNote(pattern, { midi: 48, start: 0.1, duration: 0.5, trackId: 'track-2' });
    return { pattern: other.pattern, ids: new Set(ids), otherId: other.note.id };
  };
  const byId = (pattern, id) => pattern.notes.find((note) => note.id === id);

  it('targets the selection, or the whole track when nothing is selected', () => {
    const { pattern, ids, otherId } = build();
    expect(operationTargetIds(pattern, new Set([otherId]), 'track-1')).toEqual(new Set([otherId]));
    expect(operationTargetIds(pattern, new Set(), 'track-1')).toEqual(ids);
  });

  it('quantizes starts onto the grid, fully or part of the way', () => {
    const { pattern, ids, otherId } = build();
    const full = quantizeNotes(pattern, ids, 0.5);
    expect([...ids].map((id) => byId(full, id).start)).toEqual([0, 1, 2]);
    expect(byId(full, otherId).start).toBe(0.1);
    const half = quantizeNotes(pattern, ids, 0.5, 0.5);
    expect(byId(half, 'note-1').start).toBeCloseTo(0.05);
    expect(quantizeNotes(pattern, ids, null)).toBe(pattern);
  });

  it('makes a line legato, moving chord notes together and keeping the last note', () => {
    let { pattern, ids } = build();
    const chordNote = addNote(pattern, { midi: 55, start: 0.1, duration: 0.25 });
    pattern = chordNote.pattern;
    const targets = new Set([...ids, chordNote.note.id]);
    const next = legatoNotes(pattern, targets);
    expect(byId(next, 'note-1').duration).toBeCloseTo(0.95);
    expect(byId(next, chordNote.note.id).duration).toBeCloseTo(0.95);
    expect(byId(next, 'note-2').duration).toBeCloseTo(0.95);
    expect(byId(next, 'note-3').duration).toBe(1);
  });

  it('reverses time and inverts pitch within the span the notes cover', () => {
    const { pattern, ids, otherId } = build(); // span 0.1..3, pitches 60..67
    const reversed = reverseNotes(pattern, ids);
    expect(byId(reversed, 'note-3').start).toBeCloseTo(0.1);
    expect(byId(reversed, 'note-1').start).toBeCloseTo(2.5);
    expect(byId(reversed, otherId).start).toBe(0.1);
    const inverted = invertNotes(pattern, ids);
    expect([...ids].map((id) => byId(inverted, id).midi)).toEqual([67, 63, 60]);
  });

  it('stretches from the first note and grows the timeline when it runs out', () => {
    const { pattern, ids } = build();
    const doubled = stretchNotes(pattern, ids, 2);
    expect(byId(doubled, 'note-3')).toMatchObject({ start: 3.9, duration: 2 });
    expect(doubled.bars).toBe(4);
    const long = stretchNotes(pattern, ids, 8); // last note would end at 23.3 beats
    expect(long.bars).toBe(8);
    expect(byId(long, 'note-3').start + byId(long, 'note-3').duration).toBeCloseTo(23.3);
    const halved = stretchNotes(pattern, ids, 0.5);
    expect(byId(halved, 'note-2')).toMatchObject({ duration: MIN_NOTE_BEATS });
  });

  it('slices notes in two only where both halves stay playable', () => {
    const { pattern, ids } = build();
    const { pattern: cut, noteIds } = sliceNotes(pattern, ids, 2.5);
    expect(noteIds).toHaveLength(1);
    expect(byId(cut, 'note-3')).toMatchObject({ start: 2, duration: 0.5 });
    expect(byId(cut, noteIds[0])).toMatchObject({ start: 2.5, duration: 0.5, midi: 67 });
    expect(cut.nextNoteId).toBe(pattern.nextNoteId + 1);
    expect(sliceNotes(pattern, ids, 2.05).noteIds).toEqual([]);
  });

  it('clamps velocities to the MIDI range', () => {
    const { pattern } = build();
    const next = setNoteVelocities(pattern, new Map([['note-1', 0], ['note-2', 1.4]]));
    expect(byId(next, 'note-1').velocity).toBe(MIN_VELOCITY);
    expect(byId(next, 'note-2').velocity).toBe(1);
  });

  it('mutes notes out of playback, and only an all-muted set comes back', () => {
    const { pattern } = build();
    const muted = toggleNotesMuted(pattern, new Set(['note-1']));
    expect(patternToMidiData(muted).notes.map((note) => note.midi)).not.toContain(60);
    const mixed = toggleNotesMuted(muted, new Set(['note-1', 'note-2']));
    expect(byId(mixed, 'note-1').muted).toBe(true);
    expect(byId(mixed, 'note-2').muted).toBe(true);
    const back = toggleNotesMuted(mixed, new Set(['note-1', 'note-2']));
    expect(byId(back, 'note-1').muted).toBeUndefined();
    expect(patternToMidiData(back).notes).toHaveLength(4);
  });

  it('carries a muted note through copy and paste', () => {
    const { pattern } = build();
    const muted = toggleNotesMuted(pattern, new Set(['note-1']));
    const payload = copyNotesPayload(muted, new Set(['note-1']));
    const pasted = pasteNotesPayload(muted, payload, 4);
    expect(byId(pasted.pattern, pasted.noteIds[0]).muted).toBe(true);
  });

  it('moves saved neon and muted-palette colours onto the current palette', () => {
    const pattern = normalizePattern({
      tracks: [
        { id: 'track-1', color: '#ff2e97' },
        { id: 'track-2', color: '#66a6a8' },
        { id: 'track-3', color: '#123456' }
      ],
      notes: []
    });
    expect(pattern.tracks.map((track) => track.color)).toEqual([TRACK_COLORS[0], TRACK_COLORS[1], '#123456']);
  });
});
