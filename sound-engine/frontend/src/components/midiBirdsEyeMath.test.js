import { describe, expect, it } from 'vitest';
import {
  buildNoteRenderWindow,
  getVisibleNoteRange,
  lowerBound,
  upperBound
} from './midiBirdsEyeMath.js';

describe('midiBirdsEyeMath', () => {
  it('resolves lower and upper bounds correctly', () => {
    const values = [0, 1, 1, 4, 8, 10];
    expect(lowerBound(values, -1)).toBe(0);
    expect(lowerBound(values, 1)).toBe(1);
    expect(lowerBound(values, 3)).toBe(3);
    expect(upperBound(values, 1)).toBe(3);
    expect(upperBound(values, 10)).toBe(6);
    expect(upperBound(values, 11)).toBe(6);
  });

  it('sorts notes and computes max duration', () => {
    const renderWindow = buildNoteRenderWindow([
      { midi: 62, time: 2.4, duration: 1.5 },
      { midi: 60, time: 0.5, duration: 0.25 },
      { midi: 64, time: 1.8, duration: 0.75 }
    ]);

    expect(renderWindow.startTimes).toEqual([0.5, 1.8, 2.4]);
    expect(renderWindow.maxDuration).toBe(1.5);
    expect(renderWindow.notes[0].endTime).toBe(0.75);
    expect(renderWindow.notes[2].endTime).toBe(3.9);
  });

  it('returns narrowed visible note range using longest note lookback', () => {
    const renderWindow = buildNoteRenderWindow([
      { midi: 60, time: 0, duration: 0.5 },
      { midi: 62, time: 3, duration: 2.5 },
      { midi: 64, time: 6, duration: 1 }
    ]);

    const visible = getVisibleNoteRange({
      startTimes: renderWindow.startTimes,
      nowTime: 4,
      lookBehindSeconds: 1.5,
      lookAheadSeconds: 2,
      maxDuration: renderWindow.maxDuration
    });

    expect(visible.windowStart).toBe(2.5);
    expect(visible.windowEnd).toBe(6);
    expect(visible.startIndex).toBe(0);
    expect(visible.endIndex).toBe(3);
  });
});
