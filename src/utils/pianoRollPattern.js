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
export const BAR_CHUNK = 4;
export const MAX_PATTERN_BARS = 256;
// Kept for compatibility with compact legacy patterns; the editor's timeline
// controls use BAR_CHUNK and MAX_PATTERN_BARS for new projects.
export const BAR_OPTIONS = [1, 2, 4, 8];
export const BPM_MIN = 40;
export const BPM_MAX = 240;

export const TRACK_COLORS = ['#e8783d', '#66a6a8', '#c295d8', '#d6b85a', '#6f91c9', '#d56f82'];
export const TRACK_INSTRUMENTS = ['Sine', 'Sawtooth', 'Square', 'Triangle'];

export const CHORD_TYPES = [
  { id: 'major', label: 'Major', intervals: [0, 4, 7] },
  { id: 'minor', label: 'Minor', intervals: [0, 3, 7] },
  { id: 'diminished', label: 'Diminished', intervals: [0, 3, 6] },
  { id: 'sus2', label: 'Sus 2', intervals: [0, 2, 7] },
  { id: 'sus4', label: 'Sus 4', intervals: [0, 5, 7] },
  { id: 'power', label: 'Power', intervals: [0, 7, 12] }
];

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

export const isInChord = (midi, rootPitchClass, chordTypeId) => {
  const chord = CHORD_TYPES.find((entry) => entry.id === chordTypeId);
  if (!chord) return false;
  const interval = (((midi - rootPitchClass) % 12) + 12) % 12;
  return chord.intervals.some((entry) => entry % 12 === interval);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeBars = (bars, fallback = 4) => {
  const numeric = Math.round(Number(bars));
  return Number.isFinite(numeric) ? clamp(numeric, 1, MAX_PATTERN_BARS) : fallback;
};

const createDefaultTrack = (index = 0, id = `track-${index + 1}`) => ({
  id,
  name: index === 0 ? 'Lead' : `Layer ${index + 1}`,
  color: TRACK_COLORS[index % TRACK_COLORS.length],
  instrument: TRACK_INSTRUMENTS[index % TRACK_INSTRUMENTS.length],
  muted: false,
  solo: false
});

export const createPattern = ({ name = 'Untitled loop', bpm = 120, bars = 4 } = {}) => ({
  name,
  bpm: clamp(Math.round(bpm), BPM_MIN, BPM_MAX),
  bars: BAR_OPTIONS.includes(Number(bars)) ? Number(bars) : 4,
  nextNoteId: 1,
  nextTrackId: 2,
  tracks: [createDefaultTrack()],
  loopRange: null,
  notes: []
});

/** Upgrade older saved patterns to the current tracks + loop schema. */
export const normalizePattern = (pattern) => {
  const source = pattern && typeof pattern === 'object' ? pattern : {};
  const rawTracks = Array.isArray(source.tracks) && source.tracks.length > 0
    ? source.tracks
    : [createDefaultTrack()];
  const tracks = rawTracks.map((track, index) => ({
    ...createDefaultTrack(index, track?.id || `track-${index + 1}`),
    ...track,
    id: track?.id || `track-${index + 1}`,
    name: String(track?.name || `Layer ${index + 1}`).slice(0, 32),
    instrument: TRACK_INSTRUMENTS.includes(track?.instrument) ? track.instrument : TRACK_INSTRUMENTS[index % TRACK_INSTRUMENTS.length],
    color: track?.color || TRACK_COLORS[index % TRACK_COLORS.length],
    muted: Boolean(track?.muted),
    solo: Boolean(track?.solo)
  }));
  const trackIds = new Set(tracks.map((track) => track.id));
  const fallbackTrackId = tracks[0].id;
  const notes = Array.isArray(source.notes) ? source.notes.map((note) => ({
    ...note,
    trackId: trackIds.has(note?.trackId) ? note.trackId : fallbackTrackId
  })) : [];
  const highestTrackNumber = tracks.reduce((highest, track) => {
    const match = /^track-(\d+)$/.exec(track.id);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  const loopRange = source.loopRange
    && Number.isFinite(source.loopRange.start)
    && Number.isFinite(source.loopRange.end)
    && source.loopRange.end > source.loopRange.start
    ? {
        start: Math.max(0, source.loopRange.start),
        end: Math.min(normalizeBars(source.bars) * BEATS_PER_BAR, source.loopRange.end),
        enabled: Boolean(source.loopRange.enabled)
      }
    : null;
  return {
    ...source,
    name: String(source.name || 'Untitled loop'),
    bpm: clamp(Math.round(Number(source.bpm) || 120), BPM_MIN, BPM_MAX),
    bars: normalizeBars(source.bars),
    nextNoteId: Math.max(1, Math.round(Number(source.nextNoteId) || 1)),
    nextTrackId: Math.max(highestTrackNumber + 1, Math.round(Number(source.nextTrackId) || 1)),
    tracks,
    loopRange: loopRange && loopRange.end > loopRange.start ? loopRange : null,
    notes
  };
};

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
export const addNote = (pattern, {
  midi,
  start,
  duration,
  velocity = DEFAULT_VELOCITY,
  trackId = pattern.tracks?.[0]?.id || 'track-1'
}) => {
  const note = clampNoteToPattern(pattern, {
    id: `note-${pattern.nextNoteId}`,
    midi,
    start,
    duration,
    velocity,
    trackId
  });
  const kept = pattern.notes.filter((existing) => (
    existing.trackId !== note.trackId
    || existing.midi !== note.midi
    || !overlaps(existing, note)
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
    .map(({ midi, start, duration, velocity, trackId }) => ({ midi, start, duration, velocity, trackId }))
    .sort((a, b) => a.start - b.start || a.midi - b.midi);
};

/**
 * Paste a clipboard payload at its original positions (plus an optional beat
 * offset). Same-pitch overlaps are replaced, matching addNote. Returns the
 * new pattern and the pasted note ids so the caller can select them.
 */
export const pasteNotesPayload = (pattern, payload, beatOffset = 0, targetTrackId = null) => {
  let next = pattern;
  const noteIds = [];
  payload.forEach((entry) => {
    const start = entry.start + beatOffset;
    if (start >= patternBeats(pattern) - 1e-6) return;
    const result = addNote(next, {
      ...entry,
      start,
      trackId: targetTrackId || entry.trackId
    });
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
 * Clone a selection at the same pitch and time. Overlap is intentional: the
 * returned ids let the editor select only the copies so an immediate arrow
 * nudge can peel them away from their originals.
 */
export const cloneNotesInPlace = (pattern, noteIds) => {
  const ids = noteIds instanceof Set ? noteIds : new Set(noteIds);
  const sourceNotes = pattern.notes.filter((note) => ids.has(note.id));
  if (sourceNotes.length === 0) return { pattern, noteIds: [] };

  let nextNoteId = pattern.nextNoteId;
  const clones = sourceNotes.map((note) => ({
    ...note,
    id: `note-${nextNoteId++}`
  }));

  return {
    pattern: {
      ...pattern,
      nextNoteId,
      notes: [...pattern.notes, ...clones]
    },
    noteIds: clones.map((note) => note.id)
  };
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

export const addTrack = (pattern, overrides = {}) => {
  const index = pattern.tracks?.length || 0;
  const id = `track-${pattern.nextTrackId || index + 1}`;
  const track = { ...createDefaultTrack(index, id), ...overrides, id };
  return {
    pattern: {
      ...pattern,
      nextTrackId: (pattern.nextTrackId || index + 1) + 1,
      tracks: [...(pattern.tracks || []), track]
    },
    track
  };
};

export const updateTrack = (pattern, trackId, patch) => ({
  ...pattern,
  tracks: pattern.tracks.map((track) => (
    track.id === trackId ? { ...track, ...patch, id: track.id } : track
  ))
});

export const deleteTrack = (pattern, trackId) => {
  if (!pattern.tracks.some((track) => track.id === trackId) || pattern.tracks.length <= 1) {
    return pattern;
  }
  return {
    ...pattern,
    tracks: pattern.tracks.filter((track) => track.id !== trackId),
    notes: pattern.notes.filter((note) => note.trackId !== trackId)
  };
};

/** Add a chord above every selected root note, preserving its track and span. */
export const buildChords = (pattern, noteIds, chordTypeId = 'major') => {
  const ids = noteIds instanceof Set ? noteIds : new Set(noteIds);
  const chord = CHORD_TYPES.find((entry) => entry.id === chordTypeId) || CHORD_TYPES[0];
  const roots = pattern.notes.filter((note) => ids.has(note.id));
  let next = pattern;
  const addedNoteIds = [];
  roots.forEach((root) => {
    chord.intervals.slice(1).forEach((interval) => {
      if (root.midi + interval > PITCH_MAX) return;
      const result = addNote(next, {
        midi: root.midi + interval,
        start: root.start,
        duration: root.duration,
        velocity: root.velocity,
        trackId: root.trackId
      });
      next = result.pattern;
      addedNoteIds.push(result.note.id);
    });
  });
  return { pattern: next, noteIds: addedNoteIds };
};

const nearestScaleMidi = (midi, rootPitchClass, scaleId) => {
  if (!SCALES.some((scale) => scale.id === scaleId)) return midi;
  if (isInScale(midi, rootPitchClass, scaleId)) return midi;
  for (let distance = 1; distance < 12; distance += 1) {
    const down = midi - distance;
    const up = midi + distance;
    if (down >= PITCH_MIN && isInScale(down, rootPitchClass, scaleId)) return down;
    if (up <= PITCH_MAX && isInScale(up, rootPitchClass, scaleId)) return up;
  }
  return midi;
};

export const snapNotesToScale = (pattern, noteIds, rootPitchClass, scaleId) => {
  const ids = noteIds instanceof Set ? noteIds : new Set(noteIds);
  return {
    ...pattern,
    notes: pattern.notes.map((note) => (
      ids.has(note.id)
        ? { ...note, midi: nearestScaleMidi(note.midi, rootPitchClass, scaleId) }
        : note
    ))
  };
};

export const snapMidiToScale = nearestScaleMidi;

/** Shift+Cmd/Ctrl+L: toggle a bar-rounded loop spanning selected notes. */
export const toggleLoopForSelection = (pattern, noteIds) => {
  if (pattern.loopRange?.enabled) {
    return { ...pattern, loopRange: { ...pattern.loopRange, enabled: false } };
  }
  const ids = noteIds instanceof Set ? noteIds : new Set(noteIds);
  const selected = pattern.notes.filter((note) => ids.has(note.id));
  if (selected.length === 0) return pattern;
  const start = Math.floor(Math.min(...selected.map((note) => note.start)) / BEATS_PER_BAR) * BEATS_PER_BAR;
  const maxEnd = Math.max(...selected.map((note) => note.start + note.duration));
  const end = Math.min(
    patternBeats(pattern),
    Math.max(start + BEATS_PER_BAR, Math.ceil(maxEnd / BEATS_PER_BAR) * BEATS_PER_BAR)
  );
  return { ...pattern, loopRange: { start, end, enabled: true } };
};

export const setPatternBars = (pattern, bars) => {
  const next = { ...pattern, bars: normalizeBars(bars, pattern.bars) };
  const total = patternBeats(next);
  return {
    ...next,
    loopRange: next.loopRange
      ? {
          ...next.loopRange,
          end: Math.min(next.loopRange.end, total),
          enabled: next.loopRange.enabled && next.loopRange.start < total
        }
      : null,
    notes: pattern.notes
      .filter((note) => note.start < patternBeats(next) - 1e-6)
      .map((note) => clampNoteToPattern(next, note))
  };
};

/** Convert to the seconds-domain shape `useMidiPlayback.play` consumes. */
export const patternToMidiData = (pattern, { useLoopRange = false } = {}) => {
  const secondsPerBeat = 60 / pattern.bpm;
  const soloedTrackIds = new Set(pattern.tracks?.filter((track) => track.solo).map((track) => track.id));
  const audibleTracks = new Map((pattern.tracks || []).map((track) => [track.id, track]));
  const loop = useLoopRange && pattern.loopRange?.enabled ? pattern.loopRange : null;
  const startBeat = loop?.start || 0;
  const endBeat = loop?.end || patternBeats(pattern);
  return {
    name: pattern.name,
    bpm: pattern.bpm,
    duration: (endBeat - startBeat) * secondsPerBeat,
    timelineOffsetBeats: startBeat,
    notes: [...pattern.notes]
      .filter((note) => {
        const track = audibleTracks.get(note.trackId) || pattern.tracks?.[0];
        if (track?.muted) return false;
        if (soloedTrackIds.size > 0 && !soloedTrackIds.has(note.trackId)) return false;
        return note.start < endBeat && note.start + note.duration > startBeat;
      })
      .sort((a, b) => a.start - b.start || a.midi - b.midi)
      .map((note) => {
        const track = audibleTracks.get(note.trackId) || pattern.tracks?.[0];
        const clippedStart = Math.max(note.start, startBeat);
        const clippedEnd = Math.min(note.start + note.duration, endBeat);
        return {
          midi: note.midi,
          time: (clippedStart - startBeat) * secondsPerBeat,
          duration: (clippedEnd - clippedStart) * secondsPerBeat,
          velocity: note.velocity,
          trackId: note.trackId,
          trackName: track?.name,
          waveformType: track?.instrument,
          audioParams: track?.audioParams
        };
      })
  };
};
