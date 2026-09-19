import { readdirSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { midiNoteToFrequency } from '../utils/math.js';
import { OPENING_SAMPLE_KEYS } from './openingPerformance.js';
import {
  GUITAR_KEY_POSITIONS,
  GUITAR_KEY_TAKES,
  chooseGuitarTake,
  guitarKeyFile,
  guitarPositionFor,
  loadSampledInstrument
} from './sampledInstruments.js';

const cents = (frequency, reference) => 1200 * Math.log2(frequency / reference);

// Stands in for fetch + decodeAudioData: every "recording" is its own file name.
const fakeContext = () => {
  vi.stubGlobal('fetch', vi.fn(async (url) => ({ ok: true, arrayBuffer: async () => url })));
  return { decodeAudioData: async (url) => ({ file: url.split('/').pop() }) };
};

afterEach(() => vi.unstubAllGlobals());

describe('nylon guitar recordings', () => {
  it('lists exactly the takes that ship in public/samples/nylon-guitar/keys', () => {
    const listed = GUITAR_KEY_POSITIONS.flatMap((position) => (
      GUITAR_KEY_TAKES.map((take) => `${guitarKeyFile(position, take)}.mp3`)
    ));
    const shipped = readdirSync('public/samples/nylon-guitar/keys').map((file) => `keys/${file}`);
    expect(listed.sort()).toEqual(shipped.sort());
  });

  it('plays every key from E2 to B5 within a semitone of a recording', () => {
    for (let midi = 40; midi <= 83; midi += 1) {
      expect(Math.abs(guitarPositionFor(midi).midi - midi)).toBeLessThanOrEqual(1);
    }
    expect(guitarPositionFor(41).name).toBe('s6f2'); // F2: the fretted F#2, not the open E string
    expect(guitarPositionFor(61).name).toBe('s2f1'); // C#4: of two equally near, the lower
  });

  it('matches the take to the touch, and never repeats a recording back to back', () => {
    const position = guitarPositionFor(57);
    const lastPluck = new Map();
    expect(chooseGuitarTake(lastPluck, position, 1, 0)).toBe('ff');
    expect(chooseGuitarTake(lastPluck, position, 1, 0.4)).toBe('mf');
    expect(chooseGuitarTake(lastPluck, position, 1, 0.8)).toBe('ff');
    expect(chooseGuitarTake(lastPluck, position, 0.55, 5)).toBe('mf');
    expect(chooseGuitarTake(lastPluck, position, 0.55, 5.5)).toBe('ff');
    expect(chooseGuitarTake(lastPluck, position, 0.55, 9)).toBe('mf'); // long enough ago to repeat
  });

  it('plays the keys through the takes, in tune', async () => {
    const guitar = await loadSampledInstrument(fakeContext(), 'nylon-guitar');
    const borrowed = guitar.pick(midiNoteToFrequency(61), 0.55, 0); // C#4 is not recorded
    expect(borrowed.buffer).toEqual({ file: 's2f1mf.mp3' }); // C4, played a semitone up
    // Drifts at most three cents from pluck to pluck (3.01: the log is not exact).
    expect(Math.abs(cents(borrowed.baseFrequency, midiNoteToFrequency(60)))).toBeLessThan(3.01);
    expect(borrowed.velocity).toBeLessThan(0.55);
  });
});

describe('grand piano recordings', () => {
  it('plays every key from D2 to A#5 within a semitone of a recording', async () => {
    const piano = await loadSampledInstrument(fakeContext(), 'opening-piano');
    const recorded = new Map(OPENING_SAMPLE_KEYS.map(([key, midi]) => [`${key}.mp3`, midi]));
    for (let midi = 38; midi <= 82; midi += 1) {
      const { buffer, baseFrequency, velocity } = piano.pick(midiNoteToFrequency(midi), 0.7, 0);
      expect(Math.abs(recorded.get(buffer.file) - midi)).toBeLessThanOrEqual(1);
      expect(baseFrequency).toBeCloseTo(midiNoteToFrequency(recorded.get(buffer.file)), 6);
      expect(velocity).toBe(0.7);
    }
  });
});

it('rejects an instrument it has no recordings for', async () => {
  await expect(loadSampledInstrument({}, 'theremin')).rejects.toThrow(/theremin/);
});
