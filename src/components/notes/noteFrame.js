/**
 * The frame every GPU notes style draws from (components/notes/styles/*): the
 * score's notes sorted by start, "now" on the score's own clock and the pitch
 * span to lay them out across. GlNotesView fills one frame object in place on
 * every animation frame; styles only read it.
 */
import { lowerBound, upperBound } from '../midiBirdsEyeMath.js';

// A piece is laid out across its own range, never narrower than three octaves.
export const MIN_PITCH_SPAN = 36;
const EDGE_SEMITONES = 2;

const EMPTY_SCORE = Object.freeze({
  notes: Object.freeze([]),
  startTimes: new Float64Array(0),
  maxDuration: 0,
  duration: 0,
  low: 48,
  high: 84
});

// A stable 0..1 value per note, for styles that scatter or vary notes.
const seedOf = (index) => (Math.imul(index + 1, 2654435761) >>> 0) / 4294967296;

export const resolveScoreDuration = (midi) => {
  const declared = Number(midi?.duration);
  if (Number.isFinite(declared) && declared > 0) return declared;
  let end = 0;
  for (const note of midi?.notes || []) {
    const noteEnd = Number(note?.time) + Math.max(0, Number(note?.duration) || 0);
    if (Number.isFinite(noteEnd) && noteEnd > end) end = noteEnd;
  }
  return end;
};

export const pitchSpanOf = (notes) => {
  if (!notes.length) return { low: EMPTY_SCORE.low, high: EMPTY_SCORE.high };
  let min = 127;
  let max = 0;
  for (const note of notes) {
    if (note.midi < min) min = note.midi;
    if (note.midi > max) max = note.midi;
  }
  let low = min - EDGE_SEMITONES;
  let high = max + EDGE_SEMITONES;
  const missing = MIN_PITCH_SPAN - (high - low);
  if (missing > 0) {
    low -= Math.floor(missing / 2);
    high += Math.ceil(missing / 2);
  }
  if (low < 0) {
    high -= low;
    low = 0;
  }
  if (high > 127) {
    low = Math.max(0, low - (high - 127));
    high = 127;
  }
  return { low, high };
};

/** The score as styles read it; built once per score, never per frame. */
export const prepareScore = (midi) => {
  const source = Array.isArray(midi?.notes) ? midi.notes : [];
  const notes = [];
  for (const note of source) {
    const time = Number(note?.time);
    const duration = Math.max(0, Number(note?.duration) || 0);
    const pitch = Math.round(Number(note?.midi));
    if (!Number.isFinite(time) || !Number.isFinite(pitch)) continue;
    notes.push({
      midi: Math.min(127, Math.max(0, pitch)),
      time,
      duration,
      end: time + duration,
      velocity: Number.isFinite(note.velocity) ? Math.min(1, Math.max(0, note.velocity)) : 0.8,
      channel: Number.isFinite(note.channel) ? note.channel : 0,
      seed: 0
    });
  }
  if (!notes.length) return EMPTY_SCORE;

  notes.sort((a, b) => a.time - b.time || a.midi - b.midi);
  const startTimes = new Float64Array(notes.length);
  let maxDuration = 0;
  notes.forEach((note, index) => {
    note.seed = seedOf(index);
    startTimes[index] = note.time;
    if (note.duration > maxDuration) maxDuration = note.duration;
  });
  return {
    notes,
    startTimes,
    maxDuration,
    duration: resolveScoreDuration(midi),
    ...pitchSpanOf(notes)
  };
};

export const createNoteFrame = () => ({
  // Wall-clock seconds since the view opened; runs on while the music is paused.
  time: 0,
  // Seconds since the previous rendered frame (at most 0.1).
  dt: 0,
  // Seconds into the score, on the audio clock.
  songTime: 0,
  duration: 0,
  playing: false,
  // The song clock moved by a seek, a loop, a new score or a first frame:
  // anything spawned from the previous position should go.
  jumped: true,
  scoreId: 0,
  notes: EMPTY_SCORE.notes,
  startTimes: EMPTY_SCORE.startTimes,
  maxDuration: 0,
  low: EMPTY_SCORE.low,
  high: EMPTY_SCORE.high,
  // CSS pixels, the drawing buffer's pixels and the ratio between them.
  width: 1,
  height: 1,
  pixelWidth: 1,
  pixelHeight: 1,
  dpr: 1,
  // The listener asked for less motion: styles drop decorative movement
  // (flicker, drift, twinkle) and keep the notes themselves moving.
  reducedMotion: false
});

export const applyScore = (frame, score, scoreId) => {
  frame.notes = score.notes;
  frame.startTimes = score.startTimes;
  frame.maxDuration = score.maxDuration;
  frame.duration = score.duration;
  frame.low = score.low;
  frame.high = score.high;
  frame.scoreId = scoreId;
};

/** 0..1 across the width: the centre of the pitch's lane. */
export const pitchX = (frame, midi) => (midi - frame.low + 0.5) / (frame.high - frame.low + 1);

/** One lane's width on the same 0..1 scale. */
export const laneWidth = (frame) => 1 / (frame.high - frame.low + 1);

/**
 * Indices [start, end) of the notes that may sound between songTime - behind
 * and songTime + ahead. Notes inside can still have ended before the window
 * opens (a long note earlier in the list): check `note.end` while drawing.
 */
export const visibleRange = (frame, behind, ahead, out = { start: 0, end: 0 }) => {
  out.start = lowerBound(frame.startTimes, frame.songTime - behind - frame.maxDuration);
  out.end = upperBound(frame.startTimes, frame.songTime + ahead);
  return out;
};

/** Indices [start, end) of the notes that start after `from`, up to and including `to`. */
export const onsetRange = (frame, from, to, out = { start: 0, end: 0 }) => {
  out.start = upperBound(frame.startTimes, from);
  out.end = Math.max(out.start, upperBound(frame.startTimes, to));
  return out;
};
