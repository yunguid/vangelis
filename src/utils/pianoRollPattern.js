/**
 * Pure pattern model for the piano-roll editor.
 *
 * Patterns live in the beats domain (4/4, BEATS_PER_BAR beats per bar) so
 * editing math is exact at any tempo; `patternToMidiData` converts to the
 * seconds-domain shape `useMidiPlayback` consumes. All ops are pure and
 * return new objects (React state friendly).
 */

export const BEATS_PER_BAR = 4;
export const DEFAULT_VELOCITY = 0.78;
export const MIN_NOTE_BEATS = 1 / 8;
export const PITCH_MIN = 24; // C1
export const PITCH_MAX = 107; // B7
export const BAR_OPTIONS = [1, 2, 4, 8];
export const BPM_MIN = 40;
export const BPM_MAX = 240;

export const SNAP_OPTIONS = [
  { id: '1/4', label: '1/4', beats: 1 },
  { id: '1/8', label: '1/8', beats: 1 / 2 },
  { id: '1/16', label: '1/16', beats: 1 / 4 },
  { id: '1/32', label: '1/32', beats: 1 / 8 },
  { id: '1/4T', label: '1/4T', beats: 2 / 3 },
  { id: '1/8T', label: '1/8T', beats: 1 / 3 },
  { id: '1/16T', label: '1/16T', beats: 1 / 6 },
  { id: 'off', label: 'Off', beats: null }
];

export const getSnapBeats = (snapId) => (
  SNAP_OPTIONS.find((option) => option.id === snapId)?.beats ?? null
);

/** Pitch-class interval sets, root-relative. */
export const SCALES = [
  { id: 'major', label: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'natural-minor', label: 'Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'harmonic-minor', label: 'Harmonic minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'dorian', label: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'mixolydian', label: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'pent-major', label: 'Pentatonic major', intervals: [0, 2, 4, 7, 9] },
  { id: 'pent-minor', label: 'Pentatonic minor', intervals: [0, 3, 5, 7, 10] }
];

