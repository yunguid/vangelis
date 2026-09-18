import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { arrangeOpeningPerformance } from './openingPerformance.js';

it('renders the complete pinned transcription in the piano register with bounded sample shifts', () => {
  const bytes = readFileSync('public/midi/subwoofer-lullaby.mid');
  const source = new Midi(bytes);
  const anchors = [36,43,48,55,60,67,72,79,84].map((midi) => ({ midi }));
  const arranged = arrangeOpeningPerformance({ bpm: source.header.tempos[0].bpm,
    notes: source.tracks.flatMap((track) => track.notes).sort((a,b) => a.time-b.time) }, anchors);
  expect(arranged.notes).toHaveLength(356);
  expect(arranged.notes.slice(0,6).map((note) => note.midi)).toEqual([57,61,68,64,61,68]);
  expect(arranged.duration).toBeGreaterThan(180);
  expect(arranged.duration).toBeLessThan(190);
  expect(arranged.notes.every((note) => Math.abs(note.midi-note.sample.midi) <= 4)).toBe(true);
  expect(arranged.notes.every((note) => note.duration > 0 && note.velocity > 0 && note.velocity <= 1)).toBe(true);
  const digest = createHash('sha256').update(bytes).digest('hex');
  expect(readFileSync('docs/OPENING_PERFORMANCE.md', 'utf8')).toContain(digest);
  for (const key of ['C2','G2','C3','G3','C4','G4','C5','G5','C6']) {
    expect(existsSync(`public/samples/opening/${key}.mp3`)).toBe(true);
  }
});
