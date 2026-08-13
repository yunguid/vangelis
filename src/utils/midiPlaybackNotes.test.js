import { describe, expect, it } from 'vitest';
import { normalizeMidiNotes } from './midiPlaybackNotes.js';

describe('normalizeMidiNotes', () => {
  it('keeps already sorted notes ordered while normalizing fields', () => {
    const notes = [
      { midi: 59.6, time: -1, duration: 0.2, velocity: 2, instrumentFamily: '  PIANO ' },
      { midi: 64, time: 1, duration: 0.4, velocity: 0.5 }
    ];

    expect(normalizeMidiNotes(notes)).toEqual([
      { midi: 60, time: 0, duration: 0.2, velocity: 1, instrumentFamily: 'piano' },
      { midi: 64, time: 1, duration: 0.4, velocity: 0.5 }
    ]);
  });

  it('sorts unsorted external notes by normalized time', () => {
    const normalized = normalizeMidiNotes([
      { midi: 64, time: 2, duration: 0.1 },
      { midi: 60, time: 0, duration: 0.1 },
      { midi: 62, time: 1, duration: 0.1 }
    ]);

    expect(normalized.map((note) => note.time)).toEqual([0, 1, 2]);
  });

  it('drops invalid pitches and non-positive durations in one pass', () => {
    expect(normalizeMidiNotes([
      { midi: 'bad', time: 0, duration: 1 },
      { midi: 200, time: 0, duration: 1 },
      { midi: 60, time: 0, duration: 0 },
      { midi: 61, time: 0.2, duration: 0.1 }
    ])).toHaveLength(1);
  });
});
