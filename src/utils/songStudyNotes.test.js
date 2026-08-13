import { describe, expect, it } from 'vitest';
import { buildNoteRenderWindow } from '../components/midiBirdsEyeMath.js';
import { getStudyNotesAroundTime } from './songStudyNotes.js';

describe('getStudyNotesAroundTime', () => {
  it('finds sustaining notes that began before the immediate time window', () => {
    const index = buildNoteRenderWindow([
      { midi: 60, time: 1, duration: 4 },
      { midi: 64, time: 4, duration: 0.5 },
      { midi: 67, time: 8, duration: 0.5 }
    ]);

    expect(getStudyNotesAroundTime(index, 4.5).map((note) => note.midi)).toEqual([60, 64]);
  });

  it('returns the nearest upcoming cluster when no note is sounding', () => {
    const index = buildNoteRenderWindow([
      { midi: 60, time: 2, duration: 0.1 },
      { midi: 64, time: 2.1, duration: 0.1 },
      { midi: 67, time: 2.4, duration: 0.1 }
    ]);

    expect(getStudyNotesAroundTime(index, 1.8).map((note) => note.midi)).toEqual([60, 64]);
  });

  it('touches only the indexed local window in a 20,000-note score', () => {
    const index = buildNoteRenderWindow(Array.from({ length: 20_000 }, (_, position) => ({
      midi: 60 + (position % 12),
      time: position,
      duration: 0.1
    })));
    let noteReads = 0;
    index.notes = new Proxy(index.notes, {
      get(target, property, receiver) {
        if (/^\d+$/.test(String(property))) noteReads += 1;
        return Reflect.get(target, property, receiver);
      }
    });

    const notes = getStudyNotesAroundTime(index, 10_000);
    expect(notes).toHaveLength(1);
    expect(noteReads).toBeLessThan(10);
  });
});
