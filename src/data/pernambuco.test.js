import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import {
  arrangePernambuco, pernambucoTake, readGuitarPerformance, PERNAMBUCO_PARAMS
} from './pernambuco.js';
import { GUITAR_OPEN_STRINGS } from './nylonGuitar.js';

const score = readGuitarPerformance(new Midi(readFileSync('public/midi/performances/pernambuco.mid')));

it('reads each stroke the way the transcription wrote it', () => {
  const midi = new Midi();
  const track = midi.addTrack();
  track.channel = 2;
  [[101, 0], [100, 1], [6, 90], [38, 88], [101, 127], [100, 127]]
    .forEach(([number, value], ticks) => track.addCC({ number, value: value / 127, ticks }));
  track.addCC({ number: 70, value: 106 / 127, ticks: 480 });
  track.addCC({ number: 74, value: 48 / 127, ticks: 480 });
  track.addCC({ number: 75, value: 32 / 127, ticks: 480 });
  track.addNote({ midi: 57, ticks: 480, durationTicks: 240, velocity: 0.5 });
  track.addCC({ number: 75, value: 1, ticks: 960 });
  track.addNote({ midi: 59, ticks: 960, durationTicks: 240, velocity: 0.5 });
  const { tuningCents, notes } = readGuitarPerformance(new Midi(midi.toArray()));
  expect(tuningCents).toBeCloseTo(41.7, 1);
  expect(notes[0]).toMatchObject({ channel: 2, take: 'ff', brightness: -4 });
  expect(notes[0].mute).toBeCloseTo(0.04, 6); // 10 ms doubling every 16 steps
  expect(notes[1]).toMatchObject({ take: 'ff', brightness: -4, mute: null }); // 127 rings
});

it('has a recording for every string, fret and stroke it plays', () => {
  expect(score.notes.length).toBeGreaterThan(1000);
  for (const note of score.notes) {
    const fret = note.midi - GUITAR_OPEN_STRINGS[note.channel];
    expect(fret).toBeGreaterThanOrEqual(0);
    expect(fret).toBeLessThanOrEqual(19);
  }
  for (const key of new Set(score.notes.map(pernambucoTake))) {
    expect(existsSync(`public/samples/nylon-guitar/${key}.mp3`), key).toBe(true);
  }
});

it('plays at the record’s pitch, one note per string, with each stroke’s shape', () => {
  expect(score.tuningCents).toBeCloseTo(41.7, 0);
  const buffers = new Map(score.notes.map((note) => [pernambucoTake(note), {}]));
  const { notes } = arrangePernambuco(score, buffers);
  const ringsUntil = new Map();
  for (const note of notes) {
    expect(note.time).toBeGreaterThanOrEqual((ringsUntil.get(note.channel) ?? 0) - 1e-9);
    expect(note.duration).toBeGreaterThan(0);
    ringsUntil.set(note.channel, note.time + note.duration);
    expect(note.sample.buffer).toBeDefined();
    const nominal = 440 * 2 ** ((note.midi - 69) / 12);
    expect(nominal / note.sample.baseFrequency).toBeCloseTo(2 ** (41.7 / 1200), 3);
    expect(note.audioParamOverrides).toBe(PERNAMBUCO_PARAMS);
  }
  // Bonfá's thumb mutes the accompaniment while the melody rings.
  expect(notes.filter((note) => note.sample.mute).length).toBeGreaterThan(100);
  expect(notes.filter((note) => !note.sample.mute).length).toBeGreaterThan(100);
});
