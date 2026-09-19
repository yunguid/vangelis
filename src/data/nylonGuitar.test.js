import { readFileSync, existsSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import {
  arrangeGuitarPerformance, assignGuitarTakes, GUITAR_FORTE_VELOCITY, GUITAR_OPEN_STRINGS
} from './nylonGuitar.js';

const midi = new Midi(readFileSync('public/midi/performances/saudade-de-triana.mid'));
const score = { notes: midi.tracks.flatMap((track) => track.notes.map((note) => ({
  midi: note.midi, time: note.time, duration: note.duration, velocity: note.velocity, channel: track.channel
}))).sort((a,b) => a.time-b.time) };

it('has a recording for every string, fret and take the score plays', () => {
  expect(score.notes.length).toBeGreaterThan(700);
  for (const note of score.notes) {
    const fret = note.midi - GUITAR_OPEN_STRINGS[note.channel];
    expect(fret).toBeGreaterThanOrEqual(0);
    expect(fret).toBeLessThanOrEqual(19);
  }
  for (const key of new Set(assignGuitarTakes(score.notes))) {
    expect(existsSync(`public/samples/nylon-guitar/${key}.mp3`)).toBe(true);
  }
});

it('plays hard strokes from the forte takes and never repeats a recording back to back', () => {
  const pluck = (time, velocity) => ({ channel: 0, midi: 69, time, velocity });
  expect(assignGuitarTakes([pluck(0, GUITAR_FORTE_VELOCITY), pluck(5, GUITAR_FORTE_VELOCITY - 0.01)]))
    .toEqual(['s1f5ff', 's1f5mf']);
  expect(assignGuitarTakes([pluck(0, 0.6), pluck(0.5, 0.6), pluck(1, 0.6), pluck(4, 0.6)]))
    .toEqual(['s1f5mf', 's1f5pp', 's1f5mf', 's1f5mf']);
  const takes = assignGuitarTakes(score.notes);
  const lastOn = new Map();
  score.notes.forEach((note, index) => {
    const position = takes[index].slice(0, -2);
    const last = lastOn.get(position);
    if (last && note.time - last.time < 1) expect(takes[index]).not.toBe(last.take);
    lastOn.set(position, { time: note.time, take: takes[index] });
  });
});

it('never sounds two notes on one string', () => {
  const buffers = new Map(assignGuitarTakes(score.notes).map((key) => [key, {}]));
  const { notes } = arrangeGuitarPerformance(score, buffers);
  expect(notes).toHaveLength(score.notes.length);
  const ringsUntil = new Map();
  for (const note of notes) {
    expect(note.time).toBeGreaterThanOrEqual((ringsUntil.get(note.channel) ?? 0) - 1e-9);
    expect(note.duration).toBeGreaterThan(0);
    expect(note.sample.buffer).toBeDefined();
    ringsUntil.set(note.channel, note.time + note.duration);
  }
});
