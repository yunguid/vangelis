import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import {
  arrangeMemoriesOfGreen, makeStereoHiss, MOG_PIANO_PARAMS, nearestPosition, pedalledNotes, pianoSampleKey, readMemoriesOfGreen
} from './memoriesOfGreen.js';

// The record's pitch below A440, as measured (scripts/guitar-transcription/tuning.py).
const RECORD_CENTS = -32.1;

it('holds a note while the pedal is down and cuts it when its key is struck again', () => {
  const pedal = [{ on: 0.5, off: 3 }];
  const notes = pedalledNotes([
    { midi: 60, time: 0, duration: 1 }, // key up at 1 s, pedal down until 3 s
    { midi: 64, time: 3.5, duration: 0.5 }, // no pedal: rings until its key comes up
    { midi: 60, time: 2, duration: 0.2 } // the first C4 is cut here
  ], pedal);
  expect(notes.map((note) => [note.midi, note.time, note.duration])).toEqual([[60, 0, 2], [60, 2, 1], [64, 3.5, 0.5]]);
});

it('reads the piece as the transcription wrote it, with a recording for every note', () => {
  const score = readMemoriesOfGreen(new Midi(readFileSync('public/midi/performances/memories-of-green.mid')));
  expect(score.tuningCents).toBeCloseTo(RECORD_CENTS, 0);
  expect(score.notes.length).toBeGreaterThan(1000);
  for (const key of new Set(score.notes.map(pianoSampleKey))) {
    expect(existsSync(`public/samples/memories-of-green/${key}.mp3`), key).toBe(true);
  }
  const { notes, ambience } = arrangeMemoriesOfGreen(score, new Map(score.notes.map((note) => [pianoSampleKey(note), {}])), {});
  for (const note of notes) {
    expect(note.duration).toBeGreaterThan(0);
    expect(Math.abs(note.midi - nearestPosition(note.midi))).toBeLessThanOrEqual(1); // never pitch-shifted further
    expect(note.sample.buffer).toBeDefined();
    expect(note.audioParamOverrides).toBe(MOG_PIANO_PARAMS);
  }
  expect(ambience.audioParamOverrides).toBe(MOG_PIANO_PARAMS);
});

it('lays hiss under the piece that differs between the channels, as the record\u2019s does', () => {
  const context = {
    sampleRate: 48000,
    createBuffer: (channels, length, sampleRate) => {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { sampleRate, length, numberOfChannels: channels, getChannelData: (channel) => data[channel] };
    }
  };
  const hiss = makeStereoHiss(context);
  const [left, right] = [hiss.getChannelData(0), hiss.getChannelData(1)];
  let cross = 0;
  let power = 0;
  for (let i = 0; i < left.length; i++) {
    cross += left[i] * right[i];
    power += left[i] * left[i];
  }
  expect(Math.abs(cross / power)).toBeLessThan(0.1);
});
