import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { arrangeOpeningPerformance, OPENING_SAMPLE_KEYS } from './openingPerformance.js';

const bytes = readFileSync('public/midi/subwoofer-lullaby.mid');
const source = new Midi(bytes);
const anchors = OPENING_SAMPLE_KEYS.map(([, midi]) => ({ midi }));
const arranged = arrangeOpeningPerformance({ bpm: source.header.tempos[0].bpm,
  notes: source.tracks.flatMap((track) => track.notes).sort((a,b) => a.time-b.time) }, anchors);

it('renders the complete pinned transcription in the piano register with bounded sample shifts', () => {
  expect(arranged.notes).toHaveLength(356);
  expect(arranged.notes.slice(0,6).map((note) => note.midi)).toEqual([57,61,68,64,61,68]);
  expect(arranged.duration).toBeGreaterThan(180);
  expect(arranged.duration).toBeLessThan(195);
  expect(arranged.notes.every((note) => Math.abs(note.midi-note.sample.midi) <= 1)).toBe(true);
  expect(arranged.notes.every((note) => note.duration > 0 && note.velocity > 0 && note.velocity <= 1)).toBe(true);
  const digest = createHash('sha256').update(bytes).digest('hex');
  expect(readFileSync('docs/OPENING_PERFORMANCE.md', 'utf8')).toContain(digest);
  for (const [key] of OPENING_SAMPLE_KEYS) {
    expect(existsSync(`public/samples/opening/${key}.mp3`)).toBe(true);
  }
});

describe('pedalling', () => {
  it('lets a held harmony ring until the bass changes two bars later', () => {
    const chord = arranged.notes.filter((note) => Math.abs(note.time - 22 * 3.2) < 1e-6);
    expect(chord.map((note) => note.midi).sort((a,b) => a-b)).toEqual([45,52,61,81]);
    chord.forEach((note) => expect(note.duration).toBeCloseTo(6.4, 3));
  });

  it('lifts a repeated key just before it is struck again', () => {
    const [first, second] = arranged.notes.filter((note) => note.midi === 61);
    expect(first.time + first.duration).toBeLessThan(second.time);
    expect(first.time + first.duration).toBeGreaterThan(second.time - 0.2);
  });

  it('never holds a note past the end of its recording', () => {
    expect(Math.max(...arranged.notes.map((note) => note.duration))).toBeLessThanOrEqual(8);
  });
});
