import { describe, expect, it } from 'vitest';
import {
  instrumentMatchesMidiRange,
  noteIdToMidi,
  pickBestInstrumentCandidate
} from './instrumentSelection.js';

describe('instrumentSelection', () => {
  it('parses note ids into midi numbers', () => {
    expect(noteIdToMidi('C4')).toBe(60);
    expect(noteIdToMidi('A4')).toBe(69);
    expect(noteIdToMidi('F#5')).toBe(78);
    expect(noteIdToMidi('bad')).toBeNull();
  });

  it('matches midi notes against optional min/max ranges', () => {
    expect(instrumentMatchesMidiRange({ minMidi: 50, maxMidi: 70 }, 60)).toBe(true);
    expect(instrumentMatchesMidiRange({ minMidi: 50, maxMidi: 70 }, 49)).toBe(false);
    expect(instrumentMatchesMidiRange({ minMidi: 50 }, 49)).toBe(false);
    expect(instrumentMatchesMidiRange({ maxMidi: 70 }, 71)).toBe(false);
    expect(instrumentMatchesMidiRange({ minMidi: 50, maxMidi: 70 }, undefined)).toBe(true);
  });

  it('prefers in-range candidate closest to midi note', () => {
    const selected = pickBestInstrumentCandidate(
      [
        { id: 'piano-low', baseNote: 'C2', minMidi: 21, maxMidi: 55 },
        { id: 'piano-mid', baseNote: 'C4', minMidi: 56, maxMidi: 79 },
        { id: 'piano-high', baseNote: 'C6', minMidi: 80, maxMidi: 108 }
      ],
      73
    );

    expect(selected?.id).toBe('piano-mid');
  });

  it('falls back to nearest base note when no ranges match', () => {
    const selected = pickBestInstrumentCandidate(
      [
        { id: 'close', baseMidi: 63, minMidi: 1, maxMidi: 20 },
        { id: 'far', baseMidi: 95, minMidi: 90, maxMidi: 127 }
      ],
      64
    );

    expect(selected?.id).toBe('close');
  });
});
