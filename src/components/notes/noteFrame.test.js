import { describe, expect, it } from 'vitest';
import {
  MIN_PITCH_SPAN,
  applyScore,
  createNoteFrame,
  onsetRange,
  pitchSpanOf,
  pitchX,
  prepareScore,
  visibleRange
} from './noteFrame.js';

const frameFor = (notes, songTime = 0) => {
  const frame = createNoteFrame();
  applyScore(frame, prepareScore({ notes }), 1);
  frame.songTime = songTime;
  return frame;
};

describe('prepareScore', () => {
  it('sorts the notes, ends them and keeps each one the same seed on every build', () => {
    const source = [
      { midi: 64, time: 2, duration: 0.5, velocity: 0.5 },
      { midi: 60, time: 0, duration: 1, velocity: 2 },
      { midi: 'x', time: 1, duration: 1 }
    ];
    const score = prepareScore({ notes: source });
    expect(score.notes.map((note) => [note.midi, note.time, note.end])).toEqual([[60, 0, 1], [64, 2, 2.5]]);
    expect(score.notes[0].velocity).toBe(1);
    expect(score.duration).toBe(2.5);
    expect(prepareScore({ notes: source }).notes.map((note) => note.seed))
      .toEqual(score.notes.map((note) => note.seed));
  });

  it('lays a narrow piece across three octaves and keeps a wide one inside MIDI', () => {
    const narrow = pitchSpanOf([{ midi: 60 }, { midi: 64 }]);
    expect(narrow.high - narrow.low).toBe(MIN_PITCH_SPAN);
    expect(narrow.low).toBeLessThan(60);
    expect(narrow.high).toBeGreaterThan(64);
    const low = pitchSpanOf([{ midi: 1 }, { midi: 3 }]);
    expect(low.low).toBe(0);
    expect(low.high - low.low).toBe(MIN_PITCH_SPAN);
  });
});

describe('the frame windows', () => {
  it('keeps a long held note in view after later notes have started', () => {
    const frame = frameFor([
      { midi: 36, time: 0, duration: 30 },
      { midi: 60, time: 10, duration: 0.5 },
      { midi: 62, time: 19, duration: 0.5 },
      { midi: 64, time: 40, duration: 0.5 }
    ], 20);
    const range = visibleRange(frame, 1, 5);
    const shown = frame.notes.slice(range.start, range.end)
      .filter((note) => note.end >= frame.songTime - 1)
      .map((note) => note.midi);
    expect(shown).toEqual([36, 62]);
  });

  it('reports each onset once as the clock moves on, and chords together', () => {
    const frame = frameFor([
      { midi: 60, time: 1, duration: 1 },
      { midi: 64, time: 1, duration: 1 },
      { midi: 67, time: 1.5, duration: 1 }
    ]);
    const seen = [];
    let previous = 0;
    for (const now of [0.5, 1, 1.2, 1.5, 2]) {
      const range = onsetRange(frame, previous, now);
      for (let index = range.start; index < range.end; index += 1) seen.push([now, frame.notes[index].midi]);
      previous = now;
    }
    expect(seen).toEqual([[1, 60], [1, 64], [1.5, 67]]);
  });

  it('puts the lowest and highest pitch inside the edges', () => {
    const frame = frameFor([{ midi: 40, time: 0, duration: 1 }, { midi: 90, time: 0, duration: 1 }]);
    expect(pitchX(frame, 40)).toBeGreaterThan(0);
    expect(pitchX(frame, 90)).toBeLessThan(1);
    expect(pitchX(frame, 40)).toBeLessThan(pitchX(frame, 90));
  });
});