export const SCALE_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const isInScale = (midi, rootPitchClass, scaleId) => {
  const scale = SCALES.find((entry) => entry.id === scaleId);
  if (!scale) return false;
  const interval = (((midi - rootPitchClass) % 12) + 12) % 12;
  return scale.intervals.includes(interval);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const createPattern = ({ name = 'Untitled loop', bpm = 120, bars = 4 } = {}) => ({
  name,
  bpm: clamp(Math.round(bpm), BPM_MIN, BPM_MAX),
  bars: BAR_OPTIONS.includes(bars) ? bars : 4,
  nextNoteId: 1,
  notes: []
});

export const patternBeats = (pattern) => pattern.bars * BEATS_PER_BAR;

export const quantizeBeats = (beats, snapBeats) => (
  snapBeats ? Math.round(beats / snapBeats) * snapBeats : beats
);

export const quantizeBeatsFloor = (beats, snapBeats) => (
  snapBeats ? Math.floor(beats / snapBeats + 1e-6) * snapBeats : beats
);

const clampNoteToPattern = (pattern, note) => {
  const total = patternBeats(pattern);
  const start = clamp(note.start, 0, total - MIN_NOTE_BEATS);
  const duration = clamp(note.duration, MIN_NOTE_BEATS, total - start);
  const midi = clamp(Math.round(note.midi), PITCH_MIN, PITCH_MAX);
  return { ...note, start, duration, midi };
};

const overlaps = (a, b) => a.start < b.start + b.duration - 1e-6
  && b.start < a.start + a.duration - 1e-6;

/**
 * Add a note. Same-pitch notes overlapping the new span are removed first
 * (FL-style: one note per row per time range).
 */
export const addNote = (pattern, { midi, start, duration, velocity = DEFAULT_VELOCITY }) => {
  const note = clampNoteToPattern(pattern, {
    id: `note-${pattern.nextNoteId}`,
    midi,
    start,
    duration,
    velocity
  });
  const kept = pattern.notes.filter((existing) => (
    existing.midi !== note.midi || !overlaps(existing, note)
  ));
  return {
    pattern: {
      ...pattern,
      nextNoteId: pattern.nextNoteId + 1,
      notes: [...kept, note]
    },
    note
  };
};

/** Move/resize by id; the patch is clamped to pattern bounds. */
export const updateNote = (pattern, noteId, patch) => ({
  ...pattern,
  notes: pattern.notes.map((note) => (
    note.id === noteId ? clampNoteToPattern(pattern, { ...note, ...patch }) : note
  ))
});

/**
 * Translate a group of notes by the same beat/pitch delta, relative to the
 * grab-time origins so accumulated drag error can't creep in. Each note is
 * clamped to pattern bounds independently.
 * @param {Object} pattern
 * @param {Map<string, {start: number, midi: number}>} originById
 * @param {number} deltaBeats
 * @param {number} deltaMidi
 */
export const applyNoteDelta = (pattern, originById, deltaBeats, deltaMidi) => ({
  ...pattern,
  notes: pattern.notes.map((note) => {
    const origin = originById.get(note.id);
    if (!origin) return note;
    return clampNoteToPattern(pattern, {
      ...note,
      start: origin.start + deltaBeats,
      midi: origin.midi + deltaMidi
    });
  })
});

export const deleteNotes = (pattern, noteIds) => {
  const ids = noteIds instanceof Set ? noteIds : new Set(noteIds);
  return {
    ...pattern,
    notes: pattern.notes.filter((note) => !ids.has(note.id))
  };
};

/** Snapshot selected notes into an id-free clipboard payload. */
export const copyNotesPayload = (pattern, noteIds) => {
  const ids = noteIds instanceof Set ? noteIds : new Set(noteIds);
  return pattern.notes
    .filter((note) => ids.has(note.id))
    .map(({ midi, start, duration, velocity }) => ({ midi, start, duration, velocity }))
    .sort((a, b) => a.start - b.start || a.midi - b.midi);
};

/**
 * Paste a clipboard payload at its original positions (plus an optional beat
 * offset). Same-pitch overlaps are replaced, matching addNote. Returns the
 * new pattern and the pasted note ids so the caller can select them.
 */
export const pasteNotesPayload = (pattern, payload, beatOffset = 0) => {
  let next = pattern;
  const noteIds = [];
  payload.forEach((entry) => {
    const start = entry.start + beatOffset;
    if (start >= patternBeats(pattern) - 1e-6) return;
    const result = addNote(next, { ...entry, start });
    next = result.pattern;
    noteIds.push(result.note.id);
  });
  return { pattern: next, noteIds };
};

/**
 * Duplicate a selection immediately to its right (FL's paste-to-the-right):
 * the copy lands one selection-span later, span rounded up to the snap grid
 * so duplicates stay grid-aligned.
 */
export const duplicateNotes = (pattern, noteIds, snapBeats = null) => {
  const payload = copyNotesPayload(pattern, noteIds);
  if (payload.length === 0) return { pattern, noteIds: [] };
  const minStart = Math.min(...payload.map((entry) => entry.start));
  const maxEnd = Math.max(...payload.map((entry) => entry.start + entry.duration));
  const rawSpan = maxEnd - minStart;
  const span = snapBeats
    ? Math.max(Math.ceil(rawSpan / snapBeats - 1e-6) * snapBeats, snapBeats)
    : rawSpan;
  return pasteNotesPayload(pattern, payload, span);
};

/**
 * Resize a selection by a beat delta. edge 'right' grows/shrinks the tail
 * (start fixed); edge 'left' trims the head (end fixed). Each note clamps
 * independently to MIN_NOTE_BEATS and the pattern bounds.
 */
export const resizeNotes = (pattern, noteIds, deltaBeats, edge = 'right') => {
  const ids = noteIds instanceof Set ? noteIds : new Set(noteIds);
  const total = patternBeats(pattern);
  return {
    ...pattern,
    notes: pattern.notes.map((note) => {
      if (!ids.has(note.id)) return note;
      if (edge === 'left') {
        const end = note.start + note.duration;
        const start = Math.min(Math.max(note.start + deltaBeats, 0), end - MIN_NOTE_BEATS);
        return { ...note, start, duration: end - start };
      }
      const duration = Math.min(
        Math.max(note.duration + deltaBeats, MIN_NOTE_BEATS),
        total - note.start
      );
      return { ...note, duration };
    })
  };
};

/** Translate a selection in place; origins are taken from current positions. */
export const nudgeNotes = (pattern, noteIds, deltaBeats, deltaMidi) => {
  const ids = noteIds instanceof Set ? noteIds : new Set(noteIds);
  const origins = new Map();
  pattern.notes.forEach((note) => {
    if (ids.has(note.id)) origins.set(note.id, { start: note.start, midi: note.midi });
  });
  return applyNoteDelta(pattern, origins, deltaBeats, deltaMidi);
};

export const deleteNote = (pattern, noteId) => ({
  ...pattern,
  notes: pattern.notes.filter((note) => note.id !== noteId)
});

export const setPatternBars = (pattern, bars) => {
  const next = { ...pattern, bars: BAR_OPTIONS.includes(bars) ? bars : pattern.bars };
  return {
    ...next,
    notes: pattern.notes
      .filter((note) => note.start < patternBeats(next) - 1e-6)
      .map((note) => clampNoteToPattern(next, note))
  };
};

/** Convert to the seconds-domain shape `useMidiPlayback.play` consumes. */
export const patternToMidiData = (pattern) => {
  const secondsPerBeat = 60 / pattern.bpm;
  return {
    name: pattern.name,
    bpm: pattern.bpm,
    duration: patternBeats(pattern) * secondsPerBeat,
    notes: [...pattern.notes]
      .sort((a, b) => a.start - b.start || a.midi - b.midi)
      .map((note) => ({
        midi: note.midi,
        time: note.start * secondsPerBeat,
        duration: note.duration * secondsPerBeat,
        velocity: note.velocity
      }))
  };
};
